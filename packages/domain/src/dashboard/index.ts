/**
 * Dashboards and calendar (Fase 9, MASTER_SPECIFICATION §8.2, §9.2, §9.5, F18). Pure helpers:
 * streaks and milestones for the client (positive, never compared with other people) and the
 * calendar layout (month grid, plan phases and rest weeks as date spans).
 */
import type { AttendanceStatus } from '../monitoring/metrics';
import { addDays, isoWeekday } from '../planning/structure';

export interface StreakSession {
  date: string;
  status: AttendanceStatus | null;
}

/**
 * Consecutive planned sessions done (completed or partial), counting back from the most recent.
 * Today's session only counts once recorded; rescheduled/cancelled ones are skipped.
 */
export function sessionStreak(sessions: StreakSession[], today: string): number {
  const past = sessions
    .filter((s) => s.status !== 'rescheduled' && s.status !== 'cancelled_by_trainer')
    .filter((s) => s.date < today || (s.date === today && s.status != null))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  let n = 0;
  for (const s of past) {
    if (s.status === 'completed' || s.status === 'partial') n++;
    else break;
  }
  return n;
}

export interface Milestone {
  key: string;
  text: string;
  date: string | null;
}

const SESSION_MILESTONES = [1, 5, 10, 25, 50, 100, 200];
const STREAK_MILESTONES = [3, 5, 10, 20];

/**
 * Milestones in plain, positive language. Improvements are only those the assessment engine
 * calls "mejora probable" (beyond measurement error): never a change inside the error.
 */
export function milestones(input: {
  /** Dates of completed or partial sessions, any order. */
  doneDates: string[];
  streak: number;
  improvements: { testName: string; date: string }[];
}): Milestone[] {
  const done = [...input.doneDates].sort();
  const out: Milestone[] = [];
  for (const m of SESSION_MILESTONES)
    if (done.length >= m)
      out.push({
        key: `sessions:${m}`,
        text: m === 1 ? '¡Primera sesión completada!' : `${m} sesiones completadas`,
        date: done[m - 1]!,
      });
  const bestStreak = STREAK_MILESTONES.filter((m) => input.streak >= m).at(-1);
  if (bestStreak)
    out.push({
      key: `streak:${bestStreak}`,
      text: `Racha de ${bestStreak} sesiones seguidas`,
      date: null,
    });
  for (const i of input.improvements)
    out.push({
      key: `improvement:${i.testName}:${i.date}`,
      text: `Mejora confirmada en ${i.testName}`,
      date: i.date,
    });
  return out.sort((a, b) => ((a.date ?? '0000') < (b.date ?? '0000') ? 1 : -1));
}

/** Month grid (Monday first): weeks of 7 ISO dates covering the month `YYYY-MM`. */
export function monthGrid(month: string): string[][] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Invalid month ${month}`);
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = addDays(nextMonth, -1);
  const weeks: string[][] = [];
  for (let d = addDays(first, 1 - isoWeekday(first)); d <= last; d = addDays(d, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export interface PlanWeek {
  start: string;
  weekType: string;
  phaseName: string;
}
export interface Span {
  kind: 'phase' | 'rest';
  label: string;
  from: string;
  to: string;
}

const REST_WEEKS: Record<string, string> = {
  deload: 'Descarga',
  transition: 'Transición',
  taper: 'Afinamiento',
};

/** Plan phases and rest weeks (deload, transition, taper) as calendar spans. */
export function planSpans(weeks: PlanWeek[]): Span[] {
  const sorted = [...weeks].sort((a, b) => (a.start < b.start ? -1 : 1));
  const out: Span[] = [];
  for (const w of sorted) {
    const end = addDays(w.start, 6);
    const last = out.filter((s) => s.kind === 'phase').at(-1);
    if (last && last.label === w.phaseName && addDays(last.to, 1) === w.start) last.to = end;
    else out.push({ kind: 'phase', label: w.phaseName, from: w.start, to: end });
    if (REST_WEEKS[w.weekType])
      out.push({ kind: 'rest', label: REST_WEEKS[w.weekType]!, from: w.start, to: end });
  }
  return out;
}
