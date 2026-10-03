/**
 * Plan structure (§12.1) and template expansion (§12.2–12.3). Pure: given a template definition,
 * a start date and the client's weekdays, it produces the full tree with dates and the
 * prescription of every week after applying the declarative progression rules (§12.7).
 * No periodization model is imposed: the template decides phases, mesocycles and week types.
 */
import type { Prescription } from './prescription';

export const WEEK_TYPES = [
  'introduction',
  'progression',
  'peak',
  'deload',
  'test',
  'taper',
  'transition',
  'competition',
] as const;
export type WeekType = (typeof WEEK_TYPES)[number];
export const PLAN_DURATIONS = [3, 6, 9, 12] as const;

/** Declarative progression applied when expanding weeks (practical rules, level F unless stated). */
export type ProgressionRule =
  | { kind: 'none' }
  /** RIR target goes down by `step` each loading week of the mesocycle, never below `floor`. */
  | { kind: 'rir_wave'; step: number; floor: number }
  /** +incrementKg (or +incrementPct of 1RM) every loading week, up to an optional cap. */
  | {
      kind: 'linear_load';
      incrementKg?: number;
      incrementPct?: number;
      capKg?: number;
      capPct?: number;
    }
  /** +1 set every `everyWeeks` loading weeks, up to `maxSets` (volume progression). */
  | { kind: 'add_set'; everyWeeks: number; maxSets: number }
  /** Evaluated after logged sessions (Phase 7–8): proposes +load when all sets reach repsMax at target RIR. */
  | { kind: 'double_progression'; incrementKg: number };

export interface DeloadPolicy {
  setsDelta: number;
  rirDelta: number;
}
/** Practical default from the user's workbooks (§12.7: level F): −1 set and RIR +2. */
export const DEFAULT_DELOAD: DeloadPolicy = { setsDelta: -1, rirDelta: 2 };

export interface TemplateExercise {
  /** Exercise slug (global library) or id. */
  exercise: string;
  pairingLabel?: string;
  prescription: Prescription;
  /** Assessment test slug whose latest value is the base of %1RM (e.g. one_rm_back_squat). */
  loadBasisMetric?: string;
  methods?: string[];
  progression?: ProgressionRule;
  notesForClient?: string;
  side?: 'both' | 'left' | 'right' | 'each';
}
export interface TemplateBlock {
  type: string;
  organization?: string;
  label?: string;
  rounds?: number;
  restBetweenRoundsS?: number;
  notes?: string;
  exercises: TemplateExercise[];
}
export interface TemplateSession {
  dayLabel: string;
  title: string;
  objective?: string;
  durationMin?: number;
  notesForClient?: string;
  blocks: TemplateBlock[];
}
export interface TemplateMesocycle {
  name: string;
  weeks: number;
  focus?: string;
  /** One per week; defaults to introduction, progression…, deload for ≥ 4 weeks. */
  weekTypes?: WeekType[];
  assessmentPlanned?: boolean;
}
export interface TemplatePhase {
  name: string;
  objective?: string;
  emphasis?: Record<string, number>;
  sessionsPerWeek?: number;
  mesocycles: TemplateMesocycle[];
}
export interface TemplateDefinition {
  durationMonths: (typeof PLAN_DURATIONS)[number];
  sessionsPerWeek: number;
  phases: TemplatePhase[];
  /** Weekly pattern repeated every week (progression applied per week). */
  sessions: TemplateSession[];
  /** Explicit weeks (saved from a real plan) override the pattern for those weeks. */
  weeks?: { weekIndex: number; sessions: TemplateSession[] }[];
  deload?: DeloadPolicy;
}

/** Calendar weeks available in a plan of N months. */
export function weeksFor(months: number): number {
  return Math.round((months * 52) / 12);
}

export function defaultWeekTypes(weeks: number): WeekType[] {
  if (weeks <= 1) return ['progression'];
  if (weeks < 4) return ['introduction', ...Array<WeekType>(weeks - 1).fill('progression')];
  return ['introduction', ...Array<WeekType>(weeks - 2).fill('progression'), 'deload'];
}

export interface StructureIssue {
  path: string;
  message: string;
}

export function validateDefinition(def: TemplateDefinition): StructureIssue[] {
  const out: StructureIssue[] = [];
  if (!PLAN_DURATIONS.includes(def.durationMonths))
    out.push({ path: 'durationMonths', message: 'La duración debe ser 3, 6, 9 o 12 meses.' });
  if (def.sessionsPerWeek < 1 || def.sessionsPerWeek > 7)
    out.push({ path: 'sessionsPerWeek', message: 'Entre 1 y 7 sesiones por semana.' });
  const total = def.phases.reduce((a, p) => a + p.mesocycles.reduce((b, m) => b + m.weeks, 0), 0);
  if (total < 1) out.push({ path: 'phases', message: 'El plan necesita al menos una semana.' });
  if (total > weeksFor(def.durationMonths))
    out.push({
      path: 'phases',
      message: `Las semanas (${total}) superan la duración del plan (${weeksFor(def.durationMonths)}).`,
    });
  def.phases.forEach((p, i) =>
    p.mesocycles.forEach((m, j) => {
      if (m.weeks < 1 || m.weeks > 16)
        out.push({
          path: `phases.${i}.mesocycles.${j}.weeks`,
          message: 'Un mesociclo dura entre 1 y 16 semanas.',
        });
      if (m.weekTypes && m.weekTypes.length !== m.weeks)
        out.push({
          path: `phases.${i}.mesocycles.${j}.weekTypes`,
          message: 'Indica un tipo por semana.',
        });
    }),
  );
  if (def.sessions.length !== def.sessionsPerWeek && !def.weeks?.length) {
    out.push({
      path: 'sessions',
      message: `La plantilla define ${def.sessions.length} sesiones pero el plan tiene ${def.sessionsPerWeek} por semana.`,
    });
  }
  return out;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const d = toDate(iso).getUTCDay();
  return d === 0 ? 7 : d;
}
export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY));
}

