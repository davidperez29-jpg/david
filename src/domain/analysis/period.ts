import { type PatternAssignment } from '../library/exercise';
import { addDays, daysBetween, type IsoDate, isIsoDate, isoWeekKey, startOfIsoWeek } from '../time';
import { type ExecutionStatusV2 } from '../training/execution';
import { type WeeklyVolume } from '../training/volume';
import { type Comparison } from './compare';
import {
  addExecutedVolumes,
  type ExecutedVolume,
  type Interval,
  type PrescribedVolume,
  type SessionAnalysis,
} from './session';

/**
 * Cliente por periodos (A9, B3.2; docs/BLOCK3_SPEC.md §8 y §9.5). Funciones puras sobre los
 * análisis de cada sesión (`analyzeSession`): nada se guarda.
 *
 * - **Planificado**, por fecha prevista: la de la versión original (P-117) o la vigente, según
 *   la perspectiva (P-118). Si no se puede determinar, «fecha prevista original no determinada»,
 *   aparte: nunca se sustituye por la vigente (P-121).
 * - **Ejecutado**, por fecha de ejecución (la del inicio, en la zona del móvil; P-93).
 * - **Semana ISO** (P-94), con las semanas vacías visibles con cero.
 * - Nunca se suman magnitudes agrupadas por fechas distintas, ni se promedian porcentajes.
 */
export const PERIOD_FORMULAS = {
  weeklyExecuted: { id: 'training.weekly-executed-volume', version: '1.0.0' },
  weeklyPlanned: { id: 'training.weekly-planned-volume', version: '1.0.0' },
  adherence: { id: 'training.session-adherence', version: '1.0.0' },
  durationTotals: { id: 'training.period-duration-totals', version: '1.0.0' },
  patterns: { id: 'training.pattern-set-count', version: '1.0.0' },
  repeated: { id: 'training.repeated-differences', version: '1.0.0' },
} as const;

export type PeriodKind = 'week' | 'weeks4' | 'weeks12' | 'range';

export interface IsoWeek {
  key: string;
  start: IsoDate;
  end: IsoDate;
}

export interface Period {
  kind: PeriodKind;
  from: IsoDate;
  to: IsoDate;
  /** Fecha de referencia (la semana o la última semana del periodo). */
  anchor: IsoDate;
  weeks: IsoWeek[];
  /** Periodo anterior y siguiente del mismo tipo y tamaño. */
  previous: { anchor: IsoDate; from: IsoDate; to: IsoDate };
  next: { anchor: IsoDate; from: IsoDate; to: IsoDate };
}

/** Un rango libre admite como mucho 53 semanas (371 días). */
export const MAX_RANGE_DAYS = 371;

export const isoWeekOf = (date: IsoDate): IsoWeek => {
  const start = startOfIsoWeek(date);
  return { key: isoWeekKey(date), start, end: addDays(start, 6) };
};

function weeksBetween(from: IsoDate, to: IsoDate): IsoWeek[] {
  const weeks: IsoWeek[] = [];
  for (let start = startOfIsoWeek(from); start <= to; start = addDays(start, 7)) {
    weeks.push(isoWeekOf(start));
  }
  return weeks;
}

const WEEKS: Record<Exclude<PeriodKind, 'range'>, number> = { week: 1, weeks4: 4, weeks12: 12 };

function build(kind: PeriodKind, from: IsoDate, to: IsoDate, anchor: IsoDate): Period {
  const days = daysBetween(from, to) + 1;
  const shift = (n: number) => ({
    anchor: addDays(anchor, n),
    from: addDays(from, n),
    to: addDays(to, n),
  });
  return {
    kind,
    from,
    to,
    anchor,
    weeks: weeksBetween(from, to),
    previous: shift(-days),
    next: shift(days),
  };
}

