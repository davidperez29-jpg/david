import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECISION_RULES,
  evaluate,
  REFERRAL_TEXT,
  runDecisionEngine,
  validateExpr,
  type ClientContext,
  type DecisionRule,
  type KnowledgeSnapshot,
} from '../src';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const claim = (
  key: string,
  confidence: 'high' | 'moderate' | 'low',
  appliesTo: string[],
  notFor: string[] = [],
) => ({
  key,
  statement: `Afirmación ${key}`,
  confidence,
  appliesTo,
  notFor,
  sources: [{ citation: `Fuente de ${key}`, doi: `10.0/${key}`, pmid: null }],
});
const CLAIMS = Object.fromEntries(
  [
    claim('c_strength_sprint_transfer', 'moderate', [
      'team_sport_athletes',
      'football_players',
      'youth',
    ]),
    claim('c_fuerza_rendimiento', 'low', ['football_players'], ['older_adults']),
    claim(
      'c_load_spectrum',
      'high',
      ['adults_untrained', 'adults_recreational', 'adults_resistance_trained'],
      ['youth'],
    ),
    claim('c_plyo_jump_dose', 'moderate', [
      'adults_recreational',
      'youth',
      'football_players',
      'team_sport_athletes',
    ]),
    claim('c_power_prescription', 'moderate', [
      'adults_recreational',
      'adults_resistance_trained',
      'team_sport_athletes',
    ]),
    claim(
      'c_pape_acute_effect',
      'low',
      ['adults_resistance_trained', 'team_sport_athletes'],
      ['youth', 'older_adults'],
    ),
    claim('c_older_rt_effective', 'high', ['older_adults']),
    claim('c_older_rt_dose', 'low', ['older_adults'], ['youth']),
    claim(
      'c_concurrent',
      'moderate',
      ['adults_untrained', 'adults_recreational'],
      ['endurance_athletes'],
    ),
    claim('c_endurance_strength_re', 'moderate', ['endurance_athletes']),
    claim('c_isometric_tendon', 'moderate', [
      'adults_recreational',
      'adults_untrained',
      'adults_resistance_trained',
    ]),
    claim('c_nhe_low_volume', 'low', ['team_sport_athletes']),
  ].map((c) => [c.key, c]),
);
const method = (
  slug: string,
  claimKeys: string[],
  variables: KnowledgeSnapshot['methods'][number]['variables'] = [],
) => ({
  slug,
  name: slug,
  kind: 'training_method',
  claimKeys,
  variables,
});
const v = (
  key: string,
  min: number,
  max: number,
  claimKey: string,
  population: string | null = null,
  unit: string | null = null,
) => ({
  key,
  min,
  max,
  typical: null,
  unit,
  population,
  claimKey,
});
const METHODS = [
  method(
    'fuerza-maxima',
    ['c_load_spectrum'],
    [v('pct_1rm', 80, 100, 'c_load_spectrum', null, '%1RM')],
  ),
  method(
    'fuerza-mayores',
    ['c_older_rt_dose'],
    [
      v('pct_1rm', 70, 79, 'c_older_rt_dose', 'older_adults', '%1RM'),
      v('sets', 2, 3, 'c_older_rt_dose', 'older_adults'),
    ],
  ),
  method('hipertrofia', ['c_load_spectrum']),
  method(
    'potencia',
    ['c_power_prescription'],
    [v('pct_1rm', 30, 70, 'c_power_prescription', null, '%1RM')],
  ),
  method('pliometria', ['c_plyo_jump_dose']),
  method('pape-complex-contrast', ['c_pape_acute_effect']),
  method('halterofilia-derivados', []),
  method('sprint-aceleracion', []),
  method('cod-agilidad', []),
  method('nordic-hamstring', ['c_nhe_low_volume']),
  method('concurrente', ['c_concurrent']),
  method('dosis-minima', []),
  method('estiramientos-movilidad', []),
  method('core', []),
];
const ex = (
  id: string,
  pattern: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  extra: Partial<KnowledgeSnapshot['exercises'][number]> = {},
) => ({
  id,
  name: id,
  pattern,
  level,
  complexity: 2,
  impact: 'low' as const,
  requiredEquipment: [],
  methodSlugs: [],
  ...extra,
});
const EXERCISES = [
  ex('back_squat', 'knee_dominant', 'intermediate', { requiredEquipment: ['barbell'] }),
  ex('goblet_squat', 'knee_dominant', 'beginner', { requiredEquipment: ['dumbbells'] }),
  ex('rdl', 'hip_dominant', 'intermediate', { requiredEquipment: ['barbell'] }),
  ex('nordic', 'hip_dominant', 'intermediate', { methodSlugs: ['nordic-hamstring'] }),
  ex('bench', 'horizontal_push', 'intermediate', { requiredEquipment: ['barbell'] }),
  ex('row', 'horizontal_pull', 'beginner', { requiredEquipment: ['dumbbells'] }),
  ex('cmj_jump', 'jump_plyometric', 'beginner', { impact: 'moderate' }),
  ex('depth_jump', 'jump_plyometric', 'advanced', { impact: 'high', complexity: 4 }),
  ex('med_ball_throw', 'throw', 'beginner'),
  ex('sprint_10', 'sprint_cod', 'beginner', { impact: 'high' }),
];
const TEMPLATES = [
  {
    slug: 'equipo-2d',
    name: 'Equipo 2 días',
    goal: 'team_sport_performance',
    sessionsPerWeek: 2,
    weeks: 12,
  },
  {
    slug: 'equipo-3d',
    name: 'Equipo 3 días',
    goal: 'team_sport_performance',
    sessionsPerWeek: 3,
    weeks: 12,
  },
  { slug: 'salud-2d', name: 'Salud 2 días', goal: 'general_health', sessionsPerWeek: 2, weeks: 12 },
  {
    slug: 'hipertrofia-3d',
    name: 'Hipertrofia 3 días',
    goal: 'hypertrophy',
    sessionsPerWeek: 3,
    weeks: 12,
  },
];

