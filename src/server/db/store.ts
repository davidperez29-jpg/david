import 'server-only';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  chmodSync,
  statSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { type IsoDate } from '@/domain/time';
import { buildDemoDataset } from '../repositories/demo/dataset';
import { type Repositories } from '../repositories/ports';
import { createSqliteRepositories } from '../repositories/sqlite';
import {
  type BackupInfo,
  createBackup,
  hasInterruptedRestore,
  listBackups,
  recoverInterruptedRestore,
  snapshotSync,
} from './backup.ts';
import { databaseFile } from './location.ts';
import { type DataLock, lockDataLocation, type LockRole } from './lock.ts';
import { migrate } from './migrate.ts';
import { seedDatabase } from './seed';
import { openSqlite, type SqlDatabase } from './sqlite.ts';

/**
 * Composición de la persistencia: el ÚNICO punto que abre la base y crea los repositorios SQLite
 * (una regla de ESLint impide importar el adaptador desde otro sitio).
 *
 * - Una conexión por archivo, guardada en `globalThis` para que la recarga en caliente de
 *   `next dev` no abra conexiones de más (docs/V1_SPEC.md §8.3.1).
 * - UN SOLO PROCESO por base, garantizado por un bloqueo del sistema operativo (`lock.ts`,
 *   ADR-25): un segundo servidor, o una restauración con el servidor en marcha, se rechazan.
 * - En cada uso se comprueba que la base y su bloqueo siguen siendo los mismos archivos: si alguien
 *   los borra o los sustituye por fuera, se deja de escribir (A-20) en lugar de perder datos.
 * - Una restauración interrumpida se termina o se anula antes de abrir la base.
 * - Al abrir: migraciones pendientes (con copia previa si la base ya tenía datos) y, si la base
 *   está vacía, la semilla de demostración con la fecha de hoy.
 * - Los datos de referencia de solo lectura se generan con la fecha de la semilla, de modo que
 *   siempre concuerdan con lo sembrado aunque pasen los días.
 */
export interface DataStore {
  readonly path: string;
  readonly lock: DataLock;
  readonly space: string | null;
  readonly seedDate: IsoDate;
  readonly db: SqlDatabase;
  readonly repos: Repositories;
}

export interface StoreOptions {
  dataDir: string;
  space: string | null;
  today: IsoDate;
  timeZone: string;
}

const readMeta = (db: SqlDatabase, key: string) =>
  db.prepare('SELECT value FROM meta WHERE key = @key').get<{ value: string }>({ key })?.value;

/**
 * Deja una base lista para usar: aplica las migraciones pendientes y, si está vacía, la siembra.
 * Devuelve la fecha de la semilla.
 */
export function prepareDatabase(
  db: SqlDatabase,
  options: { today: IsoDate; timeZone: string; now?: string },
): { seedDate: IsoDate; seeded: boolean; migrated: number[] } {
  const { applied } = migrate(db, {
    beforeMigrate: () => {
      snapshotSync(db, 'antes-de-migrar');
    },
  });
  const seedDate = readMeta(db, 'seed_date');
  if (seedDate) return { seedDate, seeded: false, migrated: applied };
  const trainers = db.prepare('SELECT COUNT(*) AS n FROM trainer').get<{ n: number }>()!.n;
  if (trainers > 0) {
    throw new Error(`La base ${db.path} tiene datos pero no su fecha de semilla: no se toca.`);
  }
  seedDatabase(db, buildDemoDataset(options.today), {
    seedDate: options.today,
    timeZone: options.timeZone,
    now: options.now ?? new Date().toISOString(),
  });
  return { seedDate: options.today, seeded: true, migrated: applied };
}

/** Repositorios sobre una base ya preparada. */
export function createStoreRepositories(db: SqlDatabase, seedDate: IsoDate): Repositories {
  return createSqliteRepositories(db, buildDemoDataset(seedDate));
}

/** En Linux y macOS, solo tu usuario puede leer el archivo (en Windows, la carpeta del usuario). */
function createPrivateFile(path: string) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (!existsSync(path)) closeSync(openSync(path, 'a', 0o600));
  if (process.platform !== 'win32') chmodSync(path, 0o600);
}

/** La base o su bloqueo ya no son los archivos que se abrieron: no se puede seguir escribiendo. */
export class StorageUnavailableError extends Error {}

/** Papel con el que este proceso toma la base (las pruebas unitarias se identifican como tales). */
const roleOfProcess = (): LockRole => (process.env.VITEST ? 'pruebas' : 'servidor');

const fileIdentity = (path: string) => {
  try {
    const stats = statSync(path);
    return `${stats.dev}:${stats.ino}`;
  } catch {
    return null;
  }
};

interface OpenedStore extends DataStore {
  identity: string | null;
  broken: string | null;
}

