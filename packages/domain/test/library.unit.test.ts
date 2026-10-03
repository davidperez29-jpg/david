import { describe, expect, it } from 'vitest';
import {
  findProgressionCycle,
  normalizeName,
  parseVideoUrl,
  publishProblems,
  slugify,
  suggestSubstitutes,
  type ExerciseFacts,
  type SubstitutionContext,
} from '../src';

describe('names', () => {
  it('normalises accents, case and punctuation', () => {
    expect(normalizeName('  Sentadilla  BÚLGARA (mancuernas) ')).toBe(
      'sentadilla bulgara mancuernas',
    );
    expect(slugify('Peso muerto rumano – barra')).toBe('peso-muerto-rumano-barra');
  });
});

describe('parseVideoUrl', () => {
  it('accepts YouTube and Vimeo forms and canonicalises', () => {
    expect(parseVideoUrl('youtu.be/vzIA5Wd9wTU')?.canonicalUrl).toBe(
      'https://www.youtube.com/watch?v=vzIA5Wd9wTU',
    );
    expect(parseVideoUrl('https://www.youtube.com/watch?v=vzIA5Wd9wTU&t=3')?.id).toBe(
      'vzIA5Wd9wTU',
    );
    expect(parseVideoUrl('https://youtube.com/shorts/vzIA5Wd9wTU')?.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/vzIA5Wd9wTU',
    );
    expect(parseVideoUrl('https://vimeo.com/123456789')?.provider).toBe('vimeo');
  });
  it('rejects anything else', () => {
    for (const bad of [
      'javascript:alert(1)',
      'https://evil.example/watch?v=vzIA5Wd9wTU',
      'https://youtu.be/short',
      'ftp://youtu.be/vzIA5Wd9wTU',
      'no es una url',
    ]) {
      expect(parseVideoUrl(bad)).toBeNull();
    }
  });
});

describe('findProgressionCycle', () => {
  const p = (
    from: string,
    to: string,
    relation: 'progression' | 'regression' | 'variant' = 'progression',
  ) => ({ from, to, relation });
  it('detects contradictions across progression and regression edges', () => {
    // A → B → C harder; "C regression of… " expressed as A regression C means C easier? A→C regression = C easier than A.
    expect(findProgressionCycle([p('A', 'B'), p('B', 'C')], p('C', 'A'))).toEqual([
      'C',
      'A',
      'B',
      'C',
    ]);
    expect(findProgressionCycle([p('A', 'B')], p('A', 'B', 'regression'))).not.toBeNull();
  });
  it('allows consistent graphs and variants', () => {
    expect(findProgressionCycle([p('A', 'B'), p('B', 'C')], p('A', 'C'))).toBeNull();
    expect(findProgressionCycle([p('A', 'B')], p('B', 'A', 'variant'))).toBeNull();
    expect(findProgressionCycle([], p('A', 'A'))).toEqual(['A']);
  });
});

const ex = (id: string, o: Partial<ExerciseFacts> = {}): ExerciseFacts => ({
  id,
  name: id,
  movementPatternId: 'knee',
  categoryIds: ['strength'],
  methodIds: [],
  primaryMuscleGroups: ['quadriceps'],
  secondaryMuscleGroups: ['glutes'],
  equipmentIds: [],
  level: 'intermediate',
  technicalComplexity: 3,
  axialLoad: 'high',
  impactLevel: 'none',
  spaceRequired: 'small',
  laterality: 'bilateral',
  ...o,
});
const ctx = (o: Partial<SubstitutionContext> = {}): SubstitutionContext => ({
  reason: 'pain',
  availableEquipmentIds: null,
  notToleratedExerciseIds: [],
  restrictedPatternIds: [],
  regressionIds: [],
  progressionIds: [],
  variantIds: [],
  recentlyUsedIds: [],
  clientLevel: null,
  ...o,
});

