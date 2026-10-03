/**
 * Monitoring metrics (Fase 8, MASTER_SPECIFICATION §13.7). Pure and descriptive: they never
 * diagnose and never predict injury.
 *
 * - Adherence = sessions done (completed or partial) / sessions planned, over a window.
 * - Internal load (sRPE method): session RPE (CR-10) × duration in minutes, in arbitrary units
 *   (claim `c_srpe_valido`, Foster 2001; Haddad 2017).
 * - Weekly monotony and strain are shown as descriptors without universal thresholds
 *   (claim `c_monotonia_descriptiva`, Foster 1998). The acute:chronic workload ratio is NOT
 *   computed (claim `c_acwr_no_usar`, Impellizzeri 2020).
 */
import { addDays, isoWeekday } from '../planning/structure';

export type AttendanceStatus =
  'completed' | 'partial' | 'missed' | 'rescheduled' | 'cancelled_by_trainer';

export interface PlannedSession {
  id: string;
  date: string;
  status: AttendanceStatus | null;
}

export interface Adherence {
  planned: number;
  done: number;
  completed: number;
  partial: number;
  missed: number;
  /** Past sessions without any record. */
  unrecorded: number;
  /** done / planned × 100, one decimal; null when nothing was planned. */
  percent: number | null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Adherence over [from, to] (inclusive). Rescheduled sessions and sessions cancelled by the
 * trainer are not counted as planned. Example from the specification: 24 planned, 21 done →
 * 87.5 %.
 */
export function adherence(sessions: PlannedSession[], from: string, to: string): Adherence {
  const inWindow = sessions.filter(
    (s) =>
      s.date >= from &&
      s.date <= to &&
      s.status !== 'rescheduled' &&
      s.status !== 'cancelled_by_trainer',
  );
  const count = (st: AttendanceStatus | null) => inWindow.filter((s) => s.status === st).length;
  const completed = count('completed');
  const partial = count('partial');
  const missed = count('missed');
  const unrecorded = count(null);
  const planned = inWindow.length;
  const done = completed + partial;
  return {
    planned,
    done,
    completed,
    partial,
    missed,
    unrecorded,
    percent: planned ? round1((done / planned) * 100) : null,
  };
}

/** Session internal load (sRPE × minutes, AU). Null when either value is missing. */
export function sessionLoad(sessionRpe: number | null, durationMin: number | null): number | null {
  if (sessionRpe == null || durationMin == null) return null;
  return Math.round(sessionRpe * durationMin);
}

export interface LoadedSession {
  date: string;
  sessionRpe: number | null;
  durationMin: number | null;
}

export interface WeekLoad {
  /** Monday of the ISO week. */
  weekStart: string;
  sessions: number;
  /** Sessions with sRPE and duration (the only ones that add load). */
  withLoad: number;
  load: number;
  /** Mean / SD of the 7 daily loads; null when SD is 0 or there is no load. */
  monotony: number | null;
  /** load × monotony. */
  strain: number | null;
}

const mondayOf = (d: string) => addDays(d, 1 - isoWeekday(d));

/** Weekly internal load, monotony and strain for the weeks touching [from, to]. */
export function weeklyLoad(sessions: LoadedSession[], from: string, to: string): WeekLoad[] {
  const out: WeekLoad[] = [];
  for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
    const inWeek = sessions.filter((s) => s.date >= w && s.date <= days[6]!);
    const daily = days.map((d) =>
      inWeek
        .filter((s) => s.date === d)
        .reduce((a, s) => a + (sessionLoad(s.sessionRpe, s.durationMin) ?? 0), 0),
    );
    const load = daily.reduce((a, b) => a + b, 0);
    const mean = load / 7;
    const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / 6);
    const monotony = load > 0 && sd > 0 ? Math.round((mean / sd) * 100) / 100 : null;
    out.push({
      weekStart: w,
      sessions: inWeek.length,
      withLoad: inWeek.filter((s) => sessionLoad(s.sessionRpe, s.durationMin) != null).length,
      load,
      monotony,
      strain: monotony != null ? Math.round(load * monotony) : null,
    });
  }
  return out;
}

export interface ReadinessEntry {
  date: string;
  energy?: number | null;
  sleepQuality?: number | null;
  motivation?: number | null;
  fatigue?: number | null;
  stress?: number | null;
  soreness?: number | null;
}

/**
 * Self-reported wellness on 0–10 (higher = better): mean of the answered items, with fatigue,
 * stress and soreness reversed. Null when nothing was answered. Descriptive, never a diagnosis.
 */
export function wellnessScore(r: ReadinessEntry): number | null {
  const items = [
    r.energy,
    r.sleepQuality,
    r.motivation,
    r.fatigue == null ? null : 10 - r.fatigue,
    r.stress == null ? null : 10 - r.stress,
    r.soreness == null ? null : 10 - r.soreness,
  ].filter((x): x is number => x != null);
  if (!items.length) return null;
  return round1(items.reduce((a, b) => a + b, 0) / items.length);
}
