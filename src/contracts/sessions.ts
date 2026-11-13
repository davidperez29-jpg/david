/**
 * Contratos de las sesiones v2 (V1): lo que el servidor entrega a las pantallas del entrenador
 * (A3, A4, A5, A7) y del cliente (B1, B2), ya filtrado por permisos. Solo tipos.
 * Los del cliente nunca incluyen la nota privada ni los borradores.
 */
import { type Issue } from '@/domain/issues';
import { type Silhouette } from '@/domain/library/exercise';
import { type IsoDate, type IsoDateTime } from '@/domain/time';
import { type ExecutionStatusV2 } from '@/domain/training/execution';
import { type SessionContent } from '@/domain/training/session-v2';
import { type ExecutionReviewVM } from './execution';

/** Estado y avance de una sesión publicada (V1_SPEC §5.8). */
export interface ExecutionVM {
  status: ExecutionStatusV2;
  completedSets: number;
  plannedSets: number;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  /** Fecha local en que se empezó y diferencia en días con la prevista («1 día después»). */
  executedOn: IsoDate | null;
  daysFromPlanned: number | null;
}

/** Un ejercicio de una versión, listo para mostrar (valores comunes y, si las hay, excepciones). */
export interface PrescriptionItemVM {
  id: string;
  /** A1, A2, B1… */
  slot: string;
  name: string;
  silhouette: Silhouette;
  sets: number;
  /** «3 × 10» o «3 × 8–10». */
  setsAndReps: string;
  loadLabel: string;
  effortLabel: string | null;
  restLabel: string;
  tempoLabel: string | null;
  clientNote: string | null;
  /** Series con valores propios («Serie 3: 8 × 75 kg · RIR 1»). Vacío si todas son iguales. */
  setExceptions: string[];
}

export interface TrainerPrescriptionItemVM extends PrescriptionItemVM {
  privateNote: string | null;
}

// ── Entrenador ───────────────────────────────────────────────────────────────

/** A3 · Una sesión en la lista por días. */
export interface TrainerSessionRowVM {
  id: string;
  dayOrder: number;
  label: string | null;
  title: string;
  focus: string;
  exerciseCount: number;
  publication: 'draft' | 'published';
  /** Versión vigente (null si nunca se ha publicado). */
  version: number | null;
  hasUnpublishedChanges: boolean;
  /** Solo las publicadas tienen ejecución. */
  execution: ExecutionVM | null;
  /** Solo un borrador que nunca se ha publicado se puede eliminar. */
  canDelete: boolean;
  /** Cambiar el orden en el día (entre borradores sin publicar, ver `reorderSessionDraft`). */
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface SessionDayVM<T> {
  date: IsoDate;
  sessions: T[];
}

export interface TrainerSessionsVM {
  clientId: string;
  clientName: string;
  clientFirstName: string;
  today: IsoDate;
  /** Desde hoy, sin límite, agrupadas por fecha prevista. */
  upcoming: SessionDayVM<TrainerSessionRowVM>[];
  /** Las cuatro semanas anteriores, de la más reciente a la más antigua. */
  past: SessionDayVM<TrainerSessionRowVM>[];
}

/** A4 · Formulario de «Nueva sesión». */
export interface NewSessionFormVM {
  clientId: string;
  clientFirstName: string;
  /** Identificador emitido al mostrar el formulario: un reenvío no crea otra sesión. */
  sessionId: string;
  defaultDate: IsoDate;
  today: IsoDate;
  labelSuggestions: string[];
}

export interface NewSessionInput {
  sessionId: string;
  clientId: string;
  plannedDate: string;
  label: string;
  title: string;
  focus: string;
  estimatedMinutes: number | null;
}

/** Lo que se escribió en el formulario, devuelto si no se creó la sesión (para no perderlo). */
export interface NewSessionValues {
  plannedDate: string;
  label: string;
  title: string;
  focus: string;
  estimatedMinutes: string;
}

export type CreateSessionOutcome =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'invalid'; issues: Issue[]; values?: NewSessionValues }
  | { ok: false; reason: 'not_found'; values?: NewSessionValues }
  | { ok: false; reason: SaveFailure; values?: NewSessionValues };

