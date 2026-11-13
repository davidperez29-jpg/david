/**
 * Contratos de la ejecución (bloque 2): los comandos del cliente, las respuestas de la API y el
 * estado de una ejecución. Solo tipos. Ver docs/EXECUTION.md.
 */
import { type Issue } from '@/domain/issues';
import { type Silhouette } from '@/domain/library/exercise';
import { type IsoDate, type IsoDateTime } from '@/domain/time';
import { type DataOrigin, type RecordedBy } from '@/domain/measurement';
import { type ClockAdjustment, type ExecutionStatusV2 } from '@/domain/training/execution';
import { type PerformedLoad } from '@/domain/training/load';
import { type PerformedSetInput } from '@/domain/training/performance';
import { type SessionContent, type SetTarget } from '@/domain/training/session-v2';

/** Reloj del dispositivo en el momento del comando (V1_SPEC §5.5, P-86). */
export interface DeviceClock {
  recordedAt: IsoDateTime;
  timeZone: string;
  utcOffsetMinutes: number;
}

interface CommandBase {
  /** Identificador estable generado en el dispositivo: el mismo en todos los reintentos. */
  commandId: string;
  /**
   * Identidad que creó el comando en el dispositivo (A-08). El servidor lo rechaza si no es la de
   * la petición: un registro de una persona nunca se aplica como de otra.
   */
  clientId: string;
  device: DeviceClock;
}

export type ClientCommand =
  | (CommandBase & { type: 'start'; versionNumber: number })
  | (CommandBase & {
      type: 'log_set';
      /** Versión con la que la clienta ve esa serie. */
      versionNumber: number;
      prescriptionId: string;
      setNumber: number;
      /** `client_set_id` del registro efectivo que se corrige, o `null` si es el primero. */
      supersedes: string | null;
    } & PerformedSetInput)
  | (CommandBase & { type: 'pause' })
  | (CommandBase & { type: 'resume' })
  | (CommandBase & { type: 'finish'; confirmEndEarly: boolean; comment: string | null });

export type ClientCommandType = ClientCommand['type'];

/** Una serie registrada (el registro efectivo de esa serie). */
export interface PerformedSetVM {
  clientSetId: string;
  prescriptionId: string;
  setNumber: number;
  versionNumber: number;
  completed: boolean;
  reps?: number;
  durationS?: number;
  distanceM?: number;
  load?: PerformedLoad;
  rir?: number;
  rpe?: number;
  note?: string;
  performedAt: IsoDateTime;
  clockAdjusted: boolean;
  /** Por qué se usó la hora de recepción en lugar de la del móvil (null si no se ajustó). */
  clockAdjustment: ClockAdjustment | null;
  /** Procedencia guardada con el registro (hoy, siempre autodeclarado por el cliente). */
  origin: DataOrigin;
  recordedBy: RecordedBy;
  /** `client_set_id` al que corrige, si es una corrección. */
  supersedes?: string;
}

/** Estado de una ejecución tal como lo confirma el servidor. */
export interface ExecutionStateVM {
  sessionId: string;
  /** Versión vigente de la sesión ahora mismo. */
  currentVersion: number;
  /** Versión con la que se empezó (`null` si no ha empezado). */
  startedVersion: number | null;
  status: ExecutionStatusV2;
  startedAt: IsoDateTime | null;
  pausedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  finishReason: 'all_done' | 'ended_early' | null;
  comment: string | null;
  /** Registros efectivos, uno por serie. */
  sets: PerformedSetVM[];
  completedSets: number;
  plannedSets: number;
}

export type CommandErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'not_started'
  | 'already_started'
  | 'closed'
  | 'set_already_logged'
  | 'not_effective'
  | 'command_id_reused'
  | 'unknown_version'
  | 'unknown_set_in_version'
  | 'confirmation_required'
  | 'invalid'
  /** El comando lo creó otra identidad: no se aplica ni se revela nada (A-08). */
  | 'identity_mismatch'
  /** Otro proceso tiene la escritura de la base: recuperable, se reintenta (A-11). */
  | 'storage_busy'
  /** La base no está disponible (borrada, sustituida o en uso por otro proceso): recuperable. */
  | 'storage_unavailable'
  /** Error de almacenamiento no recuperable con un reintento inmediato (disco lleno, base dañada). */
  | 'storage_error';

/** Respuesta de `POST /api/cliente/sesiones/<id>/comandos` (V1_SPEC §8.4). */
export type CommandResponse =
  | { ok: true; result: 'applied' | 'already_applied'; state: ExecutionStateVM }
  | {
      ok: false;
      error: CommandErrorCode;
      message: string;
      issues?: Issue[];
      /** Estado actual, cuando la sesión existe y es del cliente (para reconciliar). */
      state?: ExecutionStateVM;
      /** Con `set_already_logged` y `not_effective`: el registro efectivo de esa serie. */
      effective?: PerformedSetVM;
      /** Con `confirmation_required`: series sin registrar. */
      pendingSets?: number;
    };

export const COMMAND_HTTP_STATUS: Record<CommandErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  not_started: 409,
  already_started: 409,
  closed: 409,
  set_already_logged: 409,
  not_effective: 409,
  command_id_reused: 409,
  unknown_version: 409,
  unknown_set_in_version: 409,
  confirmation_required: 409,
  invalid: 422,
  identity_mismatch: 409,
  storage_busy: 503,
  storage_unavailable: 503,
  storage_error: 500,
};

// ── Reproductor (B3–B6) ──────────────────────────────────────────────────────

export interface PlayerSetVM {
  setNumber: number;
  /** Prescripción de esta serie (valores comunes con sus excepciones). */
  target: SetTarget;
  repsLabel: string;
  loadLabel: string;
  effortLabel: string | null;
  restLabel: string;
  tempoLabel: string | null;
  note: string | null;
}

export interface PlayerItemVM {
  id: string;
  variantId: string;
  /** A1, A2, B1… */
  slot: string;
  name: string;
  silhouette: Silhouette;
  summary: string;
  steps: string[];
  cues: string[];
  videoUrl: string | null;
  clientNote: string | null;
  sets: PlayerSetVM[];
}

/** Lo que necesita el reproductor: la versión vigente (sin nota privada) y el estado. */
export interface PlayerVM {
  sessionId: string;
  /** Identidad de quien entrena: va en cada comando y separa la cola local por persona. */
  clientId: string;
  clientFirstName: string;
  trainerFirstName: string;
  today: IsoDate;
  plannedDate: IsoDate;
  label: string | null;
  title: string;
  focus: string;
  estimatedMinutes: number | null;
  coachNote: string | null;
  /** Número de la versión que muestra el reproductor. */
  version: number;
  /** El contenido de esa versión sin notas privadas (para el resumen calculado en el móvil). */
  content: SessionContent;
  items: PlayerItemVM[];
  /** Otra sesión empezada y sin terminar (al empezar esta se pide confirmación, P-21). */
  otherActive: { id: string; name: string } | null;
  state: ExecutionStateVM;
}

/** Resumen de lo realizado frente a lo prescrito (B6 y A7): lo calcula el dominio. */
export type {
  ExecutionReview as ExecutionReviewVM,
  ExecutionReviewItem as ExecutionReviewItemVM,
  ExecutionReviewSet as ExecutionReviewSetVM,
} from '@/domain/training/review';