/** The organization's thresholds for footballers (§13.6 example: 1.5 × BW). */
function rulesWith(thresholds: Record<string, number | null>): DecisionRule[] {
  return DEFAULT_DECISION_RULES.map((r) =>
    r.key in thresholds
      ? {
          ...r,
          parameters: {
            ...r.parameters,
            threshold: { ...r.parameters.threshold!, value: thresholds[r.key]! },
          },
        }
      : r,
  );
}
const knowledge = (rules: DecisionRule[], disabledRules: string[] = []): KnowledgeSnapshot => ({
  ruleSetVersion: 3,
  rules,
  claims: CLAIMS,
  methods: METHODS,
  exercises: EXERCISES,
  templates: TEMPLATES,
  disabledRules,
});
const metric = (testSlug: string, name: string, value: number, unit: string) => ({
  testSlug,
  name,
  value,
  unit,
  date: '2026-09-12',
  change: null,
  reference: null,
});

/** §13.10 / §69: footballer, 22, 3 days, low CMJ, correct sprint, low relative strength, good adherence. */
const footballer = (over: Partial<ClientContext> = {}): ClientContext => ({
  today: '2026-10-03',
  person: { age: 22, sex: 'male', experience: 'intermediate', yearsTraining: 4 },
  goals: {
    primary: {
      slug: 'team_sport_performance',
      family: 'sport_performance',
      sport: 'football',
      sportType: 'team',
    },
    secondary: [],
  },
  metrics: {
    cmj_height: metric('cmj_height', 'CMJ', 31.2, 'cm'),
    sprint_10m: metric('sprint_10m', 'Sprint 10 m', 1.74, 's'),
    one_rm_back_squat: metric('one_rm_back_squat', '1RM sentadilla', 85, 'kg'),
  },
  derived: {
    relative_strength_back_squat: {
      value: 1.1,
      unit: '×PC',
      date: '2026-09-12',
      from: '1RM 85 kg / 77 kg',
    },
  },
  availability: { daysPerWeek: 3, minutesPerSession: 60 },
  equipment: null,
  tolerances: { notToleratedExerciseIds: [], restrictedPatterns: [] },
  screening: 'clear',
  response: { adherence28: 92, painFlag: false, srpeHigh: false },
  manualTraits: {},
  modality: 'in_person',
  populations: ['adults_recreational', 'team_sport_athletes', 'football_players'],
  missing: [],
  ...over,
});
const FOOTBALL_THRESHOLDS = {
  'profile.relative_strength_low': 1.5,
  'profile.cmj_low': 35,
  'profile.sprint_slow': 1.85,
};

