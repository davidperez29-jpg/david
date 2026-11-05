import { type IsoDate, type IsoDateTime } from '../time';
import { type ExercisePrescription } from './prescription';

export interface PlannedSession {
  id: string;
  clientId: string;
  date: IsoDate;
  title: string;
  focus: string;
  estimatedMinutes: number;
  coachNote?: string;
  exercises: ExercisePrescription[];
}

/** Lo que el cliente registra de cada serie. */
export interface SetRecord {
  prescriptionId: string;
  setNumber: number;
  reps: number;
  loadKg: number | null;
  completed: boolean;
}

export interface SessionLog {
  id: string;
  sessionId: string;
  clientId: string;
  date: IsoDate;
  /** Cuándo empezó el cliente a registrar la sesión. */
  startedAt?: IsoDateTime;
  /**
   * Cuándo la dio por terminada el cliente (pulsó «Terminar»). Terminar NO implica completar:
   * el estado se deduce de las series realmente hechas (ver `sessionStatus`).
   */
  finishedAt?: IsoDateTime;
  sets: SetRecord[];
  /** Esfuerzo percibido de la sesión (0–10), autodeclarado por el cliente. */
  perceivedEffort?: number;
  /** Valoración de cada ejercicio (RIR o RPE real y observaciones), autodeclarada. */
  exerciseFeedback?: ExerciseFeedback[];
  /** Observaciones del cliente para su entrenador. */
  comment?: string;
}

export interface ExerciseFeedback {
  prescriptionId: string;
  rir?: number;
  rpe?: number;
  note?: string;
}

/**
 * - `pending`: aún no se ha empezado.
 * - `in_progress`: empezada hoy y sin terminar.
 * - `completed`: TODAS las series prescritas están hechas.
 * - `partial`: terminada o interrumpida con parte de las series hechas.
 * - `missed`: pasó el día, o se terminó, sin ninguna serie hecha.
 */
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'partial' | 'missed';

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  partial: 'Parcial o interrumpida',
  missed: 'No realizada',
};

/** Lo mínimo de una prescripción para contar series: id y número de series. */
type Prescribed = { exercises: readonly { id: string; sets: number }[] };

/**
 * Series válidas y sin duplicados: una por (ejercicio, número de serie) dentro de lo prescrito.
 * Si una serie se registra varias veces (p. ej., un reenvío), cuenta el último registro.
 * Así ningún cálculo (series, repeticiones, tonelaje) contabiliza dos veces la misma serie.
 */
export function effectiveSetRecords(
  session: Prescribed,
  records: readonly SetRecord[],
): SetRecord[] {
  const setsByPrescription = new Map(session.exercises.map((rx) => [rx.id, rx.sets]));
  const latest = new Map<string, SetRecord>();
  for (const record of records) {
    const planned = setsByPrescription.get(record.prescriptionId);
    if (
      planned === undefined ||
      !Number.isInteger(record.setNumber) ||
      record.setNumber < 1 ||
      record.setNumber > planned
    ) {
      continue;
    }
    latest.set(`${record.prescriptionId}#${record.setNumber}`, record);
  }
  return [...latest.values()];
}

export interface ExecutionSummary {
  plannedSets: number;
  completedSets: number;
  plannedExercises: number;
  /** Ejercicios con todas sus series hechas. */
  completedExercises: number;
  /** Ejercicios empezados pero no terminados. */
  startedExercises: number;
  byExercise: { prescriptionId: string; planned: number; completed: number }[];
  /** Registros descartados por duplicados o por no corresponder a lo prescrito. */
  ignoredRecords: number;
}

/** Lo prescrito frente a lo realizado, sin duplicados. */
export function summarizeExecution(
  session: Prescribed,
  records: readonly SetRecord[],
): ExecutionSummary {
  const effective = effectiveSetRecords(session, records);
  const byExercise = session.exercises.map((rx) => ({
    prescriptionId: rx.id,
    planned: rx.sets,
    completed: effective.filter((r) => r.prescriptionId === rx.id && r.completed).length,
  }));
  return {
    plannedSets: byExercise.reduce((sum, e) => sum + e.planned, 0),
    completedSets: byExercise.reduce((sum, e) => sum + e.completed, 0),
    plannedExercises: byExercise.length,
    completedExercises: byExercise.filter((e) => e.planned > 0 && e.completed >= e.planned).length,
    startedExercises: byExercise.filter((e) => e.completed > 0 && e.completed < e.planned).length,
    byExercise,
    ignoredRecords: records.length - effective.length,
  };
}

/** Estado a partir de lo realizado y de si la sesión ha terminado (por el cliente o por la fecha). */
export function deriveSessionStatus(
  summary: Pick<ExecutionSummary, 'plannedSets' | 'completedSets'>,
  flags: { started: boolean; finished: boolean; dayPassed: boolean },
): SessionStatus {
  if (summary.plannedSets > 0 && summary.completedSets >= summary.plannedSets) return 'completed';
  if (flags.finished || flags.dayPassed) return summary.completedSets > 0 ? 'partial' : 'missed';
  return flags.started ? 'in_progress' : 'pending';
}

export function sessionStatus(
  session: PlannedSession,
  log: SessionLog | undefined,
  today: IsoDate,
): SessionStatus {
  return deriveSessionStatus(summarizeExecution(session, log?.sets ?? []), {
    started: Boolean(log),
    finished: Boolean(log?.finishedAt),
    dayPassed: session.date < today,
  });
}

/** Esfuerzo percibido válido: entero de 0 a 10. */
export function isValidPerceivedEffort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

export function plannedSetCount(session: PlannedSession): number {
  return session.exercises.reduce((total, exercise) => total + exercise.sets, 0);
}

export function completedSetCount(session: PlannedSession, log: SessionLog | undefined): number {
  return log ? summarizeExecution(session, log.sets).completedSets : 0;
}

export function sortSessions(sessions: readonly PlannedSession[]): PlannedSession[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
