import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DomainError,
  expandTemplate,
  fitToDuration,
  groupsIntoLatestVersion,
  matchesTemplate,
  missingEquipment,
  PLAN_DURATIONS,
  templateExerciseRefs,
  templateFitScore,
  validateDefinition,
  weeksFor,
  withEditorIds,
  type TemplateDefinition,
  type TemplateFacts,
  type TemplateSession,
} from '../src';

const session = (label: string, exercise: string): TemplateSession => ({
  dayLabel: label,
  title: `Sesión ${label}`,
  blocks: [
    {
      type: 'main_strength',
      exercises: [
        {
          exercise,
          prescription: { sets: 3, repsMin: 8, repsMax: 10, rirMin: 3, rirMax: 3 },
          progression: { kind: 'rir_wave', step: 1, floor: 1 },
        },
      ],
    },
  ],
});

/** Three phases of 13 weeks (4 + 4 + 5), each with its own weekly pattern. */
const yearly: TemplateDefinition = {
  durationMonths: 12,
  sessionsPerWeek: 2,
  sessions: [session('A', 'goblet_squat'), session('B', 'push_up')],
  phases: ['Adaptación', 'Desarrollo', 'Consolidación'].map((name, i) => ({
    name,
    mesocycles: [
      { name: `${name} 1`, weeks: 4 },
      { name: `${name} 2`, weeks: 4 },
      { name: `${name} 3`, weeks: 5 },
    ],
    ...(i > 0 ? { sessions: [session('A', `squat_${i}`), session('B', `press_${i}`)] } : {}),
  })),
};

const facts = (over: Partial<TemplateFacts> = {}): TemplateFacts => ({
  name: 'Hipertrofia · Nivel 2 · 3 días',
  description: 'Cuerpo completo',
  profileSlug: 'hipertrofia',
  levelN: 2,
  sessionsPerWeek: 3,
  population: ['adultos'],
  equipmentSlugs: ['barbell', 'dumbbells'],
  kind: 'training',
  isGlobal: true,
  archived: false,
  ...over,
});

describe('template library filters', () => {
  it('filters by profile, level, days, population, kind and origin', () => {
    const t = facts();
    expect(matchesTemplate(t, {})).toBe(true);
    expect(matchesTemplate(t, { profile: 'hipertrofia', level: 2, days: 3 })).toBe(true);
    expect(matchesTemplate(t, { profile: 'fuerza' })).toBe(false);
    expect(matchesTemplate(t, { level: 1 })).toBe(false);
    expect(matchesTemplate(t, { days: 4 })).toBe(false);
    expect(matchesTemplate(t, { population: 'adultos' })).toBe(true);
    expect(matchesTemplate(t, { population: 'adulto_mayor' })).toBe(false);
    expect(matchesTemplate(t, { kind: 'risk_reduction' })).toBe(false);
    expect(matchesTemplate(t, { scope: 'global' })).toBe(true);
    expect(matchesTemplate(t, { scope: 'mine' })).toBe(false);
    // A template for any level or any population is not excluded by those filters.
    expect(
      matchesTemplate(facts({ levelN: null, population: [] }), { level: 1, population: 'jovenes' }),
    ).toBe(true);
  });

  it('archived templates only appear when asking for them', () => {
    expect(matchesTemplate(facts({ archived: true }), {})).toBe(false);
    expect(matchesTemplate(facts({ archived: true }), { archived: true })).toBe(true);
    expect(matchesTemplate(facts(), { archived: true })).toBe(false);
  });

  it('equipment: only templates the client can do with what they have', () => {
    expect(missingEquipment(['barbell', 'dumbbells'], ['dumbbells'])).toEqual(['barbell']);
    expect(matchesTemplate(facts(), { equipment: ['dumbbells'] })).toBe(false);
    expect(matchesTemplate(facts(), { equipment: ['barbell', 'dumbbells', 'bench'] })).toBe(true);
    expect(matchesTemplate(facts({ equipmentSlugs: [] }), { equipment: [] })).toBe(true);
  });

  it('text search ignores accents, case and word order', () => {
    expect(matchesTemplate(facts(), { q: 'COMPLETO hipertrofia' })).toBe(true);
    expect(matchesTemplate(facts(), { q: 'cuerpo completo nivel 2' })).toBe(true);
    expect(matchesTemplate(facts(), { q: 'potencia' })).toBe(false);
  });

  it('suggests first what suits the client: profile, then level, days and equipment', () => {
    const client = {
      profileSlug: 'hipertrofia',
      levelN: 2,
      sessionsPerWeek: 3,
      equipment: ['barbell', 'dumbbells'],
    };
    const ranked = [
      facts({ name: 'otro perfil', profileSlug: 'fuerza' }),
      facts({ name: 'nivel 3', levelN: 3 }),
      facts({ name: 'exacta' }),
      facts({ name: 'nivel 1, 2 días', levelN: 1, sessionsPerWeek: 2 }),
    ].sort((a, b) => templateFitScore(b, client) - templateFitScore(a, client));
    expect(ranked.map((t) => t.name)).toEqual([
      'exacta',
      'nivel 3',
      'nivel 1, 2 días',
      'otro perfil',
    ]);
    // With the same fit, the centre's own template goes first.
    expect(templateFitScore(facts({ isGlobal: false }), client)).toBeGreaterThan(
      templateFitScore(facts(), client),
    );
  });
});