// ── DSL ───────────────────────────────────────────────────────────────────────
describe('rule DSL', () => {
  it('evaluates operators without eval and reports missing data', () => {
    const facts = {
      a: 3,
      b: { c: 'x' },
      list: [1, 2, 4],
      dates: ['2026-10-01', '2026-09-01'],
      today: '2026-10-03',
    };
    expect(
      evaluate(
        { and: [{ '>': [{ var: 'a' }, { param: 't' }] }, { in: [{ var: 'b.c' }, ['x', 'y']] }] },
        facts,
        { t: 2 },
      ).value,
    ).toBe(true);
    expect(evaluate({ between: [{ var: 'a' }, 1, 3] }, facts, {}).value).toBe(true);
    expect(evaluate({ not: { exists: { var: 'zz' } } }, facts, {}).value).toBe(true);
    expect(evaluate({ trend: [{ var: 'list' }, 'up'] }, facts, {}).value).toBe(true);
    expect(
      evaluate({ count_in_window: [{ var: 'dates' }, 7, { var: 'today' }, 1] }, facts, {}).value,
    ).toBe(true);
    const r = evaluate({ '<': [{ var: 'missing.metric' }, 1] }, facts, {});
    expect(r).toMatchObject({ value: false, missing: ['missing.metric'] });
    expect(validateExpr({ hack: [] })).toEqual(['Operador desconocido «hack»']);
    expect(validateExpr({ '<': [{ var: 'a' }, { param: 'nope' }] }, {})).toEqual([
      'Parámetro sin definir «nope»',
    ]);
  });
});