/**
 * Periodo pedido en la URL. Lo que no es válido (un tipo desconocido, una fecha imposible, un
 * rango invertido o de más de 53 semanas) da el periodo por defecto (4 semanas hasta hoy) y
 * `invalid: true`, para avisar en pantalla.
 */
export function resolvePeriod(
  query: { kind?: unknown; date?: unknown; from?: unknown; to?: unknown },
  today: IsoDate,
): { period: Period; invalid: boolean } {
  const fallback = () => {
    const end = isoWeekOf(today).end;
    return build('weeks4', addDays(isoWeekOf(today).start, -21), end, today);
  };
  const kind = query.kind ?? 'weeks4';
  const date = (v: unknown) => (typeof v === 'string' && isIsoDate(v) ? v : null);
  if (kind === 'range') {
    const from = date(query.from);
    const to = date(query.to);
    if (!from || !to || from > to || daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
      return { period: fallback(), invalid: true };
    }
    return { period: build('range', from, to, to), invalid: false };
  }
  if (kind !== 'week' && kind !== 'weeks4' && kind !== 'weeks12') {
    return { period: fallback(), invalid: true };
  }
  const anchor = query.date === undefined ? today : date(query.date);
  if (!anchor) return { period: fallback(), invalid: true };
  const last = isoWeekOf(anchor);
  return {
    period: build(kind, addDays(last.start, -7 * (WEEKS[kind] - 1)), last.end, anchor),
    invalid: false,
  };
}

/**
 * Fecha prevista con la que se planifica una sesión (P-118): la vigente en la perspectiva
 * vigente; en la original, la de la versión original. Si todas las versiones tienen la misma,
 * no hay ambigüedad. `null`: no determinada (P-121).
 */
export function planningDate(a: SessionAnalysis): IsoDate | null {
  if (a.perspective === 'current') return a.plannedDate;
  const dates = new Set(a.versions.map((v) => v.plannedDate));
  if (dates.size === 1) return a.plannedDate;
  if (a.reference.kind !== 'determined') return null;
  const version = a.reference.version;
  return a.versions.find((v) => v.number === version)?.plannedDate ?? null;
}

export interface PeriodSession {
  sessionId: string;
  title: string;
  label: string | null;
  analysis: SessionAnalysis;
}

export interface PlannedTotals {
  sets: { reps: number; seconds: number; meters: number };
  reps: Interval | null;
  repsPerSide: Interval | null;
  seconds: number | null;
  meters: number | null;
  tonnageKg: Interval | null;
  addedLoadKg: Interval | null;
  /** Alguna sesión tiene series sin referencia determinada: lo prescrito está incompleto. */
  incomplete: boolean;
  /** Sesiones cuyas series sin registrar no se pueden enumerar (referencia no determinada). */
  unknownSessions: number;
}

const addI = (a: Interval | null, b: Interval | null): Interval | null =>
  a === null ? b : b === null ? a : { min: round(a.min + b.min), max: round(a.max + b.max) };
const addN = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : round(a + b);
const round = (v: number) => Math.round(v * 1000) / 1000;

export function addPrescribedVolumes(volumes: readonly PrescribedVolume[]): PlannedTotals {
  return volumes.reduce<PlannedTotals>(
    (acc, v) => ({
      sets: {
        reps: acc.sets.reps + v.sets.reps,
        seconds: acc.sets.seconds + v.sets.seconds,
        meters: acc.sets.meters + v.sets.meters,
      },
      reps: addI(acc.reps, v.reps),
      repsPerSide: addI(acc.repsPerSide, v.repsPerSide),
      seconds: addN(acc.seconds, v.seconds),
      meters: addN(acc.meters, v.meters),
      tonnageKg: addI(acc.tonnageKg, v.tonnageKg),
      addedLoadKg: addI(acc.addedLoadKg, v.addedLoadKg),
      incomplete: acc.incomplete || v.unregisteredUnknown,
      unknownSessions: acc.unknownSessions + (v.unregisteredUnknown ? 1 : 0),
    }),
    {
      sets: { reps: 0, seconds: 0, meters: 0 },
      reps: null,
      repsPerSide: null,
      seconds: null,
      meters: null,
      tonnageKg: null,
      addedLoadKg: null,
      incomplete: false,
      unknownSessions: 0,
    },
  );
}

