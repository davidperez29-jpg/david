import { daysBetween, localDateOf, type IsoDate, type IsoDateTime } from '../time';
import { type DataOrigin, type RecordedBy } from '../measurement';
import { type RpeScale } from './effort';
import { type PerformedLoad } from './load';
import { type SessionContent } from './session-v2';

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
  /** Versión publicada con la que se empezó: la que recibió el cliente. */
  startedVersion: number;
  lastActivityAt: IsoDateTime;
  /** Pausa explícita en curso (hora de ejecución en que se pausó). */
  pausedAt?: IsoDateTime;
  /** Tiempo total de las pausas ya cerradas, en segundos. */
  pausedSeconds: number;
  finishedAt?: IsoDateTime;
  finishDeviceAt?: IsoDateTime;
  finishReceivedAt?: IsoDateTime;
  finishReason?: 'all_done' | 'ended_early';
  pendingSetsConfirmed?: number;
  /** Esfuerzo percibido de la sesión (modelo de la Fase 1; formalización pendiente de Q2). */
  perceivedEffort?: number;
  comment?: string;
  startClockAdjustment?: ClockAdjustment | null;
  finishClockAdjustment?: ClockAdjustment | null;
  origin?: DataOrigin;
  recordedBy?: RecordedBy;
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
  /** Por qué se usó la hora de recepción (null si se usó la del dispositivo). */
  clockAdjustment?: ClockAdjustment | null;
  /** Procedencia guardada con el registro (migración 003). */
  origin: DataOrigin;
  recordedBy: RecordedBy;
  originMethod?: string;
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
  const r = resolveExecutionInstant(deviceRecordedAt, receivedAt, null);
  return { performedAt: r.performedAt, clockAdjusted: r.adjustment !== null };
}

/**
 * Reglas de la hora de ejecución (docs/EXECUTION.md §7.1; A-10). No se confía ciegamente en el
 * reloj del móvil, pero tampoco se impone la hora del servidor a lo que se registró sin conexión:
 *
 * - T1 · Imposible: anterior a 2020-01-01 o posterior a 2100: el reloj del dispositivo está mal
 *   (típico tras perder la batería). Se rechaza con un mensaje para que se corrija.
 * - T2 · Por delante del servidor: se usa la hora de recepción (P-86): `ahead_of_server`.
 * - T3 · Anterior a lo posible (más de 5 min antes del límite inferior: la publicación de la
 *   versión para el inicio; el inicio de la ejecución para todo lo demás): se usa la hora de
 *   recepción: `before_lower_bound`.
 * - T4 · En otro caso, la del dispositivo: también lo registrado sin conexión horas antes, lo que
 *   pasa de la medianoche y una sesión reanudada al día siguiente.
 *
 * La hora del dispositivo, su zona y su desfase se guardan siempre, junto con la recepción y el
 * motivo del ajuste, para poder auditar las discrepancias. Los instantes son UTC: un cambio de
 * zona horaria no altera el orden; la fecha local se calcula con la zona de cada registro.
 */
export const EARLIEST_DEVICE_INSTANT = '2020-01-01T00:00:00.000Z';
export const LATEST_DEVICE_INSTANT = '2100-01-01T00:00:00.000Z';
export const CLOCK_TOLERANCE_MS = 5 * 60_000;
export type ClockAdjustment = 'ahead_of_server' | 'before_lower_bound';

export const isPossibleDeviceInstant = (deviceRecordedAt: IsoDateTime): boolean => {
  const t = Date.parse(deviceRecordedAt);
  return t >= Date.parse(EARLIEST_DEVICE_INSTANT) && t < Date.parse(LATEST_DEVICE_INSTANT);
};

export function resolveExecutionInstant(
  deviceRecordedAt: IsoDateTime,
  receivedAt: IsoDateTime,
  lowerBound: IsoDateTime | null,
): { performedAt: IsoDateTime; adjustment: ClockAdjustment | null } {
  const device = Date.parse(deviceRecordedAt);
  if (device > Date.parse(receivedAt)) {
    return { performedAt: receivedAt, adjustment: 'ahead_of_server' };
  }
  if (lowerBound !== null && device < Date.parse(lowerBound) - CLOCK_TOLERANCE_MS) {
    return { performedAt: receivedAt, adjustment: 'before_lower_bound' };
  }
  return { performedAt: deviceRecordedAt, adjustment: null };
}

/** Fecha de ejecución de una sesión: la fecha local de su inicio, en la zona del dispositivo. */
export const executionDate = (log: Pick<SessionLogV2, 'startedAt' | 'startTimeZone'>): IsoDate =>
  localDateOf(log.startedAt, log.startTimeZone);

/** Estados de ejecución (V1_SPEC §5.8). Se deducen; no se guardan. */
export type ExecutionStatusV2 =
  'planned' | 'overdue' | 'in_progress' | 'paused' | 'interrupted' | 'completed' | 'partial';

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatusV2, string> = {
  planned: 'Programada',
  overdue: 'Sin hacer',
  in_progress: 'En curso',
  paused: 'Pausada',
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
  if (input.log?.pausedAt) return 'paused';
  if (input.log) {
    return localDateOf(input.log.lastActivityAt, input.timeZone) === input.today
      ? 'in_progress'
      : 'interrupted';
  }
  return input.plannedDate < input.today ? 'overdue' : 'planned';
}

/** Series de una versión: (ejercicio, número de serie). */
export const currentSetRefs = (content: Pick<SessionContent, 'items'>) =>
  content.items.flatMap((item) =>
    Array.from({ length: item.sets }, (_, index) => ({
      prescriptionId: item.id,
      setNumber: index + 1,
    })),
  );

export interface ExecutionSummaryV2 {
  status: ExecutionStatusV2;
  /** Series de la versión vigente con un registro efectivo hecho (con cualquier versión). */
  completedSets: number;
  plannedSets: number;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  /** Fecha local de ejecución (la de su inicio) y diferencia en días con la prevista. */
  executedOn: IsoDate | null;
  daysFromPlanned: number | null;
}

/** Estado y avance de una sesión publicada, con lo registrado hasta ahora. */
export function summarizeExecutionV2(input: {
  plannedDate: IsoDate;
  content: Pick<SessionContent, 'items'>;
  log: SessionLogV2 | null;
  setLogs: readonly SetLogV2[];
  today: IsoDate;
  timeZone: string;
}): ExecutionSummaryV2 {
  const currentSets = currentSetRefs(input.content);
  const done = new Set(
    effectiveSetLogs(input.setLogs)
      .filter((log) => log.completed)
      .map((log) => `${log.prescriptionId}#${log.setNumber}`),
  );
  const executedOn = input.log ? executionDate(input.log) : null;
  return {
    status: executionStatus({ ...input, currentSets }),
    completedSets: currentSets.filter((set) => done.has(`${set.prescriptionId}#${set.setNumber}`))
      .length,
    plannedSets: currentSets.length,
    startedAt: input.log?.startedAt ?? null,
    finishedAt: input.log?.finishedAt ?? null,
    executedOn,
    daysFromPlanned: executedOn ? daysBetween(input.plannedDate, executedOn) : null,
  };
}
