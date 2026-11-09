import { localDateOf, type IsoDate, type IsoDateTime } from '../time';
import { type RpeScale } from './effort';
import { type PerformedLoad } from './load';

/**
 * Ejecución v2 (docs/V1_SPEC.md §4 y §5): un registro por sesión y series de solo adición.
 * El bloque 1 solo lee estos datos (los sembrados); registrarlos llega en el bloque 2.
 */
export interface SessionLogV2 {
  id: string;
  sessionId: string;
  clientId: string;
  /** Instante de ejecución del inicio (hora del dispositivo, ajustada si iba adelantada). */
  startedAt: IsoDateTime;
  startDeviceAt: IsoDateTime;
  startTimeZone: string;
  startUtcOffsetMin: number;
  startReceivedAt: IsoDateTime;
  lastActivityAt: IsoDateTime;
  finishedAt?: IsoDateTime;
  finishDeviceAt?: IsoDateTime;
  finishReceivedAt?: IsoDateTime;
  finishReason?: 'all_done' | 'ended_early';
  pendingSetsConfirmed?: number;
  /** Esfuerzo percibido de la sesión (modelo de la Fase 1; formalización pendiente de Q2). */
  perceivedEffort?: number;
  comment?: string;
}

export interface SetLogV2 {
  clientSetId: string;
  sessionLogId: string;
  sessionId: string;
  clientId: string;
  versionNumber: number;
  prescriptionId: string;
  variantId: string;
  setNumber: number;
  role: 'working';
  completed: boolean;
  reps?: number;
  durationS?: number;
  distanceM?: number;
  load?: PerformedLoad;
  rir?: number;
  rpe?: number;
  rpeScale?: RpeScale;
  note?: string;
  supersedes?: string;
  performedAt: IsoDateTime;
  deviceRecordedAt: IsoDateTime;
  deviceTimeZone: string;
  deviceUtcOffsetMin: number;
  receivedAt: IsoDateTime;
  clockAdjusted: boolean;
}

/**
 * Registros efectivos: los que ninguna corrección ha sustituido (uno por serie). Mismo criterio
 * en el servidor y, en el bloque 2, en el reproductor.
 */
export function effectiveSetLogs(logs: readonly SetLogV2[]): SetLogV2[] {
  const superseded = new Set(logs.flatMap((log) => (log.supersedes ? [log.supersedes] : [])));
  return logs.filter((log) => !superseded.has(log.clientSetId));
}

/**
 * Hora de ejecución de un registro (P-86): la del dispositivo, salvo que sea posterior a la de
 * recepción (el reloj iba adelantado); entonces se usa la de recepción y se marca.
 */
export function executionInstant(
  deviceRecordedAt: IsoDateTime,
  receivedAt: IsoDateTime,
): { performedAt: IsoDateTime; clockAdjusted: boolean } {
  return Date.parse(deviceRecordedAt) > Date.parse(receivedAt)
    ? { performedAt: receivedAt, clockAdjusted: true }
    : { performedAt: deviceRecordedAt, clockAdjusted: false };
}

/** Fecha de ejecución de una sesión: la fecha local de su inicio, en la zona del dispositivo. */
export const executionDate = (log: Pick<SessionLogV2, 'startedAt' | 'startTimeZone'>): IsoDate =>
  localDateOf(log.startedAt, log.startTimeZone);

/** Estados de ejecución (V1_SPEC §5.8). Se deducen; no se guardan. */
export type ExecutionStatusV2 =
  'planned' | 'overdue' | 'in_progress' | 'interrupted' | 'completed' | 'partial';

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatusV2, string> = {
  planned: 'Programada',
  overdue: 'Sin hacer',
  in_progress: 'En curso',
  interrupted: 'Interrumpida',
  completed: 'Completada',
  partial: 'Parcial',
};

export interface StatusInput {
  plannedDate: IsoDate;
  /** Series de la versión vigente: (ejercicio, número de serie). */
  currentSets: readonly { prescriptionId: string; setNumber: number }[];
  log: SessionLogV2 | null;
  setLogs: readonly SetLogV2[];
  today: IsoDate;
  /** Zona de la aplicación, para saber si la última actividad fue «hoy». */
  timeZone: string;
}

export function executionStatus(input: StatusInput): ExecutionStatusV2 {
  const done = new Set(
    effectiveSetLogs(input.setLogs)
      .filter((log) => log.completed)
      .map((log) => `${log.prescriptionId}#${log.setNumber}`),
  );
  const allDone =
    input.currentSets.length > 0 &&
    input.currentSets.every((set) => done.has(`${set.prescriptionId}#${set.setNumber}`));
  if (input.log && allDone) return 'completed';
  if (input.log?.finishedAt) return 'partial';
  if (input.log) {
    return localDateOf(input.log.lastActivityAt, input.timeZone) === input.today
      ? 'in_progress'
      : 'interrupted';
  }
  return input.plannedDate < input.today ? 'overdue' : 'planned';
}
