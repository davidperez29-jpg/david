import { describe, expect, it } from 'vitest';
import {
  aggregateAttempts,
  asymmetryPercent,
  combineErrors,
  compareToReference,
  computeDerived,
  errorFromReliability,
  interpretChange,
  mdc95FromSem,
  pickMeasurementError,
  proposeBattery,
  REFERRAL_TEXT,
  semFromIcc,
  trend,
  type BatteryTemplate,
  type ReferenceRow,
  type ReliabilityRow,
} from '../src';

const rel = (p: Partial<ReliabilityRow>): ReliabilityRow => ({
  isLocal: false,
  icc: null,
  cvPercent: null,
  sem: null,
  semUnit: null,
  mdc95: null,
  swc: null,
  measurementMethod: null,
  label: 'Fuente X',
  ...p,
});

describe('attempt aggregation', () => {
  it('takes the best attempt in the right direction', () => {
    expect(
      aggregateAttempts([40.1, 42.3, 41.0], { aggregation: 'best', betterDirection: 'higher' })
        .value,
    ).toBe(42.3);
    expect(
      aggregateAttempts([1.82, 1.79, 1.85], { aggregation: 'best', betterDirection: 'lower' })
        .value,
    ).toBe(1.79);
  });
  it('supports mean, mean of best n and last, and reports within-session CV', () => {
    const a = [40, 42, 44];
    expect(aggregateAttempts(a, { aggregation: 'mean', betterDirection: 'higher' }).value).toBe(42);
    expect(
      aggregateAttempts(a, { aggregation: 'mean_of_best_n', n: 2, betterDirection: 'higher' })
        .value,
    ).toBe(43);
    expect(aggregateAttempts(a, { aggregation: 'last', betterDirection: 'higher' }).value).toBe(44);
    expect(
      aggregateAttempts(a, { aggregation: 'best', betterDirection: 'higher' }).cvIntraPercent,
    ).toBeCloseTo(4.76, 1);
    expect(
      aggregateAttempts([40], { aggregation: 'best', betterDirection: 'higher' }).cvIntraPercent,
    ).toBeNull();
  });
  it('rejects empty attempts', () => {
    expect(() =>
      aggregateAttempts([], { aggregation: 'best', betterDirection: 'higher' }),
    ).toThrow();
  });
});

