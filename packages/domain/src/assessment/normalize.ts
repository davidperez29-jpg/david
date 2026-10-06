/**
 * Normalization chain (restructure phase 5, docs/EVALUATION_SYSTEM.md §3–§4): from a result in
 * its own unit to a score that can share an axis with other tests, and from tests to radar
 * dimensions. Pure functions; no unit is ever mixed with another on the same scale.
 *
 *   result → direction (lower is better → sign flipped) → scale → dimension (weighted mean)
 *
 * Scales: Z against a reference (mean ± SD of a population), Z against the group, percentile
 * (in the group or in a reference table) and % of a reference. Missing data is a gap (null),
 * never a zero.
 */
import { clipZ, directionSign, type Direction } from './group';
import { mean, sd } from './aggregate';

export type Scale = 'z_reference' | 'z_group' | 'percentile' | 'percent_reference';

export const SCALE_LABELS: Record<Scale, string> = {
  z_reference: 'Z frente a la referencia',
  z_group: 'Z frente al grupo',
  percentile: 'Percentil en el grupo',
  percent_reference: '% de la referencia',
};

/** What a score is compared against, already chosen and checked as applicable. */
export type Basis =
  | { scale: 'z_reference'; mean: number; sd: number }
  | { scale: 'z_group'; values: number[] }
  | { scale: 'percentile'; values: number[] }
  | { scale: 'percent_reference'; reference: number };

/**
 * Score of one value on a scale, oriented so that higher is always better. Null when the test
 * has no direction (target range), the basis is unusable (SD 0, fewer than 2 group values, a
 * reference of 0) or the value is missing.
 * - Z scales: sign-corrected Z (0 = reference or group mean).
 * - percentile: mid-rank percentile among the group (0–100), counting ties as half.
 * - percent_reference: value / ref × 100, or ref / value × 100 when lower is better.
 */
export function scoreOf(
  value: number | null | undefined,
  direction: Direction,
  basis: Basis,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = directionSign(direction);
  if (sign === 0) return null;
  switch (basis.scale) {
    case 'z_reference':
      return basis.sd > 0 ? ((value - basis.mean) / basis.sd) * sign : null;
    case 'z_group': {
      const xs = basis.values.filter(Number.isFinite);
      if (xs.length < 2) return null;
      const s = sd(xs);
      return s > 0 ? ((value - mean(xs)) / s) * sign : null;
    }
    case 'percentile': {
      const xs = basis.values.filter(Number.isFinite);
      if (!xs.length) return null;
      const worse = xs.filter((x) => (sign > 0 ? x < value : x > value)).length;
      const ties = xs.filter((x) => x === value).length;
      return ((worse + ties / 2) / xs.length) * 100;
    }
    case 'percent_reference': {
      if (!(basis.reference > 0) || !(value > 0)) return null;
      return (sign > 0 ? value / basis.reference : basis.reference / value) * 100;
    }
  }
}

/** Neutral point of each scale: the reference or the group (Z 0, P50, 100 %). */
export const NEUTRAL: Record<Scale, number> = {
  z_reference: 0,
  z_group: 0,
  percentile: 50,
  percent_reference: 100,
};

/** Drawing range of each scale; real values stay in the table (Z clipped to ±3). */
export const SCALE_RANGE: Record<Scale, [number, number]> = {
  z_reference: [-3, 3],
  z_group: [-3, 3],
  percentile: [0, 100],
  percent_reference: [50, 150],
};

/** A score clipped to the drawing range of its scale. */
export function clipScore(score: number, scale: Scale): number {
  const [lo, hi] = SCALE_RANGE[scale];
  if (scale === 'z_reference' || scale === 'z_group') return clipZ(score, hi);
  return Math.max(lo, Math.min(hi, score));
}

/** Position 0…1 of a score on the radar's radius (0 = centre). */
export function radius(score: number, scale: Scale): number {
  const [lo, hi] = SCALE_RANGE[scale];
  return (clipScore(score, scale) - lo) / (hi - lo);
}

// ── Dimensions ────────────────────────────────────────────────────────────────

export interface RadarDimension {
  key: string;
  name: string;
  /** Tests or derived formulas (slugs) with their weight in the dimension. */
  items: { slug: string; weight: number }[];
}

/**
 * Score of a dimension: weighted mean of the scores of its items that have one. Items without a
 * score do not count (and are reported), so a missing test never drags the dimension to zero;
 * with no item scored, the dimension is a gap.
 */
