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
  completedAt?: IsoDateTime;
  sets: SetRecord[];
  /** Esfuerzo percibido de la sesión (0–10), autodeclarado por el cliente. */
  perceivedEffort?: number;
  comment?: string;
}

export type SessionStatus = 'completed' | 'partial' | 'pending' | 'missed';

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  completed: 'Completada',
  partial: 'A medias',
  pending: 'Pendiente',
  missed: 'No realizada',
};

export function sessionStatus(
  session: PlannedSession,
  log: SessionLog | undefined,
  today: IsoDate,
): SessionStatus {
  if (log?.completedAt) return 'completed';
  if (log && log.sets.some((set) => set.completed)) return 'partial';
  return session.date < today ? 'missed' : 'pending';
}

export function plannedSetCount(session: PlannedSession): number {
  return session.exercises.reduce((total, exercise) => total + exercise.sets, 0);
}

export function completedSetCount(log: SessionLog | undefined): number {
  return log ? log.sets.filter((set) => set.completed).length : 0;
}

export function sortSessions(sessions: readonly PlannedSession[]): PlannedSession[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
