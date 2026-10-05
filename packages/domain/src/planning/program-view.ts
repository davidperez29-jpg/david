/**
 * The Programa tab (docs/UX_FLOW.md §2.2): MES → SEMANA → SESIÓN. Pure helpers to place weeks in
 * months and to find the week the trainer most likely wants to see.
 */
import { addDays } from './structure';

export interface CalendarWeek {
  id: string;
  /** Monday (or first day) of the week, ISO date; null for undated plans. */
  start: string | null;
}

/** Month of a week (YYYY-MM): the month of its Thursday, so a week always belongs to one month. */
export function weekMonth(start: string): string {
  return addDays(start, 3).slice(0, 7);
}

/** Months spanned by the weeks, in order, with their weeks. Undated weeks go to key ''. */
export function monthsOf<W extends CalendarWeek>(weeks: W[]): { key: string; weeks: W[] }[] {
  const out: { key: string; weeks: W[] }[] = [];
  for (const w of weeks) {
    const key = w.start ? weekMonth(w.start) : '';
    const last = out[out.length - 1];
    if (last && last.key === key) last.weeks.push(w);
    else out.push({ key, weeks: [w] });
  }
  return out;
}

/**
 * The week to open by default: the one that contains today; otherwise the next one to come;
 * otherwise (plan finished) the last one. Undated plans open on their first week.
 */
export function currentWeekId(weeks: CalendarWeek[], today: string): string | null {
  const dated = weeks.filter((w): w is CalendarWeek & { start: string } => !!w.start);
  if (!dated.length) return weeks[0]?.id ?? null;
  const now = dated.find((w) => w.start <= today && today <= addDays(w.start, 6));
  if (now) return now.id;
  const next = dated.find((w) => w.start > today);
  return (next ?? dated[dated.length - 1]!).id;
}
