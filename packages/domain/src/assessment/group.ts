/**
 * Group (team) statistics and normalization (restructure phase 4, docs/EVALUATION_SYSTEM.md §3),
 * reproducing the club workbook: N, mean, sample SD (n − 1, «DESVEST.M»), maximum, minimum, best
 * and worst by the test's direction, and Z against the team with the sign corrected so that a
 * positive Z is always better («STANDARDIZE(x; media; DESVEST) × −1» for «lower is better»).
 */
import { mean, sd } from './aggregate';

export type Direction = 'higher' | 'lower' | 'target_range';

export interface GroupStats {
  n: number;
  mean: number | null;
  /** Sample SD (n − 1); null with fewer than 2 values. */
  sd: number | null;
  max: number | null;
  min: number | null;
}

export function groupStats(values: (number | null | undefined)[]): GroupStats {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  return {
    n: xs.length,
    mean: xs.length ? mean(xs) : null,
    sd: xs.length >= 2 ? sd(xs) : null,
    max: xs.length ? Math.max(...xs) : null,
    min: xs.length ? Math.min(...xs) : null,
  };
}

/**
 * Index of the best and worst member by direction (first one on ties, like INDEX/MATCH).
 * Descriptive tests (`target_range`: height, mass, BMI) have no best or worst.
 */
export function bestAndWorst(
  values: (number | null | undefined)[],
  direction: Direction,
): { best: number; worst: number } | null {
  if (direction === 'target_range') return null;
  let best = -1;
  let worst = -1;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    const better = (a: number, b: number) => (direction === 'higher' ? a > b : a < b);
    if (best < 0 || better(v, values[best]!)) best = i;
    if (worst < 0 || better(values[worst]!, v)) worst = i;
  });
  return best < 0 ? null : { best, worst };
}

/** Sign that makes «outwards» better: +1 for higher, −1 for lower, 0 for target ranges. */
export const directionSign = (d: Direction): 1 | -1 | 0 =>
  d === 'higher' ? 1 : d === 'lower' ? -1 : 0;

/** Minimum group size for Z against the team without a warning (EVALUATION_SYSTEM §3). */
export const MIN_GROUP_FOR_Z = 5;

/**
 * Z of each value against the group (sample SD), sign-corrected. Null where there is no value,
 * when the group has fewer than 2 values or no spread, and for target-range tests.
 */
export function zAgainstGroup(
  values: (number | null | undefined)[],
  direction: Direction,
): (number | null)[] {
  const s = groupStats(values);
  const sign = directionSign(direction);
  return values.map((v) =>
    v == null || !Number.isFinite(v) || s.sd == null || s.sd === 0 || sign === 0
      ? null
      : ((v - s.mean!) / s.sd) * sign,
  );
}

/** Z against a reference with mean and SD (sign-corrected); null without a usable reference. */
export function zAgainstReference(
  value: number,
  ref: { mean: number; sd: number },
  direction: Direction,
): number | null {
  const sign = directionSign(direction);
  if (!(ref.sd > 0) || sign === 0) return null;
  return ((value - ref.mean) / ref.sd) * sign;
}

/** Percentage of a reference: value/ref, or ref/value when lower is better (×100). */
export function percentOfReference(
  value: number,
  ref: number,
  direction: Direction,
): number | null {
  if (!(value > 0) || !(ref > 0) || direction === 'target_range') return null;
  return (direction === 'lower' ? ref / value : value / ref) * 100;
}

export type Band = 'destacado' | 'en_la_media' | 'a_mejorar';
export const BAND_LABELS: Record<Band, string> = {
  destacado: 'Destacado',
  en_la_media: 'En la media',
  a_mejorar: 'A mejorar',
};

/**
 * Reading of a sign-corrected Z: > +1 «Destacado», −1…+1 «En la media», < −1 «A mejorar»
 * (the club workbook's traffic lights). The text is always generated from the band, so a Z of
 * +2,3 can never be described as «sin superar +1 DT».
 */
export function bandOf(z: number | null, threshold = 1): Band | null {
  if (z == null || !Number.isFinite(z)) return null;
  return z > threshold ? 'destacado' : z < -threshold ? 'a_mejorar' : 'en_la_media';
}

/** Z shown on a radar: clipped to ±3; the real value stays in the table. */
export const clipZ = (z: number, limit = 3) => Math.max(-limit, Math.min(limit, z));

export type Flag = 'fuera_de_limites' | 'atipico';

/**
 * Values to confirm before trusting them («confirmar medición»); the original value is kept:
 * - outside the test's plausible limits, when it has them;
 * - atypical in the group: more than 3 SD from the mean of the *other* members (leave-one-out,
 *   so an extreme value does not hide itself by inflating the SD); needs 5 other values.
 */
export function measurementFlags(
  values: (number | null | undefined)[],
  limits?: { min?: number | null; max?: number | null },
  k = 3,
): (Flag | null)[] {
  return values.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return null;
    if ((limits?.min != null && v < limits.min) || (limits?.max != null && v > limits.max))
      return 'fuera_de_limites';
    const others = values.filter((x, j): x is number => j !== i && x != null && Number.isFinite(x));
    if (others.length < 5) return null;
    const s = sd(others);
    if (!(s > 0)) return null;
    return Math.abs(v - mean(others)) / s > k ? 'atipico' : null;
  });
}
