/**
 * Plan structure (§12.1) and template expansion (§12.2–12.3). Pure: given a template definition,
 * a start date and the client's weekdays, it produces the full tree with dates and the
 * prescription of every week after applying the declarative progression rules (§12.7).
 * No periodization model is imposed: the template decides phases, mesocycles and week types.
 */
import { DomainError } from '../shared/errors';
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
  /** Stable id for editing the template in the table (not copied to plans). */
  id?: string;
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
  id?: string;
  type: string;
  organization?: string;
  label?: string;
  rounds?: number;
  restBetweenRoundsS?: number;
  notes?: string;
  exercises: TemplateExercise[];
}
export interface TemplateSession {
  id?: string;
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
  /** Weekly pattern of this phase (block periodization); otherwise the template's `sessions`. */
  sessions?: TemplateSession[];
}
export type PlanDuration = (typeof PLAN_DURATIONS)[number];

export interface TemplateDefinition {
  durationMonths: PlanDuration;
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
  def.phases.forEach((p, i) => {
    const n = p.sessionsPerWeek ?? def.sessionsPerWeek;
    if (p.sessions && p.sessions.length !== n)
      out.push({
        path: `phases.${i}.sessions`,
        message: `La fase «${p.name}» define ${p.sessions.length} sesiones pero tiene ${n} por semana.`,
      });
  });
  return out;
}

/** Every session pattern of a template: the default one, each phase's and explicit weeks. */
export function templateSessions(def: TemplateDefinition): TemplateSession[] {
  return [
    ...def.sessions,
    ...def.phases.flatMap((p) => p.sessions ?? []),
    ...(def.weeks ?? []).flatMap((w) => w.sessions),
  ];
}

/** Exercise references (slug or id) used anywhere in the template, without repetitions. */
export function templateExerciseRefs(def: TemplateDefinition): string[] {
  return [
    ...new Set(
      templateSessions(def).flatMap((s) =>
        s.blocks.flatMap((b) => b.exercises.map((e) => e.exercise)),
      ),
    ),
  ];
}

/**
 * Gives every session, block and exercise an id (kept when present) so the template can be
 * edited row by row in the table. Pure: returns a new definition.
 */
export function withEditorIds(def: TemplateDefinition, newId: () => string): TemplateDefinition {
  const session = (s: TemplateSession): TemplateSession => ({
    ...s,
    id: s.id ?? newId(),
    blocks: s.blocks.map((b) => ({
      ...b,
      id: b.id ?? newId(),
      exercises: b.exercises.map((e) => ({ ...e, id: e.id ?? newId() })),
    })),
  });
  return {
    ...def,
    sessions: def.sessions.map(session),
    phases: def.phases.map((p) => (p.sessions ? { ...p, sessions: p.sessions.map(session) } : p)),
    ...(def.weeks
      ? { weeks: def.weeks.map((w) => ({ ...w, sessions: w.sessions.map(session) })) }
      : {}),
  };
}

const RESTING: WeekType[] = ['deload', 'test', 'taper', 'transition'];

/** Week types of a mesocycle shortened to `weeks`: keeps a closing deload/test week when there is room. */
function shortenTypes(types: WeekType[], weeks: number): WeekType[] {
  if (weeks >= types.length) return types;
  const last = types[types.length - 1]!;
  return RESTING.includes(last) && weeks >= 3
    ? [...types.slice(0, weeks - 1), last]
    : types.slice(0, weeks);
}

/** A shortened mesocycle needs at least this many weeks; a shorter tail is left out. */
export const MIN_SHORTENED_MESOCYCLE = 3;

/**
 * The template for the duration chosen when it is used (3, 6, 9 or 12 months; restructure phase 3,
 * decision A17). Phases are taken in order; if the template is shorter, they repeat as new cycles
 * («ciclo 2»). The last mesocycle is shortened to fit, but never below 3 weeks: the plan may end up
 * to 2 weeks before the end of the duration rather than carry a 1–2 week stub. A template with
 * explicit weeks (saved from a real plan) keeps its own content: it can be shortened, not extended.
 */
export function fitToDuration(def: TemplateDefinition, months: PlanDuration): TemplateDefinition {
  const target = weeksFor(months);
  const baseWeeks = def.phases.reduce(
    (a, p) => a + p.mesocycles.reduce((b, m) => b + m.weeks, 0),
    0,
  );
  if (baseWeeks < 1) return { ...def, durationMonths: months };
  if (def.weeks?.length && target > baseWeeks)
    throw new DomainError(
      'validation',
      `Esta plantilla se guardó desde un plan real de ${baseWeeks} semanas: puede acortarse, pero no alargarse.`,
      { durationMonths: ['too_long_for_explicit_weeks'] },
    );
  const phases: TemplatePhase[] = [];
  let used = 0;
  let done = false;
  for (let cycle = 1; !done; cycle++) {
    for (const ph of def.phases) {
      const mesocycles: TemplateMesocycle[] = [];
      for (const m of ph.mesocycles) {
        const left = target - used;
        if (left <= 0 || (m.weeks > left && left < MIN_SHORTENED_MESOCYCLE)) {
          done = true;
          break;
        }
        const weeks = Math.min(m.weeks, left);
        mesocycles.push(
          weeks === m.weeks
            ? m
            : {
                ...m,
                weeks,
                ...(m.weekTypes ? { weekTypes: shortenTypes(m.weekTypes, weeks) } : {}),
              },
        );
        used += weeks;
      }
      if (mesocycles.length)
        phases.push({
          ...ph,
          name: cycle > 1 ? `${ph.name} (ciclo ${cycle})` : ph.name,
          mesocycles,
        });
      if (done) break;
    }
  }
  return {
    ...def,
    durationMonths: months,
    phases,
    ...(def.weeks ? { weeks: def.weeks.filter((w) => w.weekIndex <= used) } : {}),
  };
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
        const pattern =
          def.weeks?.find((w) => w.weekIndex === week)?.sessions ?? ph.sessions ?? def.sessions;
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