describe('suggestSubstitutes', () => {
  const backSquat = ex('back_squat', { equipmentIds: ['barbell', 'rack'] });
  const goblet = ex('goblet', {
    equipmentIds: ['dumbbell'],
    axialLoad: 'low',
    technicalComplexity: 2,
    level: 'beginner',
  });
  const legPress = ex('leg_press', {
    equipmentIds: ['leg_press'],
    axialLoad: 'none',
    technicalComplexity: 1,
  });
  const frontSquat = ex('front_squat', {
    equipmentIds: ['barbell', 'rack'],
    technicalComplexity: 4,
    level: 'advanced',
  });
  const bench = ex('bench', {
    movementPatternId: 'hpush',
    primaryMuscleGroups: ['chest'],
    secondaryMuscleGroups: ['triceps'],
  });
  const all = [backSquat, goblet, legPress, frontSquat, bench];

  it('applies hard filters with explicit exclusion reasons', () => {
    const r = suggestSubstitutes(
      backSquat,
      all,
      ctx({
        availableEquipmentIds: ['dumbbell', 'barbell', 'rack'],
        notToleratedExerciseIds: ['front_squat'],
      }),
    );
    expect(r.suggestions.map((s) => s.exerciseId)).toEqual(['goblet']);
    expect(r.excluded).toEqual(
      expect.arrayContaining([
        { exerciseId: 'back_squat', reason: 'same_exercise' },
        { exerciseId: 'leg_press', reason: 'missing_equipment' },
        { exerciseId: 'front_squat', reason: 'not_tolerated' },
      ]),
    );
  });

  it('with pain, prefers lower axial load and explains why', () => {
    const r = suggestSubstitutes(backSquat, all, ctx({ reason: 'pain' }));
    const order = r.suggestions.map((s) => s.exerciseId);
    expect(order.slice(0, 2).sort()).toEqual(['goblet', 'leg_press']);
    expect(order.indexOf('front_squat')).toBeGreaterThan(1);
    expect(r.suggestions[0]!.reasons).toContain('Menor carga axial o impacto');
    expect(r.suggestions.map((s) => s.exerciseId)).not.toContain('bench'); // different stimulus
  });

  it('when too difficult, prefers simpler exercises and penalises progressions', () => {
    const r = suggestSubstitutes(
      backSquat,
      all,
      ctx({ reason: 'too_difficult', progressionIds: ['front_squat'], regressionIds: ['goblet'] }),
    );
    expect(r.suggestions[0]!.exerciseId).toBe('goblet');
    expect(r.suggestions.at(-1)!.exerciseId).toBe('front_squat');
  });

  it('respects restricted patterns', () => {
    const r = suggestSubstitutes(backSquat, all, ctx({ restrictedPatternIds: ['knee'] }));
    expect(r.suggestions).toHaveLength(0);
  });
});

describe('publishProblems', () => {
  const base = {
    name: 'x',
    movementPatternId: 'p',
    patternFamily: 'lower',
    categoryCount: 1,
    primaryMuscleCount: 1,
    level: 'beginner',
    clientDescription: 'Baja controlado',
    prescriptionProfileId: 'pp',
    needsReview: false,
  };
  it('accepts complete exercises', () => expect(publishProblems(base)).toEqual([]));
  it('lists every missing element', () => {
    expect(
      publishProblems({
        ...base,
        movementPatternId: null,
        patternFamily: null,
        categoryCount: 0,
        primaryMuscleCount: 0,
        level: null,
        clientDescription: ' ',
        prescriptionProfileId: null,
        needsReview: true,
      }).sort(),
    ).toEqual(
      [
        'missing_category',
        'missing_client_description',
        'missing_level',
        'missing_pattern',
        'missing_prescription_profile',
        'pending_review',
      ].sort(),
    );
    expect(publishProblems({ ...base, primaryMuscleCount: 0 })).toEqual(['missing_primary_muscle']);
    expect(
      publishProblems({ ...base, primaryMuscleCount: 0, patternFamily: 'conditioning' }),
    ).toEqual([]);
  });
});
