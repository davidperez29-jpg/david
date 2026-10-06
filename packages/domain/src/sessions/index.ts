/**
 * Session execution (§9.2–9.6, §4.5). Pure rules shared by the server and the offline client:
 * what to show today, how to preload a set, how to validate a log, how a live substitution is
 * resolved and how offline logs that conflict with later edits are kept but flagged.
 */
import { REFERRAL_TEXT } from '../clients/health';
import type { SubstitutionReason } from '../library/substitution';

export const PAIN_MESSAGE =
  'Si el dolor persiste o es intenso, consulta con un profesional sanitario.';
export { REFERRAL_TEXT };

/** Session RPE anchors (CR-10 for the whole session, as in the sRPE method). Shown verbatim. */
export const SESSION_RPE_ANCHORS: { value: number; label: string }[] = [
  { value: 0, label: 'Reposo' },
  { value: 1, label: 'Muy, muy fácil' },
  { value: 2, label: 'Fácil' },
  { value: 3, label: 'Moderado' },
  { value: 4, label: 'Algo duro' },
  { value: 5, label: 'Duro' },
  { value: 7, label: 'Muy duro' },
  { value: 10, label: 'Máximo' },
];

export interface DaySession {
  id: string;
  date: string | null;
  attended: boolean;
}

/** "Hoy": the session dated today if any; otherwise the next pending one (never a past one). */
export function pickToday(
  sessions: DaySession[],
  today: string,
): { session: DaySession | null; isToday: boolean } {
  const dated = sessions.filter((s) => s.date).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  // Today's session while it is pending; once done, the next pending one.
  const t = dated.find((s) => s.date === today && !s.attended);
  if (t) return { session: t, isToday: true };
  const next = dated.find((s) => s.date! > today && !s.attended);
  return { session: next ?? null, isToday: false };
}

export interface SetLogInput {
  setIndex: number;
  loadKg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  completed?: boolean;
}

export function validateSetLog(l: SetLogInput): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (k: string, m: string) => (out[k] ??= []).push(m);
  if (!Number.isInteger(l.setIndex) || l.setIndex < 1 || l.setIndex > 50)
    add('setIndex', 'Serie entre 1 y 50.');
  if (l.loadKg != null && (l.loadKg < 0 || l.loadKg > 1000))
    add('loadKg', 'Carga entre 0 y 1000 kg.');
  if (l.reps != null && (!Number.isInteger(l.reps) || l.reps < 0 || l.reps > 200))
    add('reps', 'Repeticiones entre 0 y 200.');
  if (l.rir != null && (!Number.isInteger(l.rir) || l.rir < 0 || l.rir > 10))
    add('rir', 'RIR entre 0 y 10.');
  if (l.rpe != null && (l.rpe < 1 || l.rpe > 10 || Math.round(l.rpe * 2) !== l.rpe * 2))
    add('rpe', 'RPE entre 1 y 10, en pasos de 0,5.');
  if (l.rir != null && l.rpe != null) add('rpe', 'Registra RIR o RPE, no ambos.');
  if (l.durationS != null && (l.durationS < 0 || l.durationS > 7200))
    add('durationS', 'Duración entre 0 y 7200 s.');
  return out;
}

export interface PrescribedLike {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  loadKg: number | null;
  rirMin: number | null;
  durationS: number | null;
  distanceM: number | null;
}

/**
 * Preload for a set (§9.3): what was prescribed; if there is no prescribed load, the load the
 * client used last time with this exercise. One tap (✓) logs it as is.
 */
export function preloadSet(
  p: PrescribedLike,
  last: { loadKg: number | null; reps: number | null } | null,
) {
  return {
    loadKg: p.loadKg ?? last?.loadKg ?? null,
    reps: p.repsMax ?? p.repsMin ?? null,
    rir: p.rirMin ?? null,
    durationS: p.durationS ?? null,
    distanceM: p.distanceM ?? null,
  };
}

/** Live substitution (§9.3): pre-approved alternatives are applied; anything else waits for the trainer. */
export function resolveSubstitution(
  reason: SubstitutionReason,
  chosenId: string | null,
  allowed: string[],
) {
  const approved = chosenId != null && allowed.includes(chosenId);
  return {
    status: approved ? ('approved' as const) : ('pending' as const),
    notifyTrainer: !approved || reason === 'pain',
    message:
      reason === 'pain'
        ? PAIN_MESSAGE
        : approved
          ? null
          : 'Lo hemos anotado y avisado a tu entrenador/a.',
  };
}

/**
 * Offline logs are never dropped (§4.5). The server is the source of truth: if the planned
 * exercise was removed or the session was edited/unpublished after the client downloaded it,
 * the log is stored and flagged for review.
 */
export function syncConflict(c: {
  sessionExerciseExists: boolean;
  sessionPublished: boolean;
  sessionEditedAfter: boolean;
  performedMatches: boolean;
}): string | null {
  if (!c.sessionExerciseExists)
    return 'El ejercicio ya no está en la sesión (editada por el entrenador).';
  if (!c.sessionPublished) return 'La sesión dejó de estar publicada.';
  if (c.sessionEditedAfter) return 'La sesión se editó después de descargarla.';
  if (!c.performedMatches)
    return 'Ejercicio realizado distinto del prescrito sin sustitución aprobada.';
  return null;
}

/** Completion: share of prescribed sets that were logged as completed. */
export function sessionCompletion(prescribedSets: number, completedSets: number) {
  if (prescribedSets <= 0)
    return {
      percent: completedSets > 0 ? 100 : 0,
      status: completedSets > 0 ? ('completed' as const) : ('partial' as const),
    };
  const percent = Math.min(100, Math.round((completedSets / prescribedSets) * 100));
  return { percent, status: percent >= 100 ? ('completed' as const) : ('partial' as const) };
}

/** Calendar date (YYYY-MM-DD) in the organization's time zone (Spain by default). */
export function localDate(now: Date, timeZone = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Pain at or above this intensity (0–10) alerts the trainer. Practical default (F), configurable. */
export const PAIN_ALERT_THRESHOLD = 4;

// ── Fichaje automático (restructure phase 8, §41) ─────────────────────────────

/** What the client sees for a published session: planificada → iniciada → completada/incompleta, or no realizada. */
export type SessionTrackingState = 'planned' | 'started' | 'completed' | 'incomplete' | 'not_done';
export const SESSION_TRACKING_LABELS: Record<SessionTrackingState, string> = {
  planned: 'Planificada',
  started: 'Iniciada',
  completed: 'Completada',
  incomplete: 'Incompleta',
  not_done: 'No realizada',
};

export function trackingState(status: string | null | undefined): SessionTrackingState {
  switch (status) {
    case 'started':
      return 'started';
    case 'completed':
      return 'completed';
    case 'partial':
      return 'incomplete';
    case 'missed':
      return 'not_done';
    default:
      return 'planned';
  }
}

/**
 * The daily job's decision for a published session once its day has passed: started and never
 * closed → «incompleta»; nothing recorded → «no realizada». Never touches a session of today or
 * later, an unpublished one, or one with a closing record (the client or the trainer decided).
 */
export function autoAttendance(s: {
  date: string | null;
  published: boolean;
  status: string | null;
  today: string;
}): 'partial' | 'missed' | null {
  if (!s.published || !s.date || s.date >= s.today) return null;
  if (s.status === 'started') return 'partial';
  if (s.status == null) return 'missed';
  return null;
}