export function dimensionScore(items: { slug: string; weight: number; score: number | null }[]): {
  score: number | null;
  used: string[];
  missing: string[];
} {
  const used = items.filter((i) => i.score != null && Number.isFinite(i.score) && i.weight > 0);
  const missing = items.filter((i) => !used.includes(i)).map((i) => i.slug);
  const w = used.reduce((a, i) => a + i.weight, 0);
  return {
    score: w > 0 ? used.reduce((a, i) => a + i.weight * i.score!, 0) / w : null,
    used: used.map((i) => i.slug),
    missing,
  };
}

/**
 * Default dimension sets (docs/EVALUATION_SYSTEM.md §4). The client's profile proposes one; the
 * trainer can pick other dimensions. Items absent in an assessment are simply not used.
 */
export const DIMENSION_SETS: Record<'performance' | 'health', RadarDimension[]> = {
  performance: [
    {
      key: 'fuerza',
      name: 'Fuerza',
      items: [
        { slug: 'imtp_relative', weight: 2 },
        { slug: 'relative_strength_1rm', weight: 2 },
        { slug: 'imtp_peak_force', weight: 1 },
        { slug: 'one_rm_back_squat', weight: 1 },
      ],
    },
    {
      key: 'potencia',
      name: 'Potencia',
      items: [
        { slug: 'cmj_height', weight: 2 },
        { slug: 'sj_height', weight: 1 },
      ],
    },
    {
      key: 'reactividad',
      name: 'Reactividad',
      items: [
        { slug: 'drop_jump_rsi', weight: 2 },
        { slug: 'rsi_modified', weight: 1 },
      ],
    },
    {
      key: 'aceleracion',
      name: 'Aceleración',
      items: [
        { slug: 'sprint_5m', weight: 1 },
        { slug: 'sprint_10m', weight: 1 },
      ],
    },
    {
      key: 'velocidad',
      name: 'Velocidad',
      items: [
        { slug: 'sprint_30m', weight: 2 },
        { slug: 'sprint_20m', weight: 1 },
        { slug: 'max_sprint_speed', weight: 2 },
      ],
    },
    {
      key: 'cod',
      name: 'Cambio de dirección',
      items: [
        { slug: 'test_505', weight: 2 },
        { slug: 'modified_agility_t_test', weight: 1 },
        { slug: 't_test', weight: 1 },
        { slug: 'illinois_agility_test', weight: 1 },
        { slug: 'dribbling', weight: 1 },
      ],
    },
    {
      key: 'resistencia',
      name: 'Resistencia',
      items: [
        { slug: 'ift_30_15', weight: 2 },
        { slug: 'yo_yo_ir1', weight: 2 },
        { slug: 'cooper_test', weight: 1 },
      ],
    },
    {
      key: 'composicion',
      name: 'Composición corporal',
      items: [
        { slug: 'sum_6_skinfolds', weight: 2 },
        { slug: 'body_fat_faulkner', weight: 1 },
      ],
    },
  ],
  health: [
    {
      key: 'fuerza_funcional',
      name: 'Fuerza funcional',
      items: [
        { slug: 'handgrip_strength', weight: 1 },
        { slug: 'chair_stand_30s', weight: 1 },
      ],
    },
    {
      key: 'potencia_funcional',
      name: 'Potencia',
      items: [
        { slug: 'five_times_sit_to_stand', weight: 1 },
        { slug: 'cmj_height', weight: 1 },
      ],
    },
    {
      key: 'movilidad',
      name: 'Movilidad',
      items: [
        { slug: 'weight_bearing_lunge_distance', weight: 1 },
        { slug: 'sit_and_reach', weight: 1 },
        { slug: 'hip_flexion_rom', weight: 1 },
      ],
    },
    {
      key: 'equilibrio',
      name: 'Equilibrio',
      items: [
        { slug: 'unipedal_stance_eyes_open', weight: 1 },
        { slug: 'unipedal_stance_eyes_closed', weight: 1 },
      ],
    },
    {
      key: 'resistencia_aerobica',
      name: 'Resistencia',
      items: [
        { slug: 'six_minute_walk_test', weight: 2 },
        { slug: 'cooper_test', weight: 1 },
      ],
    },
    {
      key: 'capacidad_funcional',
      name: 'Capacidad funcional',
      items: [
        { slug: 'sppb', weight: 2 },
        { slug: 'timed_up_and_go', weight: 1 },
        { slug: 'gait_speed', weight: 1 },
      ],
    },
  ],
};

/** Every dimension of the default sets, by key (the trainer may mix them). */
export const ALL_DIMENSIONS: RadarDimension[] = [
  ...DIMENSION_SETS.performance,
  ...DIMENSION_SETS.health,
];