describe('template versions', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const latest = { createdBy: 'u1', updatedAt: new Date('2026-10-05T11:45:00Z'), usedByPlans: 0 };
  it('consecutive edits by the same person are one version', () => {
    expect(groupsIntoLatestVersion(latest, 'u1', now)).toBe(true);
  });
  it('a new version when someone else edits, after a while, or once a plan used it', () => {
    expect(groupsIntoLatestVersion(latest, 'u2', now)).toBe(false);
    expect(
      groupsIntoLatestVersion(
        { ...latest, updatedAt: new Date('2026-10-05T11:00:00Z') },
        'u1',
        now,
      ),
    ).toBe(false);
    expect(groupsIntoLatestVersion({ ...latest, usedByPlans: 1 }, 'u1', now)).toBe(false);
  });
});

describe('template content', () => {
  it('lists every exercise once, in the default pattern, the phases and explicit weeks', () => {
    expect(templateExerciseRefs(yearly)).toEqual([
      'goblet_squat',
      'push_up',
      'squat_1',
      'press_1',
      'squat_2',
      'press_2',
    ]);
  });

  it('editor ids: every row gets one, existing ids are kept, nothing else changes', () => {
    let n = 0;
    const withIds = withEditorIds(yearly, () => `id${++n}`);
    const rows = [...withIds.sessions, ...withIds.phases.flatMap((p) => p.sessions ?? [])].flatMap(
      (s) => s.blocks.flatMap((b) => b.exercises),
    );
    expect(rows.every((e) => e.id)).toBe(true);
    expect(new Set(rows.map((e) => e.id)).size).toBe(rows.length);
    expect(withEditorIds(withIds, () => 'new')).toEqual(withIds);
    expect(expandTemplate(withIds).totalWeeks).toBe(expandTemplate(yearly).totalWeeks);
  });

  it('each phase uses its own weekly pattern', () => {
    const plan = expandTemplate(yearly);
    const firstExercise = (week: number) =>
      plan.phases
        .flatMap((p) => p.mesocycles.flatMap((m) => m.microcycles))
        .find((w) => w.weekIndex === week)!.sessions[0]!.blocks[0]!.exercises[0]!.exercise;
    expect(firstExercise(1)).toBe('goblet_squat');
    expect(firstExercise(14)).toBe('squat_1');
    expect(firstExercise(39)).toBe('squat_2');
  });

  it('a phase pattern with the wrong number of sessions is reported', () => {
    const bad = { ...yearly, phases: [{ ...yearly.phases[1]!, sessions: [session('A', 'x')] }] };
    expect(validateDefinition(bad).map((i) => i.path)).toContain('phases.0.sessions');
  });
});