// ── Golden cases ──────────────────────────────────────────────────────────────
describe('golden case §69: footballer', () => {
  it('with the organization thresholds: P1 strength, P2 power, maintain sprint; full explanation', () => {
    const r = runDecisionEngine(footballer(), knowledge(rulesWith(FOOTBALL_THRESHOLDS)));
    expect(r.screening.status).toBe('clear');
    expect(r.priorities[0]).toMatchObject({ rank: 1, quality: 'max_strength', sessionsPerWeek: 2 });
    expect(r.priorities[1]).toMatchObject({ rank: 2, quality: 'power' });
    expect(r.needs.find((n) => n.quality === 'speed')!.direction).toBe('mantener');
    expect(r.traits.find((t) => t.key === 'cmj_low')).toMatchObject({
      value: true,
      basis: 'threshold',
    });
    expect(r.traits.find((t) => t.key === 'sprint_slow')).toMatchObject({
      value: false,
      basis: 'threshold',
    });

    // §13.6: DATA → INTERPRETATION → RULE → EVIDENCE → APPLICABILITY → LIMITATIONS → CONFIDENCE.
    const e = r.needs.find((n) => n.quality === 'max_strength')!.explanation;
    expect(e.data.join(' ')).toMatch(
      /Fuerza relativa baja.*1,1 ×PC frente al umbral del centro 1,5 ×PC/,
    );
    expect(e.data.join(' ')).toMatch(/Adherencia 4 semanas: 92 %/);
    expect(e.interpretation[0]).toMatch(/Fuerza relativa baja para su objetivo/);
    expect(e.rules).toContainEqual({ key: 'needs.max_strength.relative_strength_low', version: 1 });
    expect(e.evidence.map((x) => x.claimKey)).toEqual([
      'c_strength_sprint_transfer',
      'c_fuerza_rendimiento',
      'c_load_spectrum',
    ]);
    expect(e.evidence[0]!.sources[0]!.doi).toBe('10.0/c_strength_sprint_transfer');
    expect(e.applicability).toContain('c_fuerza_rendimiento: coincide (futbolistas)');
    expect(e.limitations.join(' ')).toMatch(/no causalidad/);
    expect(e.confidence).toBe('low');

    // Methods, exercises and doses follow the priorities.
    expect(r.methods.map((m) => m.method)).toEqual(
      expect.arrayContaining(['fuerza-maxima', 'nordic-hamstring', 'potencia', 'pliometria']),
    );
    expect(r.methods.some((m) => m.method === 'pape-complex-contrast')).toBe(false);
    expect(r.doses).toContainEqual(
      expect.objectContaining({ method: 'fuerza-maxima', variable: 'pct_1rm', min: 80, max: 100 }),
    );
    expect(
      r.exercises.find((x) => x.method === 'fuerza-maxima' && x.slot === 'knee_dominant')!
        .candidates[0]!.name,
    ).toBe('back_squat');
    expect(r.planSkeleton).toMatchObject({ templateSlug: 'equipo-3d', reassessmentEveryWeeks: 6 });
    expect(r.pendingRules).toEqual([]);
  });

  it('without a threshold for CMJ the engine says so and uses the trainer’s judgement', () => {
    const k = knowledge(rulesWith({ ...FOOTBALL_THRESHOLDS, 'profile.cmj_low': null }));
    const r = runDecisionEngine(footballer(), k);
    expect(r.warnings).toContain(
      'No hay referencia aplicable para valorar el CMJ como bajo; se usa la valoración del entrenador.',
    );
    expect(r.traits.find((t) => t.key === 'cmj_low')).toMatchObject({
      value: null,
      basis: 'unknown',
    });
    expect(r.pendingRules).toContainEqual({ key: 'profile.cmj_low', params: ['threshold'] });
    // The trainer marks it manually → power is raised, flagged as manual.
    const m = runDecisionEngine(footballer({ manualTraits: { cmj_low: true } }), k);
    expect(m.traits.find((t) => t.key === 'cmj_low')).toMatchObject({
      value: true,
      basis: 'manual',
    });
    expect(m.priorities.map((p) => p.quality).slice(0, 2)).toEqual(['max_strength', 'power']);
    expect(m.needs.find((n) => n.quality === 'power')!.explanation.limitations).toContain(
      'Rasgo marcado manualmente por el entrenador.',
    );
  });

  it('is deterministic: same input + same rule set → same result and hash', () => {
    const k = knowledge(rulesWith(FOOTBALL_THRESHOLDS));
    const a = runDecisionEngine(footballer(), k);
    const b = runDecisionEngine(footballer(), k);
    expect(a).toEqual(b);
    expect(
      runDecisionEngine(
        footballer({ response: { adherence28: 50, painFlag: false, srpeHigh: false } }),
        k,
      ).inputHash,
    ).not.toBe(a.inputHash);
  });

  it('a rule disabled for the client does not run', () => {
    const r = runDecisionEngine(
      footballer(),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS), ['needs.max_strength.relative_strength_low']),
    );
    expect(r.needs.find((n) => n.quality === 'max_strength')!.score).toBe(0.6);
  });
});

