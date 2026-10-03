/**
 * Derived metrics registry (§11.1.8: a new test is data; a derived formula is registered here).
 * Each formula declares the test slugs it needs; values are computed from one assessment's results.
 * Estimates are labelled as estimates. Formulas are arithmetic definitions, not empirical equations.
 */
export interface DerivedFormula {
  id: string;
  name: string;
  unit: string;
  /** Test slugs whose results are needed (same assessment). */
  inputs: string[];
  /** Human-readable definition shown next to the value (§7: no black box). */
  definition: string;
  better: 'higher' | 'lower' | 'target_range';
  isEstimate: boolean;
  compute(v: Record<string, number>): number | null;
  /** How the error of the inputs combines (difference/ratio); 'none' → no change verdict. */
  errorModel: 'difference' | 'none';
}

const ok = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

export const DERIVED_FORMULAS: DerivedFormula[] = [
  {
    id: 'bmi',
    name: 'Índice de masa corporal',
    unit: 'kg/m²',
    inputs: ['body_mass', 'height'],
    definition: 'Masa (kg) / talla (m)². Solo contexto: no distingue masa grasa de masa muscular.',
    better: 'target_range',
    isEstimate: false,
    compute: (v) => (v.height! > 0 ? ok(v.body_mass! / (v.height! / 100) ** 2) : null),
    errorModel: 'none',
  },
  {
    id: 'cod_deficit',
    name: 'Déficit de cambio de dirección',
    unit: 's',
    inputs: ['test_505', 'sprint_10m'],
    definition:
      'Tiempo del 505 − tiempo de 10 m en sprint lineal (aísla la capacidad de cambiar de dirección de la velocidad lineal).',
    better: 'lower',
    isEstimate: false,
    compute: (v) => ok(v.test_505! - v.sprint_10m!),
    errorModel: 'difference',
  },
  {
    id: 'relative_strength_1rm',
    name: 'Fuerza relativa en sentadilla (1RM / masa corporal)',
    unit: 'kg/kg',
    inputs: ['one_rm_back_squat', 'body_mass'],
    definition: '1RM en sentadilla trasera (kg) / masa corporal (kg).',
    better: 'higher',
    isEstimate: false,
    compute: (v) => (v.body_mass! > 0 ? ok(v.one_rm_back_squat! / v.body_mass!) : null),
    errorModel: 'none',
  },
  {
    id: 'eccentric_utilization',
    name: 'Relación CMJ / SJ',
    unit: 'ratio',
    inputs: ['cmj_height', 'sj_height'],
    definition:
      'Altura del CMJ / altura del SJ (uso del ciclo de estiramiento-acortamiento). Descriptivo.',
    better: 'target_range',
    isEstimate: false,
    compute: (v) => (v.sj_height! > 0 ? ok(v.cmj_height! / v.sj_height!) : null),
    errorModel: 'none',
  },
];

export function computeDerived(
  values: Record<string, number>,
): { formula: DerivedFormula; value: number; inputs: Record<string, number> }[] {
  const out = [];
  for (const f of DERIVED_FORMULAS) {
    if (!f.inputs.every((i) => values[i] != null && Number.isFinite(values[i]))) continue;
    const value = f.compute(values);
    if (value == null) continue;
    out.push({
      formula: f,
      value,
      inputs: Object.fromEntries(f.inputs.map((i) => [i, values[i]!])),
    });
  }
  return out;
}

/**
 * Inter-limb asymmetry as percentage difference relative to the better side:
 * (better − worse) / better × 100. Descriptive only: never used to predict injury (§11.1.7).
 */
export function asymmetryPercent(
  left: number,
  right: number,
  better: 'higher' | 'lower',
): { value: number; weaker: 'left' | 'right' | 'none' } | null {
  if (left <= 0 || right <= 0) return null;
  if (left === right) return { value: 0, weaker: 'none' };
  const leftBetter = better === 'higher' ? left > right : left < right;
  const best = leftBetter ? left : right;
  const worst = leftBetter ? right : left;
  return {
    value: Math.round((Math.abs(best - worst) / best) * 1000) / 10,
    weaker: leftBetter ? 'right' : 'left',
  };
}
