/**
 * Default derived formulas (restructure phase 4): data for the formula engine (`formulas.ts`),
 * seeded as the platform's catalogue. A centre edits the constants of its own copy (the club
 * workbook's «constantes editables»); the definition shown always carries the constants used.
 * Equations taken from the user's documents keep «[REQUIERE VERIFICACIÓN]» until checked.
 */
import { compileFormulas, evaluateFormulas, type FormulaDef } from './formulas';

const SKINFOLDS_6 = [
  'skinfold_triceps',
  'skinfold_subscapular',
  'skinfold_iliac_crest',
  'skinfold_abdominal',
  'skinfold_front_thigh',
  'skinfold_medial_calf',
];

export const DEFAULT_FORMULAS: FormulaDef[] = [
  {
    slug: 'bmi',
    name: 'Índice de masa corporal',
    unit: 'kg/m²',
    expression: 'body_mass / (height / 100) ^ 2',
    constants: {},
    better: 'target_range',
    isEstimate: false,
    errorModel: 'none',
    definition: 'Masa (kg) / talla (m)². Solo contexto: no distingue masa grasa de masa muscular.',
  },
  {
    slug: 'cod_deficit',
    name: 'Déficit de cambio de dirección',
    unit: 's',
    expression: 'test_505 - sprint_10m',
    constants: {},
    better: 'lower',
    isEstimate: false,
    errorModel: 'difference',
    definition:
      'Tiempo del 505 − tiempo de 10 m en sprint lineal (aísla la capacidad de cambiar de dirección de la velocidad lineal).',
  },
  {
    slug: 'relative_strength_1rm',
    name: 'Fuerza relativa en sentadilla (1RM / masa corporal)',
    unit: 'kg/kg',
    expression: 'one_rm_back_squat / body_mass',
    constants: {},
    better: 'higher',
    isEstimate: false,
    errorModel: 'none',
    definition: '1RM en sentadilla trasera (kg) / masa corporal (kg).',
  },
  {
    slug: 'eccentric_utilization',
    name: 'Relación CMJ / SJ',
    unit: 'ratio',
    expression: 'cmj_height / sj_height',
    constants: {},
    better: 'target_range',
    isEstimate: false,
    errorModel: 'none',
    definition:
      'Altura del CMJ / altura del SJ (uso del ciclo de estiramiento-acortamiento). Descriptivo.',
  },
  {
    slug: 'imtp_relative',
    name: 'IMTP relativo (fuerza pico / masa corporal)',
    unit: 'N/kg',
    expression: 'imtp_peak_force / body_mass',
    constants: {},
    better: 'higher',
    isEstimate: false,
    errorModel: 'none',
    definition: 'Fuerza pico en el tirón isométrico a medio muslo (N) / masa corporal (kg).',
  },
  {
    slug: 'sum_6_skinfolds',
    name: 'Σ6 pliegues',
    unit: 'mm',
    expression: `sum(${SKINFOLDS_6.join(', ')})`,
    constants: {},
    better: 'lower',
    isEstimate: false,
    errorModel: 'none',
    definition:
      'Tríceps + subescapular + cresta ilíaca + abdominal + muslo anterior + gemelo medial (cada pliegue, mediana de sus mediciones).',
  },
  {
    slug: 'sum_4_skinfolds',
    name: 'Σ4 pliegues',
    unit: 'mm',
    expression: `sum(${SKINFOLDS_6.slice(0, 4).join(', ')})`,
    constants: {},
    better: 'lower',
    isEstimate: false,
    errorModel: 'none',
    definition:
      'Tríceps + subescapular + cresta ilíaca + abdominal (entrada de la ecuación de Faulkner).',
  },
  {
    slug: 'body_fat_faulkner',
    name: '% graso (Faulkner)',
    unit: '%',
    expression: 'sum_4_skinfolds * a + b',
    constants: { a: 0.153, b: 5.783 },
    better: 'lower',
    isEstimate: true,
    errorModel: 'none',
    definition:
      'Σ4 pliegues × a + b. Ecuación del documento del club (Faulkner, 1968) [REQUIERE VERIFICACIÓN]. Es una estimación.',
  },
  {
    slug: 'body_fat_yuhasz',
    name: '% graso (Yuhasz, hombres)',
    unit: '%',
    expression: 'sum_6_skinfolds * a + b',
    constants: { a: 0.1051, b: 2.585 },
    better: 'lower',
    isEstimate: true,
    errorModel: 'none',
    sex: 'male',
    definition:
      'Σ6 pliegues × a + b, solo para hombres. Ecuación del documento del club (Yuhasz, 1974) [REQUIERE VERIFICACIÓN]. Es una estimación.',
  },
  {
    slug: 'fat_mass',
    name: 'Masa grasa',
    unit: 'kg',
    expression: 'body_mass * body_fat_faulkner / 100',
    constants: {},
    better: 'lower',
    isEstimate: true,
    errorModel: 'none',
    definition: 'Masa corporal × % graso (Faulkner) / 100. Estimación.',
  },
  {
    slug: 'fat_free_mass',
    name: 'Masa libre de grasa',
    unit: 'kg',
    expression: 'body_mass - fat_mass',
    constants: {},
    better: 'higher',
    isEstimate: true,
    errorModel: 'none',
    definition: 'Masa corporal − masa grasa. Estimación: no es masa muscular.',
  },
];

/** The default catalogue, compiled (inputs known, in dependency order). */
export const DERIVED_FORMULAS = compileFormulas(DEFAULT_FORMULAS);

/** Derived values of one assessment with the given formulas (defaults if none are given). */
export function computeDerived(
  values: Record<string, number>,
  formulas = DERIVED_FORMULAS,
  opts: { sex?: string | null } = {},
) {
  return evaluateFormulas(formulas, values, opts).map((x) => ({
    ...x,
    value: Math.round(x.value * 1000) / 1000,
  }));
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