/** Session dates of one week: first occurrence of each weekday on/after the week start. */
export function weekDates(startDate: string, weekIndex: number, weekdays: number[]): string[] {
  const weekStart = addDays(startDate, 7 * (weekIndex - 1));
  const startDay = isoWeekday(weekStart);
  return weekdays.map((wd) => addDays(weekStart, (wd - startDay + 7) % 7)).sort();
}

// ── Progression ───────────────────────────────────────────────────────────────

export interface WeekPosition {
  weekType: WeekType;
  /** 0-based index among the loading weeks (introduction/progression/peak) of the mesocycle. */
  loadingIndex: number;
}

/** Applies a rule and the week type to the base prescription. Pure; returns a new object. */
export function prescriptionForWeek(
  base: Prescription,
  rule: ProgressionRule | undefined,
  pos: WeekPosition,
  deload: DeloadPolicy = DEFAULT_DELOAD,
): Prescription {
  const p: Prescription = { ...base };
  const r = rule ?? { kind: 'none' };
  const k = pos.loadingIndex;
  if (pos.weekType !== 'deload' && pos.weekType !== 'taper' && pos.weekType !== 'transition') {
    switch (r.kind) {
      case 'rir_wave':
        if (p.rirMin != null) p.rirMin = Math.max(r.floor, p.rirMin - r.step * k);
        if (p.rirMax != null) p.rirMax = Math.max(r.floor, p.rirMax - r.step * k);
        break;
      case 'linear_load':
        if (p.loadKg != null && r.incrementKg)
          p.loadKg = Math.min(r.capKg ?? Infinity, p.loadKg + r.incrementKg * k);
        if (p.loadPct1rm != null && r.incrementPct)
          p.loadPct1rm = Math.min(r.capPct ?? 110, p.loadPct1rm + r.incrementPct * k);
        break;
      case 'add_set':
        if (p.sets != null)
          p.sets = Math.min(r.maxSets, p.sets + Math.floor(k / Math.max(1, r.everyWeeks)));
        break;
      default:
        break;
    }
  }
  if (pos.weekType === 'deload' || pos.weekType === 'taper') {
    if (p.sets != null) p.sets = Math.max(1, p.sets + deload.setsDelta);
    if (p.rirMin != null) p.rirMin = Math.min(10, p.rirMin + deload.rirDelta);
    if (p.rirMax != null) p.rirMax = Math.min(10, p.rirMax + deload.rirDelta);
  }
  return p;
}

// ── Expansion ─────────────────────────────────────────────────────────────────

export interface ExpandedWeek {
  weekIndex: number;
  weekType: WeekType;
  startDate: string | null;
  sessions: (TemplateSession & { date: string | null })[];
}
export interface ExpandedMesocycle extends Omit<TemplateMesocycle, 'weekTypes'> {
  weeks: number;
  microcycles: ExpandedWeek[];
}
export interface ExpandedPhase extends Omit<TemplatePhase, 'mesocycles'> {
  startWeek: number;
  endWeek: number;
  mesocycles: ExpandedMesocycle[];
}
export interface ExpandedPlan {
  totalWeeks: number;
  endDate: string | null;
  phases: ExpandedPhase[];
}

export function expandTemplate(
  def: TemplateDefinition,
  opts: { startDate?: string | null; weekdays?: number[] } = {},
): ExpandedPlan {
  const weekdays = opts.weekdays?.length ? [...opts.weekdays].sort() : null;
  let week = 0;
  const phases: ExpandedPhase[] = def.phases.map((ph) => {
    const startWeek = week + 1;
    const mesocycles = ph.mesocycles.map((m) => {
      const types = m.weekTypes ?? defaultWeekTypes(m.weeks);
      let loading = 0;
      const microcycles: ExpandedWeek[] = types.map((weekType) => {
        week++;
        const pos = { weekType, loadingIndex: loading };
        if (weekType === 'introduction' || weekType === 'progression' || weekType === 'peak')
          loading++;
        const pattern = def.weeks?.find((w) => w.weekIndex === week)?.sessions ?? def.sessions;
        const explicit = !!def.weeks?.find((w) => w.weekIndex === week);
        const dates =
          opts.startDate && weekdays
            ? weekDates(opts.startDate, week, weekdays.slice(0, pattern.length))
            : [];
        return {
          weekIndex: week,
          weekType,
          startDate: opts.startDate ? addDays(opts.startDate, 7 * (week - 1)) : null,
          sessions: pattern.map((s, i) => ({
            ...s,
            date: dates[i] ?? null,
            blocks: s.blocks.map((b) => ({
              ...b,
              exercises: b.exercises.map((e) => ({
                ...e,
                // Explicit weeks were saved with their final values: no progression on top.
                prescription: explicit
                  ? { ...e.prescription }
                  : prescriptionForWeek(e.prescription, e.progression, pos, def.deload),
              })),
            })),
          })),
        };
      });
      const { weekTypes: _w, ...rest } = m;
      void _w;
      return { ...rest, microcycles };
    });
    return { ...ph, startWeek, endWeek: week, mesocycles };
  });
  return {
    totalWeeks: week,
    endDate: opts.startDate ? addDays(opts.startDate, 7 * week - 1) : null,
    phases,
  };
}