describe('fitting a template to the duration chosen', () => {
  const weeksOf = (d: TemplateDefinition) =>
    d.phases.reduce((a, p) => a + p.mesocycles.reduce((b, m) => b + m.weeks, 0), 0);

  it('3 months takes the first phase; 12 months repeats the phases as new cycles', () => {
    const three = fitToDuration(yearly, 3);
    expect(three.phases.map((p) => p.name)).toEqual(['Adaptación']);
    expect(weeksOf(three)).toBe(13);
    const twelve = fitToDuration(yearly, 12);
    expect(twelve.phases.map((p) => p.name)).toEqual([
      'Adaptación',
      'Desarrollo',
      'Consolidación',
      'Adaptación (ciclo 2)',
    ]);
    expect(weeksOf(twelve)).toBe(52);
    expect(validateDefinition(twelve)).toEqual([]);
  });

  it('a shortened mesocycle keeps its closing deload when there is room', () => {
    const def: TemplateDefinition = {
      ...yearly,
      phases: [
        {
          name: 'Única',
          mesocycles: [
            { name: 'M', weeks: 14, weekTypes: [...Array(13).fill('progression'), 'deload'] },
          ],
        },
      ],
    };
    const fitted = fitToDuration(def, 3);
    expect(fitted.phases[0]!.mesocycles[0]!.weeks).toBe(13);
    expect(fitted.phases[0]!.mesocycles[0]!.weekTypes!.at(-1)).toBe('deload');
  });

  it('a template saved from a real plan can be shortened, not extended', () => {
    const real: TemplateDefinition = {
      ...yearly,
      durationMonths: 3,
      phases: [{ name: 'Plan', mesocycles: [{ name: 'M', weeks: 13 }] }],
      weeks: [{ weekIndex: 1, sessions: yearly.sessions }],
    };
    expect(() => fitToDuration(real, 6)).toThrow(DomainError);
    expect(fitToDuration(real, 3).weeks).toHaveLength(1);
  });

  it('for any duration the plan fills the duration, at most 2 weeks short, and stays valid (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 16 }), { minLength: 1, maxLength: 6 }),
        fc.constantFrom(...PLAN_DURATIONS),
        (lengths, months) => {
          const def: TemplateDefinition = {
            ...yearly,
            durationMonths: 3,
            phases: [
              { name: 'F', mesocycles: lengths.map((w, i) => ({ name: `M${i}`, weeks: w })) },
            ],
          };
          const fitted = fitToDuration(def, months);
          const weeks = weeksOf(fitted);
          expect(weeks).toBeLessThanOrEqual(weeksFor(months));
          expect(weeks).toBeGreaterThanOrEqual(weeksFor(months) - 2);
          expect(expandTemplate(fitted).totalWeeks).toBe(weeks);
          expect(validateDefinition(fitted)).toEqual([]);
          // No mesocycle was cut below 3 weeks.
          const cut = fitted.phases
            .flatMap((p) => p.mesocycles)
            .filter((m) => !lengths.includes(m.weeks));
          expect(cut.every((m) => m.weeks >= 3)).toBe(true);
        },
      ),
    );
  });

  it('a 12-week template used for 6 months is two full cycles, without a 2-week stub', () => {
    const twelveWeeks: TemplateDefinition = {
      ...yearly,
      durationMonths: 3,
      phases: [
        {
          name: 'Bloque',
          mesocycles: [
            { name: 'M1', weeks: 4 },
            { name: 'M2', weeks: 4 },
            { name: 'M3', weeks: 4 },
          ],
        },
      ],
    };
    const six = fitToDuration(twelveWeeks, 6);
    expect(six.phases.map((p) => p.name)).toEqual(['Bloque', 'Bloque (ciclo 2)']);
    expect(weeksOf(six)).toBe(24);
  });
});