describe('change against measurement error (§11.5)', () => {
  it('uses standard formulas', () => {
    expect(semFromIcc(10, 0.91)).toBeCloseTo(3, 5);
    expect(mdc95FromSem(1)).toBeCloseTo(2.772, 3);
  });

  it('without error gives the difference but no verdict', () => {
    const r = interpretChange(40, 44, 'higher', null);
    expect(r).toMatchObject({ delta: 4, deltaPercent: 10, verdict: 'unknown_error' });
  });

  it('classifies within error, possible and probable changes with direction', () => {
    const err = errorFromReliability(rel({ sem: 1, semUnit: 'cm' }), 'cm', 40)!;
    expect(err.mdc95).toBeCloseTo(2.772, 3);
    expect(interpretChange(40, 40.5, 'higher', err).verdict).toBe('within_error');
    expect(interpretChange(40, 42, 'higher', err).verdict).toBe('possible_change');
    expect(interpretChange(40, 43, 'higher', err).verdict).toBe('probable_improvement');
    expect(interpretChange(40, 37, 'higher', err).verdict).toBe('probable_decline');
    // Times: lower is better.
    const t = errorFromReliability(rel({ sem: 0.02, semUnit: 's' }), 's', 1.8)!;
    expect(interpretChange(1.8, 1.7, 'lower', t).verdict).toBe('probable_improvement');
  });

  it('converts CV% to an absolute error at the baseline and prefers local data', () => {
    const published = rel({ cvPercent: 4.2, label: 'Grgic 2020' });
    const local = rel({ isLocal: true, sem: 2, semUnit: 'kg', label: 'Test-retest del centro' });
    expect(errorFromReliability(published, 'kg', 100)!.te).toBeCloseTo(4.2, 5);
    expect(pickMeasurementError([published, local], 'kg', 100)!.origin).toBe('local');
    expect(errorFromReliability(rel({ icc: 0.97 }), 'kg', 100)).toBeNull();
    expect(
      pickMeasurementError(
        [rel({ sem: 1, semUnit: 'cm', measurementMethod: 'plataforma de fuerzas' })],
        'cm',
        30,
        'app móvil',
      ),
    ).toBeNull();
  });

  it('warns when the test cannot detect the smallest worthwhile change', () => {
    const err = errorFromReliability(rel({ sem: 2, swc: 1, semUnit: 'cm' }), 'cm', 40)!;
    expect(interpretChange(40, 46, 'higher', err).warnings.join(' ')).toMatch(/poco sensible/);
  });

  it('combines errors for difference metrics and needs both', () => {
    const a = errorFromReliability(rel({ sem: 0.03, semUnit: 's' }), 's', 2.4)!;
    const b = errorFromReliability(rel({ sem: 0.04, semUnit: 's' }), 's', 1.8)!;
    expect(combineErrors(a, b, 'déficit')!.te).toBeCloseTo(0.05, 5);
    expect(combineErrors(a, null, 'déficit')).toBeNull();
  });

  it('computes trend only with ≥ 3 points', () => {
    expect(
      trend([
        { t: 0, value: 1 },
        { t: 1, value: 2 },
      ]),
    ).toBe('insufficient');
    expect(
      trend([
        { t: 0, value: 1 },
        { t: 1, value: 2 },
        { t: 2, value: 3 },
      ]),
    ).toBe('up');
    expect(
      trend(
        [
          { t: 0, value: 3 },
          { t: 1, value: 2.9 },
          { t: 2, value: 3 },
        ],
        0.5,
      ),
    ).toBe('flat');
  });
});

describe('derived metrics', () => {
  it('computes BMI, COD deficit and relative strength only when inputs exist', () => {
    const d = computeDerived({
      body_mass: 80,
      height: 180,
      test_505: 2.45,
      sprint_10m: 1.85,
      one_rm: 120,
    });
    const by = Object.fromEntries(d.map((x) => [x.formula.id, x.value]));
    expect(by.bmi).toBeCloseTo(24.691, 3);
    expect(by.cod_deficit).toBeCloseTo(0.6, 3);
    expect(by.relative_strength_1rm).toBe(1.5);
    expect(by.eccentric_utilization).toBeUndefined();
  });
  it('asymmetry is relative to the better side', () => {
    expect(asymmetryPercent(30, 27, 'higher')).toEqual({ value: 10, weaker: 'right' });
    expect(asymmetryPercent(2.0, 2.2, 'lower')).toEqual({ value: 10, weaker: 'right' });
    expect(asymmetryPercent(20, 20, 'higher')).toEqual({ value: 0, weaker: 'none' });
  });
});

