import {
  type AnalysisFilters,
  MAGNITUDE_PARAM_OF,
  PERIOD_PARAM_OF,
  type WeeklyMagnitude,
} from '@/contracts/analysis';
import { type Period } from '@/domain/analysis/period';
import { type Perspective } from '@/domain/analysis/reference';
import { type ExecutedVolume, type Interval } from '@/domain/analysis/session';
import { type PlannedTotals } from '@/domain/analysis/period';
import { type FormulaRef } from '@/domain/measurement';
import { ANALYSIS_FORMULAS } from '@/domain/analysis/session';
import { shortDateText, weekText } from './analysis-copy';

/**
 * Enlaces y textos de A9 y A10 (B3.2). Funciones puras: el estado vive en la URL (se puede
 * enlazar y recargar) y cada enlace conserva lo que no cambia.
 */
export type UrlState = Record<string, string>;

export const REPEAT_DEFAULT = { n: 3, m: 5 } as const;

/** Estado de la URL de un periodo y una perspectiva (lo común de A9 y A10). */
export function periodState(period: Period, perspective: Perspective, today: string): UrlState {
  const state: UrlState = {};
  const kind = PERIOD_PARAM_OF[period.kind];
  if (period.kind === 'range') {
    state.periodo = kind;
    state.desde = period.from;
    state.hasta = period.to;
  } else {
    state.periodo = kind;
    if (period.anchor !== today) state.fecha = period.anchor;
  }
  if (perspective === 'current') state.referencia = 'vigente';
  return state;
}

/** Estado completo de A9. Lo que tiene el valor por defecto no se escribe. */
export function analysisState(input: {
  period: Period;
  perspective: Perspective;
  today: string;
  filters: AnalysisFilters;
}): UrlState {
  const state = periodState(input.period, input.perspective, input.today);
  const f = input.filters;
  if (f.pattern) state.patron = f.pattern;
  if (f.patternMode === 'all') state.patrones = 'todos';
  if (f.variantId) state.ejercicio = f.variantId;
  if (f.repeat.n !== REPEAT_DEFAULT.n || f.repeat.m !== REPEAT_DEFAULT.m) {
    state.n = String(f.repeat.n);
    state.m = String(f.repeat.m);
  }
  if (f.sort === 'asc') state.orden = 'asc';
  if (f.magnitude !== 'sets') state.magnitud = MAGNITUDE_PARAM_OF[f.magnitude];
  return state;
}

/** URL con el estado y los cambios (`null` quita un parámetro). */
export function hrefWith(
  base: string,
  state: UrlState,
  changes: Record<string, string | null> = {},
  hash?: string,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...state, ...changes })) {
    if (value !== null && value !== '') params.set(key, value);
  }
  const query = params.toString();
  return `${base}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

/** Cambios de la URL para ir a otro periodo del mismo tipo. */
export function shiftPeriod(
  period: Period,
  target: Period['previous'],
): Record<string, string | null> {
  return period.kind === 'range'
    ? { desde: target.from, hasta: target.to, fecha: null }
    : { fecha: target.anchor, desde: null, hasta: null };
}

const PERIOD_LABEL: Record<Period['kind'], string> = {
  week: 'Semana',
  weeks4: '4 semanas',
  weeks12: '12 semanas',
  range: 'Rango libre',
};

/** «4 semanas: 2 nov 2026 – 29 nov 2026 (4 semanas ISO)». */
export function periodText(period: Period): string {
  if (period.kind === 'week' && period.weeks.length === 1) return weekText(period.weeks[0]!);
  const n = period.weeks.length;
  return `${PERIOD_LABEL[period.kind]}: ${shortDateText(period.from)} – ${shortDateText(period.to)} (${n} ${n === 1 ? 'semana ISO' : 'semanas ISO'})`;
}

export const periodOptions = (Object.keys(PERIOD_LABEL) as Period['kind'][]).map((kind) => ({
  value: PERIOD_PARAM_OF[kind],
  label: PERIOD_LABEL[kind],
}));

export interface MagnitudeInfo {
  key: WeeklyMagnitude;
  label: string;
  unit: string;
  digits: number;
  executed: FormulaRef;
  planned: FormulaRef;
}

/** Magnitudes del volumen semanal: cada una en su unidad, nunca mezcladas. */
export const MAGNITUDES: readonly MagnitudeInfo[] = [
  {
    key: 'sets',
    label: 'Series hechas',
    unit: 'series',
    digits: 0,
    executed: ANALYSIS_FORMULAS.completedSets,
    planned: ANALYSIS_FORMULAS.prescribedVolume,
  },
  {
    key: 'reps',
    label: 'Repeticiones',
    unit: 'rep.',
    digits: 0,
    executed: ANALYSIS_FORMULAS.totalReps,
    planned: ANALYSIS_FORMULAS.prescribedVolume,
  },
  {
    key: 'tonnage',
    label: 'Tonelaje (nominal)',
    unit: 'kg',
    digits: 1,
    executed: ANALYSIS_FORMULAS.volumeLoad,
    planned: ANALYSIS_FORMULAS.prescribedVolumeLoad,
  },
  {
    key: 'seconds',
    label: 'Tiempo',
    unit: 's',
    digits: 0,
    executed: ANALYSIS_FORMULAS.durationTotal,
    planned: ANALYSIS_FORMULAS.prescribedVolume,
  },
  {
    key: 'meters',
    label: 'Distancia',
    unit: 'm',
    digits: 1,
    executed: ANALYSIS_FORMULAS.distanceTotal,
    planned: ANALYSIS_FORMULAS.prescribedVolume,
  },
  {
    key: 'addedLoad',
    label: 'Lastre (aparte del tonelaje)',
    unit: 'kg',
    digits: 1,
    executed: ANALYSIS_FORMULAS.addedLoadVolume,
    planned: ANALYSIS_FORMULAS.addedLoadVolume,
  },
];

export const magnitudeInfo = (key: WeeklyMagnitude) => MAGNITUDES.find((m) => m.key === key)!;

/** Lo registrado de una magnitud; `null`: no hay series de ese tipo («no aplica»). */
export function executedValue(v: ExecutedVolume, key: WeeklyMagnitude): number | null {
  switch (key) {
    case 'sets':
      return v.sets.reps + v.sets.seconds + v.sets.meters;
    case 'reps':
      return v.reps;
    case 'tonnage':
      return v.tonnageKg;
    case 'seconds':
      return v.seconds;
    case 'meters':
      return v.meters;
    case 'addedLoad':
      return v.addedLoad.kg;
  }
}

/** Lo prescrito de una magnitud (intervalo si hay rangos); `null`: no aplica. */
export function plannedValue(v: PlannedTotals, key: WeeklyMagnitude): Interval | null {
  const single = (n: number | null) => (n === null ? null : { min: n, max: n });
  switch (key) {
    case 'sets':
      return single(v.sets.reps + v.sets.seconds + v.sets.meters);
    case 'reps':
      return v.reps;
    case 'tonnage':
      return v.tonnageKg;
    case 'seconds':
      return single(v.seconds);
    case 'meters':
      return single(v.meters);
    case 'addedLoad':
      return v.addedLoadKg;
  }
}
