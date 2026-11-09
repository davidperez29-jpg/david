import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import { type IsoDate, todayInTimeZone } from '@/domain/time';
import { type BackupInfo } from './db/backup.ts';
import { isValidSpace } from './db/location.ts';
import { backupStore, getStore, listStoreBackups, resetStore, type StoreOptions } from './db/store';
import { readServerEnv, type ServerEnv } from './env';
import { DEMO_IDENTITIES, type DemoIdentity } from './repositories/demo/dataset';
import { type Repositories } from './repositories/ports';

/**
 * Contexto de cada petición: quién la hace, qué día es y con qué datos se trabaja.
 * Todos los casos de uso lo reciben, de modo que los permisos se aplican siempre en el servidor.
 */
export interface RequestContext<A> {
  actor: A;
  today: IsoDate;
  /** Zona horaria de la aplicación (fecha local de ejecución, horas mostradas). */
  timeZone: string;
  repos: Repositories;
}
export type TrainerContext = RequestContext<TrainerActor>;
export type ClientContext = RequestContext<ClientActor>;

/** Cookie con la clienta o el cliente elegido en «Entrar como…» (solo `local-demo`). */
export const CLIENT_IDENTITY_COOKIE = 'trainpro-cliente';
/** Cookie del espacio aislado de una prueba E2E (solo con `TRAINPRO_DEMO_SPACES=on`). */
export const SPACE_COOKIE = 'trainpro-espacio';

type CookieJar = Awaited<ReturnType<typeof cookies>>;

async function requestEnvironment() {
  // Los datos dependen de la petición (fecha, identidad y espacio).
  await connection();
  const env = readServerEnv();
  const jar = await cookies();
  const today = todayInTimeZone(env.timeZone);
  const space = env.demoSpaces ? (jar.get(SPACE_COOKIE)?.value ?? null) : null;
  const storeOptions: StoreOptions = {
    dataDir: env.dataDir,
    space: space && isValidSpace(space) ? space : null,
    today,
    timeZone: env.timeZone,
  };
  return { env, jar, today, storeOptions, repos: getStore(storeOptions).repos };
}

/**
 * Paso 1 (docs/V1_SPEC.md §7): quién es la persona.
 * IDENTIDAD DE DEMOSTRACIÓN, NO AUTENTICACIÓN: solo existe con `TRAINPRO_MODE=local-demo`.
 * El área del entrenador es la de Alex; en la del cliente, la persona elegida en «Entrar como…»
 * (Marta si no se ha elegido). En la Fase 2 esto saldrá de una sesión verificada.
 */
function resolveIdentity(area: 'trainer' | 'client', env: ServerEnv, jar: CookieJar) {
  if (env.mode !== 'local-demo') return null;
  const wanted =
    area === 'trainer'
      ? DEMO_IDENTITIES.find((i) => i.role === 'trainer')!.id
      : (jar.get(CLIENT_IDENTITY_COOKIE)?.value ??
        DEMO_IDENTITIES.find((i) => i.role === 'client')!.id);
  const identity = DEMO_IDENTITIES.find((i) => i.id === wanted && i.role === area);
  return identity ?? null;
}

/** Paso 2: qué papel tiene esa persona, según la base de datos. */
async function trainerActor(identity: DemoIdentity | null, repos: Repositories) {
  if (!identity) return null;
  const trainer = await repos.trainers.getById(identity.id);
  return trainer ? ({ role: 'trainer', trainerId: trainer.id } satisfies TrainerActor) : null;
}

async function clientActor(identity: DemoIdentity | null, repos: Repositories) {
  if (!identity) return null;
  const client = await repos.clients.getById(identity.id);
  return client
    ? ({ role: 'client', clientId: client.id, trainerId: client.trainerId } satisfies ClientActor)
    : null;
}

/** Sin identidad válida (modo no local o cookie desconocida) se vuelve a la portada. */
export async function getTrainerContext(): Promise<TrainerContext> {
  const { env, jar, today, repos } = await requestEnvironment();
  const actor = await trainerActor(resolveIdentity('trainer', env, jar), repos);
  if (!actor) redirect('/');
  return { actor, today, timeZone: env.timeZone, repos };
}

export async function getClientContext(): Promise<ClientContext> {
  const { env, jar, today, repos } = await requestEnvironment();
  const actor = await clientActor(resolveIdentity('client', env, jar), repos);
  if (!actor) redirect('/');
  return { actor, today, timeZone: env.timeZone, repos };
}

/** Lo que muestra la portada: si existe «Entrar como…» y con qué personas ficticias. */
export async function getDemoEntry(): Promise<{
  enabled: boolean;
  choices: { id: string; role: DemoIdentity['role']; name: string }[];
}> {
  const { env, repos } = await requestEnvironment();
  if (env.mode !== 'local-demo') return { enabled: false, choices: [] };
  const choices = await Promise.all(
    DEMO_IDENTITIES.map(async (identity) => {
      const person =
        identity.role === 'trainer'
          ? await repos.trainers.getById(identity.id)
          : await repos.clients.getById(identity.id);
      return person ? { id: identity.id, role: identity.role, name: person.displayName } : null;
    }),
  );
  return { enabled: true, choices: choices.filter((c) => c !== null) };
}

/**
 * «Entrar como…»: valida en el servidor que la persona es una de las identidades de
 * demostración y existe en la base. Devuelve adónde ir, o `null` si no es válida.
 */
export async function enterAsDemoIdentity(id: string): Promise<'/entrenador' | '/cliente' | null> {
  const { env, jar } = await requestEnvironment();
  if (env.mode !== 'local-demo') return null;
  const entry = await getDemoEntry();
  const choice = entry.choices.find((c) => c.id === id);
  if (!choice) return null;
  if (choice.role === 'trainer') return '/entrenador';
  jar.set(CLIENT_IDENTITY_COOKIE, choice.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return '/cliente';
}

/** Mantenimiento de la base local (solo para el entrenador de la demo; ver `demo-data.ts`). */
export interface DataMaintenance {
  describe(): { file: string; space: string | null; seedDate: IsoDate; backups: BackupInfo[] };
  backup(): Promise<BackupInfo>;
  reset(): { backup: BackupInfo; seedDate: IsoDate };
}

export async function getDataMaintenance(): Promise<DataMaintenance> {
  const { storeOptions } = await requestEnvironment();
  return {
    describe: () => {
      const store = getStore(storeOptions);
      return {
        file: store.path,
        space: store.space,
        seedDate: store.seedDate,
        backups: listStoreBackups(storeOptions),
      };
    },
    backup: () => backupStore(storeOptions),
    reset: () => {
      const { backup, store } = resetStore(storeOptions);
      return { backup, seedDate: store.seedDate };
    },
  };
}