describe('reference comparison (§11.6)', () => {
  const ref = (p: Partial<ReferenceRow>): ReferenceRow => ({
    id: 'r',
    populationName: 'Adultos mayores',
    populationSlug: 'older_adults',
    ageMin: 65,
    ageMax: null,
    sex: 'female',
    level: null,
    sport: null,
    statisticType: 'mean_sd',
    values: { mean: 20, sd: 4 },
    measurementMethod: null,
    unit: 'kg',
    sourceLabel: 'Fuente',
    ...p,
  });
  it('gives a z-score only for an applicable mean ± SD reference', () => {
    expect(compareToReference(24, ref({}), { age: 70, sex: 'female' }, null).zScore).toBe(1);
    const young = compareToReference(24, ref({}), { age: 30, sex: 'female' }, null);
    expect(young.applicable).toBe(false);
    expect(young.zScore).toBeNull();
    expect(young.reasons.join(' ')).toMatch(/Edad/);
    expect(compareToReference(24, ref({}), { age: 70, sex: 'male' }, null).zScore).toBeNull();
    expect(
      compareToReference(24, ref({ values: { mean: 20 } }), { age: 70, sex: 'female' }, null)
        .zScore,
    ).toBeNull();
  });
  it('rejects a different measurement method or population', () => {
    expect(
      compareToReference(
        24,
        ref({ measurementMethod: 'Jamar' }),
        { age: 70, sex: 'female' },
        'dinamómetro digital',
      ).applicable,
    ).toBe(false);
    expect(
      compareToReference(
        24,
        ref({}),
        { age: 70, sex: 'female', populations: ['adults_recreational'] },
        null,
      ).applicable,
    ).toBe(false);
  });
  it('cut-offs raise the health-professional referral, never a diagnosis', () => {
    const c = compareToReference(
      14,
      ref({
        statisticType: 'cutoff',
        values: { cutoff: 16, direction: 'below', meaning: 'baja fuerza (cribado)' },
      }),
      { age: 70, sex: 'female' },
      null,
    );
    expect(c.flag?.message).toBe(REFERRAL_TEXT);
    expect(c.flag?.criterion).toMatch(/cribado/);
    expect(
      compareToReference(
        18,
        ref({ statisticType: 'cutoff', values: { cutoff: 16, direction: 'below' } }),
        { age: 70, sex: 'female' },
        null,
      ).flag,
    ).toBeNull();
  });
  it('places a value in percentile bands', () => {
    const c = compareToReference(
      30,
      ref({ statisticType: 'percentiles', values: { p10: 20, p50: 28, p90: 36 } }),
      { age: 70, sex: 'female' },
      null,
    );
    expect(c.band).toBe('≥ P50');
  });
});

describe('battery proposal', () => {
  const templates: BatteryTemplate[] = [
    {
      slug: 'hypertrophy_strength',
      name: 'Hipertrofia',
      goalFamily: 'muscle',
      tests: [
        { slug: 'one_rm', name: '1RM', isCore: true },
        { slug: 'waist_circumference', name: 'Cintura', isCore: true },
      ],
    },
    {
      slug: 'health',
      name: 'Salud',
      goalFamily: 'health',
      tests: [{ slug: 'grip_strength', name: 'Prensión', isCore: true }],
    },
    { slug: 'initiation', name: 'Iniciación', goalFamily: 'general', tests: [] },
  ];
  it('picks the template from the main goal and explains exclusions', () => {
    const p = proposeBattery(
      { goals: ['hypertrophy'], age: 30, experience: 'advanced', screening: 'clear' },
      templates,
    );
    expect(p.battery?.slug).toBe('hypertrophy_strength');
    expect(p.tests.every((t) => t.included)).toBe(true);
    const novice = proposeBattery(
      { goals: ['hypertrophy'], age: 30, experience: 'beginner', screening: 'clear' },
      templates,
    );
    expect(novice.tests.find((t) => t.slug === 'one_rm')).toMatchObject({ included: false });
    const noScreen = proposeBattery(
      { goals: ['hypertrophy'], age: 30, experience: 'advanced', screening: 'unknown' },
      templates,
    );
    expect(noScreen.tests.find((t) => t.slug === 'one_rm')!.reason).toMatch(/cribado/);
    const refer = proposeBattery(
      { goals: ['hypertrophy'], age: 30, experience: 'advanced', screening: 'refer' },
      templates,
    );
    expect(refer.tests.find((t) => t.slug === 'one_rm')!.reason).toMatch(/profesional sanitario/);
  });
  it('prioritises health and function from 65 years', () => {
    expect(
      proposeBattery(
        { goals: ['hypertrophy'], age: 70, experience: 'intermediate', screening: 'clear' },
        templates,
      ).battery?.slug,
    ).toBe('health');
    expect(
      proposeBattery({ goals: [], age: 30, experience: null, screening: 'clear' }, templates)
        .battery?.slug,
    ).toBe('initiation');
  });
});