describe('golden cases: safety and populations', () => {
  it('positive screening: referral text and no high-intensity methods or high-impact exercises', () => {
    const r = runDecisionEngine(
      footballer({ screening: 'refer' }),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS)),
    );
    expect(r.screening.status).toBe('refer');
    expect(r.warnings[0]).toBe(REFERRAL_TEXT);
    expect(r.methods.map((m) => m.method)).not.toEqual(expect.arrayContaining(['fuerza-maxima']));
    expect(
      r.methods.some((m) => ['pliometria', 'potencia', 'sprint-aceleracion'].includes(m.method)),
    ).toBe(false);
    expect(r.excludedMethods.map((m) => m.method)).toEqual(
      expect.arrayContaining(['fuerza-maxima', 'pliometria']),
    );
  });

  it('beginner: no PAPE/weightlifting, conservative doses, intro phase proposed with explanation', () => {
    const r = runDecisionEngine(
      footballer({ person: { age: 30, sex: 'female', experience: 'beginner', yearsTraining: 0 } }),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS)),
    );
    expect(r.excludedMethods.map((m) => m.method)).toEqual(
      expect.arrayContaining(['pape-complex-contrast']),
    );
    expect(r.doses.find((d) => d.method === 'fuerza-maxima')).toMatchObject({ suggested: 80 });
    expect(r.doses[0]!.note).toMatch(/parte baja/);
    expect(r.introPhase.level).not.toBe('ninguna');
    expect(r.introPhase.explanation.evidence.map((e) => e.claimKey)).toEqual([
      'c_isometric_tendon',
    ]);
    // Advanced exercises are scored below beginner-friendly ones.
    const jumps = r.exercises.find((x) => x.slot === 'jump_plyometric')!;
    expect(jumps.candidates[0]!.name).toBe('cmj_jump');
  });

  it('trained adult with no risk factors: no intro phase (it is not a default for everyone)', () => {
    const r = runDecisionEngine(
      footballer({ person: { age: 25, sex: 'male', experience: 'advanced', yearsTraining: 8 } }),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS)),
    );
    expect(r.introPhase.level).toBe('ninguna');
  });

  it('older adult for health: progressive strength for older adults, evidence that applies', () => {
    const r = runDecisionEngine(
      footballer({
        person: { age: 72, sex: 'female', experience: 'beginner', yearsTraining: 0 },
        goals: {
          primary: { slug: 'general_health', family: 'health', sport: null, sportType: null },
          secondary: [],
        },
        populations: ['older_adults', 'adults_untrained'],
        metrics: {},
        derived: {},
        availability: { daysPerWeek: 2, minutesPerSession: 45 },
      }),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS)),
    );
    expect(r.methods[0]!.method).toBe('fuerza-mayores');
    expect(r.doses).toContainEqual(
      expect.objectContaining({ method: 'fuerza-mayores', variable: 'pct_1rm', min: 70, max: 79 }),
    );
    expect(r.planSkeleton?.templateSlug).toBe('salud-2d');
    expect(r.methods.flatMap((m) => m.explanation.applicability).join(' ')).toMatch(
      /coincide \(adultos mayores\)/,
    );
  });

  it('low adherence and little time limit the priorities; concurrent goals warn', () => {
    const r = runDecisionEngine(
      footballer({
        goals: {
          primary: { slug: 'hypertrophy', family: 'muscle', sport: null, sportType: null },
          secondary: [
            { slug: 'endurance_sport_performance', weight: 1, sport: 'distance_running' },
          ],
        },
        response: { adherence28: 50, painFlag: false, srpeHigh: false },
        availability: { daysPerWeek: 2, minutesPerSession: 45 },
      }),
      knowledge(rulesWith(FOOTBALL_THRESHOLDS)),
    );
    expect(r.priorities.length).toBeLessThanOrEqual(2);
    expect(r.warnings.join(' ')).toMatch(/Objetivos concurrentes/);
    expect(r.methods.some((m) => m.method === 'dosis-minima')).toBe(true);
  });

  it('missing data is reported and lowers confidence; unknown thresholds are pending, not invented', () => {
    const r = runDecisionEngine(
      footballer({ metrics: {}, derived: {}, missing: ['Sin evaluación de fuerza en 90 días.'] }),
      knowledge(DEFAULT_DECISION_RULES),
    );
    expect(r.warnings).toContain('Sin evaluación de fuerza en 90 días.');
    expect(r.pendingRules.map((p) => p.key)).toEqual(
      expect.arrayContaining([
        'profile.relative_strength_low',
        'profile.cmj_low',
        'profile.sprint_slow',
      ]),
    );
    expect(r.needs.every((n) => n.explanation.confidence !== 'high')).toBe(true);
    for (const t of r.traits) expect(t.value).toBeNull();
  });
});
