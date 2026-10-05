import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  aggregateAttempts,
  bandOf,
  bestAndWorst,
  clipZ,
  compileFormulas,
  computeDerived,
  DEFAULT_FORMULAS,
  evaluateFormula,
  formulaText,
  groupStats,
  measurementFlags,
  median,
  parseFormula,
  percentOfReference,
  zAgainstGroup,
  zAgainstReference,
  type FormulaDef,
} from '../src';

const f = (
  slug: string,
  expression: string,
  constants: Record<string, number> = {},
): FormulaDef => ({
  slug,
  name: slug,
  unit: '',
  expression,
  constants,
  better: 'higher',
  isEstimate: false,
  errorModel: 'none',
  definition: '',
});

describe('result rules: median, minimum, maximum', () => {
  it('median of 3 skinfold measurements; of 2, their mean (ISAK, as the club workbook)', () => {
    const rule = { aggregation: 'median' as const, betterDirection: 'lower' as const };
    expect(aggregateAttempts([10.2, 9.8, 11], rule).value).toBe(10.2);
    expect(aggregateAttempts([10, 11], rule).value).toBe(10.5);
    expect(median([3, 1, 2, 4])).toBe(2.5);
  });
  it('min and max are raw extremes whatever the direction', () => {
    const x = [1.82, 1.79];
    expect(aggregateAttempts(x, { aggregation: 'min', betterDirection: 'higher' }).value).toBe(
      1.79,
    );
    expect(aggregateAttempts(x, { aggregation: 'max', betterDirection: 'lower' }).value).toBe(1.82);
  });
});

describe('formula engine', () => {
  it('parses arithmetic, functions, sides and constants; precedence and right-assoc power', () => {
    const e = parseFormula('2 + 3 * 4 ^ 2 ^ 0,5 - abs(-1)');
    expect(evaluateFormula(e, () => null)).toBeCloseTo(2 + 3 * 4 ** Math.SQRT2 - 1, 10);
    const s = parseFormula('abs(cmj.right - cmj.left) / max(cmj.right, cmj.left) * 100');
    expect(evaluateFormula(s, (n) => ({ 'cmj.right': 30, 'cmj.left': 27 })[n])).toBeCloseTo(10, 10);
  });
  it('rejects anything that is not the small language (no code execution)', () => {
    for (const bad of [
      '',
      'process.exit()',
      'constructor',
      'a ; b',
      'x[0]',
      'eval(1)',
      '1 +',
      '(1',
      'max()',
      "'a'",
      'a.b',
    ])
      expect(() => {
        const e = parseFormula(bad);
        // A lone unknown name parses but never evaluates to a value.
        if (evaluateFormula(e, () => undefined) == null) throw new Error('no value');
      }, bad).toThrow();
  });
  it('a missing input gives no value, never a zero; division by zero gives no value', () => {
    expect(evaluateFormula(parseFormula('sum(a, b)'), (n) => (n === 'a' ? 1 : null))).toBeNull();
    expect(evaluateFormula(parseFormula('1 / x'), () => 0)).toBeNull();
  });
  it('orders formulas by dependency, detects cycles and unknown names', () => {
    const c = compileFormulas([f('y', 'x * 2'), f('x', 'a + t', { a: 1 })], (n) => n === 't');
    expect(c.map((x) => x.slug)).toEqual(['x', 'y']);
    expect(c[0]!.inputs).toEqual(['t']);
    expect(() => compileFormulas([f('p', 'q + 1'), f('q', 'p + 1')])).toThrow(/circular/);
    expect(() => compileFormulas([f('p', 'nope + 1')], () => false)).toThrow(/no es un test/);
    expect(() => compileFormulas([f('p', 'k + 1', { kk: 1 })])).toThrow(/una sola letra/);
  });
  it('the club equations chain Σ pliegues → % graso → masa grasa → MLG; constants are editable', () => {
    const v = {
      body_mass: 75,
      skinfold_triceps: 8,
      skinfold_subscapular: 9,
      skinfold_iliac_crest: 10,
      skinfold_abdominal: 12,
      skinfold_front_thigh: 11,
      skinfold_medial_calf: 6,
    };
    const by = (xs: ReturnType<typeof computeDerived>) =>
      Object.fromEntries(xs.map((x) => [x.formula.slug, x.value]));
    const male = by(computeDerived(v, undefined, { sex: 'male' }));
    expect(male.sum_6_skinfolds).toBe(56);
    expect(male.sum_4_skinfolds).toBe(39);
    expect(male.body_fat_faulkner).toBeCloseTo(39 * 0.153 + 5.783, 2);
    expect(male.body_fat_yuhasz).toBeCloseTo(56 * 0.1051 + 2.585, 2);
    expect(male.fat_mass).toBeCloseTo((75 * (39 * 0.153 + 5.783)) / 100, 2);
    expect(male.fat_free_mass).toBeCloseTo(75 - (75 * (39 * 0.153 + 5.783)) / 100, 2);
    // Yuhasz is for men only.
    expect(by(computeDerived(v, undefined, { sex: 'female' })).body_fat_yuhasz).toBeUndefined();
    // The centre's own constants.
    const own = DEFAULT_FORMULAS.map((d) =>
      d.slug === 'body_fat_faulkner' ? { ...d, constants: { a: 0.2, b: 1 } } : d,
    );
    expect(by(computeDerived(v, compileFormulas(own))).body_fat_faulkner).toBeCloseTo(8.8, 6);
    expect(formulaText({ expression: 'x * a + b', constants: { a: 0.153, b: 5.783 } })).toBe(
      'x * 0,153 + 5,783',
    );
  });
});

