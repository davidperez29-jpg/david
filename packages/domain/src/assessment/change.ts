/**
 * Interpretation of change against measurement error (§11.5). Statistics are standard:
 * SEM = SD × √(1 − ICC); MDC95 = 1.96 × √2 × SEM. Parameters come from reliability data
 * (local test-retest first, then published in a similar population); never "by eye".
 */
import type { BetterDirection } from './aggregate';

const SQRT2_196 = 1.96 * Math.SQRT2;

export interface ReliabilityRow {
  isLocal: boolean;
  icc: number | null;
  cvPercent: number | null;
  sem: number | null;
  /** Unit of `sem`/`mdc95`: the test unit, or '%' when expressed relative to the mean. */
  semUnit: string | null;
  mdc95: number | null;
  swc: number | null;
  measurementMethod: string | null;
  label: string;
}

export interface MeasurementError {
  /** Typical error (SEM) in the test unit. */
  te: number;
  mdc95: number;
  swc: number | null;
  origin: 'local' | 'published';
  basis: string;
  label: string;
}

export function semFromIcc(sdBetween: number, icc: number): number {
  return sdBetween * Math.sqrt(1 - icc);
}
export function mdc95FromSem(sem: number): number {
  return SQRT2_196 * sem;
}

/**
 * Converts a reliability row into an absolute error at the given baseline value.
 * Returns null when the row cannot give an absolute error (e.g. ICC without SD).
 */
export function errorFromReliability(
  row: ReliabilityRow,
  unit: string,
  baseline: number,
): MeasurementError | null {
  const toAbs = (v: number | null, u: string | null) => {
    if (v == null) return null;
    if (u === '%') return (v / 100) * Math.abs(baseline);
    if (!u || u === unit) return v;
    return null;
  };
  let te = toAbs(row.sem, row.semUnit);
  let basis = te != null ? 'SEM publicado' : '';
  if (te == null && row.cvPercent != null) {
    te = (row.cvPercent / 100) * Math.abs(baseline);
    basis = `CV ${row.cvPercent} %`;
  }
  let mdc = toAbs(row.mdc95, row.semUnit);
  if (te == null && mdc != null) {
    te = mdc / SQRT2_196;
    basis = 'MDC95 publicado';
  }
  if (te == null) return null;
  if (mdc == null) mdc = mdc95FromSem(te);
  return {
    te,
    mdc95: mdc,
    swc: toAbs(row.swc, row.semUnit),
    origin: row.isLocal ? 'local' : 'published',
    basis,
    label: row.label,
  };
}

/** Local test-retest beats published data (§11.5); rows that cannot give an absolute error are skipped. */
export function pickMeasurementError(
  rows: ReliabilityRow[],
  unit: string,
  baseline: number,
  method?: string | null,
): MeasurementError | null {
  const ordered = [...rows].sort((a, b) => Number(b.isLocal) - Number(a.isLocal));
  for (const r of ordered) {
    if (method && r.measurementMethod && !sameMethod(method, r.measurementMethod)) continue;
    const e = errorFromReliability(r, unit, baseline);
    if (e) return e;
  }
  return null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
function sameMethod(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.includes(y) || y.includes(x);
}

export type ChangeVerdict =
  | 'unknown_error'
  | 'within_error'
  | 'possible_change'
  | 'probable_improvement'
  | 'probable_decline'
  | 'probable_change';

export const VERDICT_LABELS: Record<ChangeVerdict, string> = {
  unknown_error: 'Error de medida desconocido: se muestra la diferencia sin veredicto',
  within_error: 'Dentro del error de medida',
  possible_change: 'Posible cambio, no confirmado (conviene repetir)',
  probable_improvement: 'Mejora probable',
  probable_decline: 'Empeoramiento probable',
  probable_change: 'Cambio probable',
};

export interface ChangeInterpretation {
  pre: number;
  post: number;
  delta: number;
  deltaPercent: number | null;
  verdict: ChangeVerdict;
  label: string;
  error: MeasurementError | null;
  warnings: string[];
}

const r = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

export function interpretChange(
  pre: number,
  post: number,
  better: BetterDirection,
  error: MeasurementError | null,
): ChangeInterpretation {
  const delta = post - pre;
  const deltaPercent = pre !== 0 ? (delta / Math.abs(pre)) * 100 : null;
  const warnings: string[] = [];
  let verdict: ChangeVerdict;
  if (!error) verdict = 'unknown_error';
  else {
    const abs = Math.abs(delta);
    if (abs < error.te) verdict = 'within_error';
    else if (abs < error.mdc95) verdict = 'possible_change';
    else if (better === 'target_range') verdict = 'probable_change';
    else
      verdict = delta > 0 === (better === 'higher') ? 'probable_improvement' : 'probable_decline';
    if (error.swc != null && error.swc < error.te) {
      warnings.push(
        'Test poco sensible para detectar cambios relevantes en esta persona (el cambio mínimo importante es menor que el error).',
      );
    }
    if (error.origin === 'published')
      warnings.push(
        `Error de medida publicado (${error.label}); la fiabilidad propia del centro sería preferible.`,
      );
  }
  return {
    pre,
    post,
    delta: r(delta),
    deltaPercent: deltaPercent == null ? null : r(deltaPercent, 1),
    verdict,
    label: VERDICT_LABELS[verdict],
    error: error ? { ...error, te: r(error.te), mdc95: r(error.mdc95) } : null,
    warnings,
  };
}

/** Error of a difference of two independent measures (e.g. COD deficit = 505 − 10 m): √(a² + b²). */
export function combineErrors(
  a: MeasurementError | null,
  b: MeasurementError | null,
  label: string,
): MeasurementError | null {
  if (!a || !b) return null;
  const te = Math.sqrt(a.te ** 2 + b.te ** 2);
  return {
    te,
    mdc95: mdc95FromSem(te),
    swc: null,
    origin: a.origin === 'local' && b.origin === 'local' ? 'local' : 'published',
    basis: 'errores combinados',
    label,
  };
}

export type Trend = 'up' | 'down' | 'flat' | 'insufficient';

/** Least-squares slope sign over ≥ 3 points (§11.6: tendencia con ≥ 3 puntos). */
export function trend(points: { t: number; value: number }[], tolerance = 0): Trend {
  if (points.length < 3) return 'insufficient';
  const mt = points.reduce((a, p) => a + p.t, 0) / points.length;
  const mv = points.reduce((a, p) => a + p.value, 0) / points.length;
  const num = points.reduce((a, p) => a + (p.t - mt) * (p.value - mv), 0);
  const den = points.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  if (den === 0) return 'flat';
  const slope = num / den;
  const span = (points[points.length - 1]!.t - points[0]!.t) * slope;
  if (Math.abs(span) <= tolerance) return 'flat';
  return slope > 0 ? 'up' : 'down';
}
