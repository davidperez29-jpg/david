import { type Visibility } from './library/exercise';
import { type Owner } from './library/taxonomy';
import { type Client } from './people';

/**
 * Quién hace la petición. En la Fase 1 lo fija una sesión de demostración; con la
 * autenticación real saldrá de la sesión verificada en el servidor.
 */
export type Actor =
  | { role: 'trainer'; trainerId: string }
  | { role: 'client'; clientId: string; trainerId: string }
  /** Administración del catálogo global de TrainPro (futuro). No accede a datos de clientes. */
  | { role: 'admin'; adminId: string };

export type TrainerActor = Extract<Actor, { role: 'trainer' }>;
export type ClientActor = Extract<Actor, { role: 'client' }>;

/** Recursos de la ficha de un cliente sobre los que se decide el acceso. */
export type ClientResource =
  | 'profile'
  | 'plan'
  | 'own_logs'
  | 'assessments'
  | 'volume'
  | 'rehab'
  | 'reports'
  | 'trainer_notes';

/** Lo que el entrenador decide compartir con cada cliente. */
export interface SharingSettings {
  clientId: string;
  assessments: { enabled: boolean; testIds: string[] };
  volume: boolean;
  rehab: boolean;
  reports: boolean;
}

/** Privacidad por defecto: no se comparte nada hasta que el entrenador lo decide. */
export function defaultSharing(clientId: string): SharingSettings {
  return {
    clientId,
    assessments: { enabled: false, testIds: [] },
    volume: false,
    rehab: false,
    reports: false,
  };
}

type ClientRef = Pick<Client, 'id' | 'trainerId'>;

/** Un entrenador accede solo a sus clientes; un cliente, solo a sí mismo. */
export function canAccessClient(actor: Actor, client: ClientRef): boolean {
  if (actor.role === 'admin') return false;
  if (actor.role === 'trainer') return client.trainerId === actor.trainerId;
  return client.id === actor.clientId && client.trainerId === actor.trainerId;
}

const ALWAYS_VISIBLE_TO_CLIENT: ReadonlySet<ClientResource> = new Set([
  'profile',
  'plan',
  'own_logs',
]);

export function canReadResource(
  actor: Actor,
  client: ClientRef,
  resource: ClientResource,
  sharing: SharingSettings | null,
): boolean {
  if (!canAccessClient(actor, client)) return false;
  if (actor.role === 'trainer') return true;

  if (resource === 'trainer_notes') return false;
  if (ALWAYS_VISIBLE_TO_CLIENT.has(resource)) return true;

  // Una configuración que no corresponde a este cliente se ignora (no comparte nada).
  const settings = sharing && sharing.clientId === client.id ? sharing : defaultSharing(client.id);
  switch (resource) {
    case 'assessments':
      return settings.assessments.enabled;
    case 'volume':
      return settings.volume;
    case 'rehab':
      return settings.rehab;
    case 'reports':
      return settings.reports;
    default:
      return false;
  }
}

/** Filtra los resultados de evaluación que puede ver el actor. */
export function visibleAssessmentTestIds(
  actor: Actor,
  client: ClientRef,
  sharing: SharingSettings | null,
): 'all' | ReadonlySet<string> {
  if (!canReadResource(actor, client, 'assessments', sharing)) return new Set();
  if (actor.role === 'trainer') return 'all';
  return new Set(sharing?.assessments.testIds ?? []);
}

// ── Biblioteca de ejercicios ──────────────────────────────────────────────────

type OwnedExercise = { owner: Owner; visibility: Visibility };

/**
 * El catálogo global lo ven todos los entrenadores; los ejercicios propios o privados, solo
 * su propietario. Los clientes no navegan por la biblioteca: ven los ejercicios a través de
 * las sesiones que tienen asignadas.
 */
export function canViewExercise(actor: Actor, exercise: OwnedExercise): boolean {
  if (actor.role === 'client') return false;
  if (exercise.visibility === 'global') return true;
  if (actor.role === 'admin') return false; // la administración no ve lo personal de los entrenadores
  return exercise.owner.kind === 'trainer' && exercise.owner.trainerId === actor.trainerId;
}

/**
 * El catálogo global solo lo edita la administración. Un ejercicio personalizado o privado, solo
 * su entrenador propietario. Un entrenador que quiera cambiar un ejercicio global lo adapta (copia).
 */
export function canEditExercise(actor: Actor, exercise: OwnedExercise): boolean {
  if (actor.role === 'admin') return exercise.visibility === 'global';
  return (
    actor.role === 'trainer' &&
    exercise.visibility !== 'global' &&
    exercise.owner.kind === 'trainer' &&
    exercise.owner.trainerId === actor.trainerId
  );
}

/** Un entrenador puede adaptar un ejercicio del catálogo global: se crea su copia personalizada. */
export function canAdaptExercise(actor: Actor, exercise: OwnedExercise): boolean {
  return actor.role === 'trainer' && exercise.visibility === 'global';
}