/** A5 · Una variante de la biblioteca que se puede añadir. */
export interface BuilderVariantVM {
  id: string;
  name: string;
  silhouette: Silhouette;
  /** Nombre normalizado para buscar (minúsculas y sin tildes). */
  searchText: string;
}

/** A5 · Constructor de un borrador que nunca se ha publicado. */
export interface SessionBuilderVM {
  sessionId: string;
  /** Quién edita: separa la copia local del borrador por identidad (A-07). */
  trainerId: string;
  clientId: string;
  clientFirstName: string;
  today: IsoDate;
  revision: number;
  updatedAt: IsoDateTime;
  content: SessionContent;
  variants: BuilderVariantVM[];
}

/**
 * Fallo al guardar que no depende del contenido (A-05): la base está ocupada o no disponible, un
 * error de almacenamiento, o un error inesperado del servidor. Las acciones lo DEVUELVEN, nunca lo
 * lanzan: así la pantalla conserva el trabajo y puede reintentar.
 */
export type SaveFailure = 'storage_busy' | 'storage_unavailable' | 'storage_error' | 'server_error';

export type SaveDraftOutcome =
  | { ok: true; revision: number; updatedAt: IsoDateTime; unchanged: boolean }
  | { ok: false; reason: 'conflict'; revision: number }
  | { ok: false; reason: 'invalid'; issues: Issue[] }
  | { ok: false; reason: 'not_found' | 'not_editable' }
  | { ok: false; reason: SaveFailure };

export type PublishOutcome =
  | { ok: true; version: number; alreadyPublished: boolean }
  | { ok: false; reason: 'conflict'; revision: number }
  | { ok: false; reason: 'invalid'; issues: Issue[] }
  | { ok: false; reason: 'not_found' | 'not_editable' }
  | { ok: false; reason: SaveFailure };

/** A7 · Sesión publicada (pestaña Prescripción, de solo lectura). */
export interface PublishedSessionVM {
  id: string;
  clientId: string;
  clientFirstName: string;
  plannedDate: IsoDate;
  dayOrder: number;
  label: string | null;
  title: string;
  focus: string;
  estimatedMinutes: number | null;
  coachNote: string | null;
  version: { number: number; publishedAt: IsoDateTime; publishedBy: string };
  hasUnpublishedChanges: boolean;
  execution: ExecutionVM;
  items: TrainerPrescriptionItemVM[];
  /** Prescrito frente a realizado, si la sesión ya se ha empezado. */
  review: ExecutionReviewVM | null;
}

// ── Cliente ──────────────────────────────────────────────────────────────────

export interface ClientSessionLineVM {
  id: string;
  plannedDate: IsoDate;
  dayOrder: number;
  label: string | null;
  title: string;
  focus: string;
  estimatedMinutes: number | null;
  exerciseCount: number;
  execution: ExecutionVM;
  /** El entrenador la cambió antes de que empezaras («Actualizada por Alex»). */
  updatedBy: string | null;
}

/** B1 · Hoy. */
export interface ClientTodayVM {
  firstName: string;
  today: IsoDate;
  /** La sesión protagonista, elegida según V1_SPEC §3 B1. */
  hero:
    | (ClientSessionLineVM & {
        action: 'continue' | 'start' | 'summary';
        coachNote: string | null;
        preview: { name: string; silhouette: Silhouette; setsAndReps: string }[];
      })
    | null;
  alsoToday: ClientSessionLineVM[];
  /** Sin terminar o sin hacer de los últimos 7 días: como mucho tres. */
  earlier: ClientSessionLineVM[];
  /** La próxima, si hoy no hay ninguna. */
  next: ClientSessionLineVM | null;
  week: { completed: number; planned: number };
}

/** B2 · Detalle de una sesión publicada. */
export interface ClientSessionDetailVM extends ClientSessionLineVM {
  today: IsoDate;
  coachNote: string | null;
  items: PrescriptionItemVM[];
  /** Lo registrado frente a lo prescrito, si ya se ha empezado (B6). */
  review: ExecutionReviewVM | null;
}

// ── Datos de la demostración (Configuración) ─────────────────────────────────

export interface DemoDataVM {
  file: string;
  space: string | null;
  seedDate: IsoDate;
  backups: { name: string; sizeBytes: number; createdAt: IsoDateTime }[];
}