describe('group statistics, Z against the team and bands', () => {
  const xs = [30, 34, null, 28, 40, 33];
  it('N, mean, sample SD, max, min ignore missing values', () => {
    const s = groupStats(xs);
    expect(s.n).toBe(5);
    expect(s.mean).toBeCloseTo(33, 10);
    expect(s.sd).toBeCloseTo(Math.sqrt((9 + 1 + 25 + 49 + 0) / 4), 10);
    expect([s.max, s.min]).toEqual([40, 28]);
    expect(groupStats([5]).sd).toBeNull();
  });
  it('best and worst follow the direction (first on ties); none for descriptive tests', () => {
    expect(bestAndWorst(xs, 'higher')).toEqual({ best: 4, worst: 3 });
    expect(bestAndWorst([2.1, 1.9, 1.9, 2.3], 'lower')).toEqual({ best: 1, worst: 3 });
    expect(bestAndWorst(xs, 'target_range')).toBeNull();
  });
  it('Z is sign-corrected: «outwards» is always better', () => {
    const zH = zAgainstGroup(xs, 'higher');
    const zL = zAgainstGroup(xs, 'lower');
    expect(zH[2]).toBeNull();
    expect(zH[4]).toBeGreaterThan(0);
    expect(zL[4]).toBeCloseTo(-zH[4]!, 12);
    expect(zAgainstGroup([1, 1, 1], 'higher')).toEqual([null, null, null]);
    expect(zAgainstReference(12, { mean: 10, sd: 2 }, 'lower')).toBe(-1);
    expect(percentOfReference(2, 2.2, 'lower')).toBeCloseTo(110, 10);
  });
  it('bands come from Z (the text can never contradict the number)', () => {
    expect([bandOf(2.3), bandOf(1), bandOf(-1.01), bandOf(null)]).toEqual([
      'destacado',
      'en_la_media',
      'a_mejorar',
      null,
    ]);
    expect(clipZ(5)).toBe(3);
  });
  it('flags values to confirm: outside limits, or atypical against the others', () => {
    const heights = [177, 181, 175, 179, 183, 176, 178, 180, 182, 161.3];
    const flags = measurementFlags(heights, { min: 100, max: 230 });
    expect(flags.at(-1)).toBe('atipico');
    expect(flags.slice(0, -1).every((x) => x === null)).toBe(true);
    expect(measurementFlags([250], { max: 230 })).toEqual(['fuera_de_limites']);
    expect(measurementFlags([1, 2, 30])).toEqual([null, null, null]); // too few to judge
  });
  it('properties: mean of Z is 0, adding a constant keeps Z, reversing direction negates it', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 3, maxLength: 30 }),
        fc.integer({ min: -100, max: 100 }),
        (vals, k) => {
          const z = zAgainstGroup(vals, 'higher');
          if (z.some((x) => x == null)) return; // no spread
          const zs = z as number[];
          expect(zs.reduce((a, b) => a + b, 0) / zs.length).toBeCloseTo(0, 6);
          const shifted = zAgainstGroup(
            vals.map((v) => v + k),
            'higher',
          ) as number[];
          shifted.forEach((x, i) => expect(x).toBeCloseTo(zs[i]!, 6));
          (zAgainstGroup(vals, 'lower') as number[]).forEach((x, i) =>
            expect(x).toBeCloseTo(-zs[i]!, 9),
          );
        },
      ),
    );
  });
});