export interface WeekRow {
  week: IsoWeek;
  planned: {
    sessions: number;
    volume: PlannedTotals;
    /** Previstas esta semana y hechas en otra (trasladadas). */
    movedOut: { sessionId: string; title: string; executedOn: IsoDate; executedWeek: string }[];
  };
  executed: {
    sessions: number;
    volume: ExecutedVolume;
    /** Hechas esta semana y previstas en otra (o con fecha prevista no determinada). */
    movedIn: {
      sessionId: string;
      title: string;
      plannedOn: IsoDate | null;
      plannedWeek: string | null;
    }[];
  };
}

export interface SessionRow {
  sessionId: string;
  title: string;
  label: string | null;
  plannedOn: IsoDate | null;
  executedOn: IsoDate | null;
  status: ExecutionStatusV2;
  doneSets: number;
  totalSets: number;
  reps: number | null;
  tonnageKg: number | null;
  addedLoadKg: number | null;
  duration:
    | { kind: 'calculated'; seconds: number; warned: boolean; notices: number }
    | { kind: 'none'; reason: 'not_started' | 'unfinished' | 'incoherent' | 'not_calculable' };
  /** Hecha otro día que el previsto (o con fecha prevista no determinada). */
  moved: boolean;
  referenceUndetermined: boolean;
}

export interface PatternCount {
  patternId: string;
  sets: number;
}

export interface RepeatedDifference {
  variantId: string;
  /** Sesiones con alguna serie fuera de la condición prescrita, entre las consideradas. */
  outside: number;
  considered: number;
  /** En cuántas de esas sesiones, por dimensión. */
  dimensions: { quantity: number; load: number; effort: number };
}

export interface PeriodAnalysis {
  period: Period;
  perspective: SessionAnalysis['perspective'];
  weeks: WeekRow[];
  sessions: SessionRow[];
  /** Sesiones previstas en el periodo (fecha de planificación) y su estado (training.session-adherence). */
  adherence: {
    planned: number;
    byStatus: Record<ExecutionStatusV2, number>;
    /** Previstas en el periodo y hechas otro día. */
    executedOtherDay: number;
  };
  /** Sesiones relevantes sin fecha prevista original determinada (P-121); nunca se agrupan. */
  undeterminedPlanning: { sessionId: string; title: string }[];
  executedTotals: ExecutedVolume;
  /** P-114: total y media de la duración calculada, con y sin las sesiones con advertencia. */
  duration: {
    all: { sessions: number; seconds: number };
    withoutWarned: { sessions: number; seconds: number };
    warned: number;
    notices: number;
    without: { unfinished: number; incoherent: number; notCalculable: number };
  };
  /** P-98: series hechas por patrón, «solo principal» y «principal y secundarios». */
  patterns: { doneSets: number; primary: PatternCount[]; all: PatternCount[]; unknown: number };
  exercises: { variantId: string; sessions: number; doneSets: number }[];
  /** P-104: lista descriptiva, sin alertas, por orden alfabético en la pantalla. */
  repeated: RepeatedDifference[];
  missing: {
    unfinished: number;
    unregisteredSets: number;
    notDoneSets: number;
    effortNoData: number;
    loadNoData: number;
    notComparable: number;
    notEvaluable: number;
    referenceUndetermined: number;
    adjustedTimes: number;
    outsideReference: number;
    proposal: { equal: number; done: number };
  };
}

const STATUSES: readonly ExecutionStatusV2[] = [
  'planned',
  'overdue',
  'in_progress',
  'paused',
  'interrupted',
  'completed',
  'partial',
];
const DIFFERENT = new Set<Comparison['condition']>(['differs', 'below', 'above']);
const inRange = (date: IsoDate | null, period: Period) =>
  date !== null && date >= period.from && date <= period.to;