function openStore(path: string, options: StoreOptions, lock: DataLock): OpenedStore {
  if (hasInterruptedRestore(path)) {
    const outcome = recoverInterruptedRestore(lock);
    console.warn(`TrainPro: restauración interrumpida en ${path}: ${outcome}.`);
  }
  createPrivateFile(path);
  const db = openSqlite(path);
  try {
    const { seedDate } = prepareDatabase(db, options);
    return {
      path,
      lock,
      space: options.space,
      seedDate,
      db,
      repos: createStoreRepositories(db, seedDate),
      identity: fileIdentity(path),
      broken: null,
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

/** Comprueba que la base y el bloqueo siguen siendo los mismos archivos que se abrieron. */
function assertUsable(store: OpenedStore): void {
  if (!store.broken) {
    if (!store.lock.isIntact()) {
      store.broken = `El bloqueo de ${store.path} ya no es el que se tomó (¿se borró ${store.path}.lock?).`;
    } else if (fileIdentity(store.path) !== store.identity) {
      store.broken = `La base ${store.path} se ha borrado o sustituido por fuera de TrainPro.`;
    }
    if (store.broken)
      console.error(`TrainPro: ${store.broken} Se deja de escribir; reinicia el servidor.`);
  }
  if (store.broken) throw new StorageUnavailableError(store.broken);
}

const REGISTRY = Symbol.for('trainpro.dataStores');
type Registry = Map<string, OpenedStore>;

function registry(): Registry {
  const scope = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
  if (!scope[REGISTRY]) {
    const stores: Registry = new Map();
    scope[REGISTRY] = stores;
    // Al salir de forma ordenada (incluido SIGTERM), se cierra cada base: SQLite vuelca el WAL.
    process.once('exit', closeAllStores);
  }
  return scope[REGISTRY];
}

/** Cierra todas las bases abiertas por este proceso (al salir y en las pruebas de reinicio). */
export function closeAllStores(): void {
  const scope = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
  const stores = scope[REGISTRY];
  if (!stores) return;
  for (const store of stores.values()) {
    try {
      store.db.close();
    } finally {
      store.lock.release();
    }
  }
  stores.clear();
}

/** La base de un espacio (o la principal), abierta, migrada y sembrada la primera vez. */
export function getStore(options: StoreOptions): DataStore {
  const path = databaseFile(options.dataDir, options.space);
  const stores = registry();
  let store = stores.get(path);
  if (!store) {
    // Exclusividad: si otro proceso usa esta base, lanza `DataLocationBusyError` sin abrirla.
    const lock = lockDataLocation(path, roleOfProcess(), { waitMs: 2000 });
    try {
      store = openStore(path, options, lock);
    } catch (error) {
      lock.release();
      throw error;
    }
    stores.set(path, store);
  }
  assertUsable(store);
  return store;
}

/** Copia de seguridad en línea, verificada, en `backups/` junto a la base. */
export async function backupStore(options: StoreOptions): Promise<BackupInfo> {
  return createBackup(getStore(options).db, { label: 'manual' });
}

export function listStoreBackups(options: StoreOptions): BackupInfo[] {
  return listBackups(databaseFile(options.dataDir, options.space));
}

/**
 * «Restablecer datos demo»: guarda una copia del estado actual y vuelve a crear la base con la
 * semilla de hoy. La base nueva se prepara aparte y sustituye a la anterior al final, de modo
 * que, si algo falla a mitad, la anterior sigue intacta. Es síncrono: ninguna otra petición
 * puede escribir entre la copia y la sustitución.
 */
export function resetStore(options: StoreOptions): { backup: BackupInfo; store: DataStore } {
  getStore(options);
  const stores = registry();
  const current = stores.get(databaseFile(options.dataDir, options.space))!;
  const backup = snapshotSync(current.db, 'antes-de-restablecer');
  const fresh = `${current.path}.nueva`;
  for (const file of [fresh, `${fresh}-wal`, `${fresh}-shm`]) rmSync(file, { force: true });
  createPrivateFile(fresh);
  const next = openSqlite(fresh);
  try {
    prepareDatabase(next, options);
  } finally {
    next.close();
  }
  const fd = openSync(fresh, 'r+');
  fsyncSync(fd);
  closeSync(fd);
  // La base se cierra (vuelca el WAL) y se sustituye con un `rename` atómico; el bloqueo se mantiene.
  current.db.close();
  stores.delete(current.path);
  for (const suffix of ['-wal', '-shm']) rmSync(`${current.path}${suffix}`, { force: true });
  renameSync(fresh, current.path);
  let store: OpenedStore;
  try {
    store = openStore(current.path, options, current.lock);
  } catch (error) {
    current.lock.release();
    throw error;
  }
  stores.set(current.path, store);
  return { backup, store };
}