function durationOf(a: SessionAnalysis): SessionRow['duration'] {
  const d = a.duration;
  if (d.state.kind === 'calculated') {
    return {
      kind: 'calculated',
      seconds: d.state.calculatedSeconds,
      warned: d.gaps.some((g) => g.level === 'warning' || g.level === 'not_evaluable'),
      notices: d.gaps.filter((g) => g.level === 'notice').length,
    };
  }
  return { kind: 'none', reason: d.state.kind };
}

export function analyzePeriod(input: {
  period: Period;
  sessions: readonly PeriodSession[];
  /** Patrones de una variante de la biblioteca; `null` si la variante no está en ella. */
  patternsOf: (variantId: string) => readonly PatternAssignment[] | null;
  repeat: { n: number; m: number };
}): PeriodAnalysis {
  const { period } = input;
  const entries = input.sessions.map((s) => ({
    ...s,
    plannedOn: planningDate(s.analysis),
    executedOn: s.analysis.executedOn,
  }));
  const relevant = entries.filter(
    (e) =>
      inRange(e.plannedOn, period) ||
      inRange(e.executedOn, period) ||
      (e.plannedOn === null && e.analysis.versions.some((v) => inRange(v.plannedDate, period))),
  );
  const planned = relevant.filter((e) => inRange(e.plannedOn, period));
  const executed = relevant
    .filter((e) => inRange(e.executedOn, period))
    .sort(
      (a, b) =>
        a.executedOn!.localeCompare(b.executedOn!) || a.sessionId.localeCompare(b.sessionId),
    );

  const weeks: WeekRow[] = period.weeks.map((week) => {
    const inWeek = (d: IsoDate | null) => d !== null && d >= week.start && d <= week.end;
    const p = planned.filter((e) => inWeek(e.plannedOn));
    const x = executed.filter((e) => inWeek(e.executedOn));
    return {
      week,
      planned: {
        sessions: p.length,
        volume: addPrescribedVolumes(p.map((e) => e.analysis.prescribed)),
        movedOut: p
          .filter((e) => e.executedOn !== null && !inWeek(e.executedOn))
          .map((e) => ({
            sessionId: e.sessionId,
            title: e.title,
            executedOn: e.executedOn!,
            executedWeek: isoWeekKey(e.executedOn!),
          })),
      },
      executed: {
        sessions: x.length,
        volume: addExecutedVolumes(x.map((e) => e.analysis.executed)),
        movedIn: x
          .filter((e) => !inWeek(e.plannedOn))
          .map((e) => ({
            sessionId: e.sessionId,
            title: e.title,
            plannedOn: e.plannedOn,
            plannedWeek: e.plannedOn ? isoWeekKey(e.plannedOn) : null,
          })),
      },
    };
  });

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    ExecutionStatusV2,
    number
  >;
  for (const e of planned) byStatus[e.analysis.status] += 1;

  const durations = executed.map((e) => durationOf(e.analysis));
  const calculated = durations.filter(
    (d): d is Extract<SessionRow['duration'], { kind: 'calculated' }> => d.kind === 'calculated',
  );
  const none = durations.filter(
    (d): d is Extract<SessionRow['duration'], { kind: 'none' }> => d.kind === 'none',
  );
  const sum = (list: { seconds: number }[]) => list.reduce((n, d) => n + d.seconds, 0);

  // Patrones (P-98) y ejercicios, sobre las series hechas de lo ejecutado en el periodo.
  const primary = new Map<string, number>();
  const all = new Map<string, number>();
  const exercises = new Map<string, { sessions: Set<string>; doneSets: number }>();
  let doneSets = 0;
  let unknown = 0;
  for (const e of executed) {
    for (const exercise of e.analysis.exercises) {
      for (const set of exercise.sets) {
        if (set.status !== 'done') continue;
        doneSets += 1;
        const entry = exercises.get(set.variantId) ?? { sessions: new Set(), doneSets: 0 };
        entry.sessions.add(e.sessionId);
        entry.doneSets += 1;
        exercises.set(set.variantId, entry);
        const patterns = input.patternsOf(set.variantId);
        if (!patterns || patterns.length === 0) {
          unknown += 1;
          continue;
        }
        for (const p of patterns) {
          all.set(p.id, (all.get(p.id) ?? 0) + 1);
          if (p.role === 'primary') primary.set(p.id, (primary.get(p.id) ?? 0) + 1);
        }
      }
    }
  }
  const counts = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([patternId, sets]) => ({ patternId, sets }))
      .sort((a, b) => b.sets - a.sets || a.patternId.localeCompare(b.patternId));

  // Diferencias repetidas (P-104): por variante, las últimas M sesiones del periodo con series hechas.
  const repeated: RepeatedDifference[] = [];
  for (const variantId of exercises.keys()) {
    const history = executed
      .map((e) => {
        const sets = e.analysis.exercises.flatMap((x) =>
          x.sets.filter((s) => s.variantId === variantId && s.status === 'done'),
        );
        if (sets.length === 0) return null;
        const has = (pick: (s: (typeof sets)[number]) => (Comparison | null)[]) =>
          sets.some((s) => pick(s).some((c) => c !== null && DIFFERENT.has(c.condition)));
        return {
          quantity: has((s) => [s.quantity]),
          load: has((s) => [s.load]),
          effort: has((s) => s.effort),
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null)
      .slice(-input.repeat.m);
    const outside = history.filter((h) => h.quantity || h.load || h.effort);
    if (outside.length >= input.repeat.n) {
      repeated.push({
        variantId,
        outside: outside.length,
        considered: history.length,
        dimensions: {
          quantity: outside.filter((h) => h.quantity).length,
          load: outside.filter((h) => h.load).length,
          effort: outside.filter((h) => h.effort).length,
        },
      });
    }
  }

  // Datos ausentes y advertencias de las sesiones del periodo.
  const sets = relevant.flatMap((e) => e.analysis.exercises.flatMap((x) => x.sets));
  const comparisons = sets
    .flatMap((s) => [s.quantity, s.load, ...s.effort])
    .filter((c): c is Comparison => c !== null);
  const missing: PeriodAnalysis['missing'] = {
    unfinished: executed.filter((e) =>
      ['in_progress', 'paused', 'interrupted'].includes(e.analysis.status),
    ).length,
    unregisteredSets: relevant.reduce(
      (n, e) => n + e.analysis.profile.structural.sets.unregistered,
      0,
    ),
    notDoneSets: relevant.reduce((n, e) => n + e.analysis.profile.structural.sets.notDone, 0),
    effortNoData: sets.flatMap((s) => s.effort).filter((c) => c.condition === 'no_data').length,
    loadNoData: sets.filter((s) => s.load?.condition === 'no_data').length,
    notComparable: comparisons.filter((c) => c.condition === 'not_comparable').length,
    notEvaluable: comparisons.filter((c) => c.condition === 'not_evaluable').length,
    referenceUndetermined: relevant.filter(
      (e) => e.analysis.reference.kind === 'undetermined' && e.analysis.status !== 'planned',
    ).length,
    adjustedTimes: relevant.filter((e) => e.analysis.duration.anyAdjusted).length,
    outsideReference: relevant.reduce((n, e) => n + e.analysis.outsideReferenceSets, 0),
    proposal: {
      equal: executed.reduce((n, e) => n + e.analysis.profile.proposal.equal, 0),
      done: executed.reduce((n, e) => n + e.analysis.profile.proposal.done, 0),
    },
  };

  const rows: SessionRow[] = relevant.map((e) => {
    const a = e.analysis;
    const structural = a.profile.structural.sets;
    return {
      sessionId: e.sessionId,
      title: e.title,
      label: e.label,
      plannedOn: e.plannedOn,
      executedOn: e.executedOn,
      status: a.status,
      doneSets: structural.done,
      totalSets: structural.total,
      reps: a.executed.reps,
      tonnageKg: a.executed.tonnageKg,
      addedLoadKg: a.executed.addedLoad.kg,
      duration: durationOf(a),
      moved: e.executedOn !== null && e.plannedOn !== e.executedOn,
      referenceUndetermined: a.reference.kind === 'undetermined',
    };
  });

  return {
    period,
    perspective: input.sessions[0]?.analysis.perspective ?? 'original',
    weeks,
    sessions: rows,
    adherence: {
      planned: planned.length,
      byStatus,
      executedOtherDay: planned.filter((e) => e.executedOn !== null && e.executedOn !== e.plannedOn)
        .length,
    },
    undeterminedPlanning: relevant
      .filter((e) => e.plannedOn === null)
      .map((e) => ({ sessionId: e.sessionId, title: e.title })),
    executedTotals: addExecutedVolumes(executed.map((e) => e.analysis.executed)),
    duration: {
      all: { sessions: calculated.length, seconds: sum(calculated) },
      withoutWarned: {
        sessions: calculated.filter((d) => !d.warned).length,
        seconds: sum(calculated.filter((d) => !d.warned)),
      },
      warned: calculated.filter((d) => d.warned).length,
      notices: calculated.filter((d) => !d.warned && d.notices > 0).length,
      without: {
        unfinished: none.filter((d) => d.reason === 'unfinished').length,
        incoherent: none.filter((d) => d.reason === 'incoherent').length,
        notCalculable: none.filter((d) => d.reason === 'not_calculable').length,
      },
    },
    patterns: { doneSets, primary: counts(primary), all: counts(all), unknown },
    exercises: [...exercises.entries()].map(([variantId, x]) => ({
      variantId,
      sessions: x.sessions.size,
      doneSets: x.doneSets,
    })),
    repeated,
    missing,
  };
}

/**
 * P-106 · Volumen semanal de las vistas de la Fase 1 («Carga», «Resultados» y «Progreso»), con
 * la misma forma de antes pero calculado como el análisis: por **fecha de ejecución**, con
 * `training.total-reps` 2.0.0 y `training.volume-load` 2.0.0 y cada serie frente a su versión.
 * Todas las semanas del rango aparecen, también las vacías.
 */
export const PHASE1_VOLUME_FORMULAS = {
  completedSets: { id: 'training.completed-sets', version: '1.0.0' },
  totalReps: { id: 'training.total-reps', version: '2.0.0' },
  volumeLoad: { id: 'training.volume-load', version: '2.0.0' },
  weeklyExecuted: { id: 'training.weekly-executed-volume', version: '1.0.0' },
} as const;

export function executedWeeklyVolume(
  entries: readonly { executedOn: IsoDate; executed: ExecutedVolume }[],
  range: { from: IsoDate; to: IsoDate },
): WeeklyVolume[] {
  return weeksBetween(range.from, range.to).map((week) => {
    const inWeek = entries.filter(
      (e) =>
        e.executedOn >= week.start &&
        e.executedOn <= week.end &&
        e.executedOn >= range.from &&
        e.executedOn <= range.to,
    );
    const volume = addExecutedVolumes(inWeek.map((e) => e.executed));
    const completedSets = volume.sets.reps + volume.sets.seconds + volume.sets.meters;
    return {
      week: week.key,
      weekStart: week.start,
      sessions: inWeek.filter(
        (e) => e.executed.sets.reps + e.executed.sets.seconds + e.executed.sets.meters > 0,
      ).length,
      completedSets,
      totalReps: volume.reps ?? 0,
      volumeLoadKg: volume.tonnageKg ?? 0,
      setsWithoutExternalLoad: completedSets - volume.tonnageSets,
    };
  });
}
