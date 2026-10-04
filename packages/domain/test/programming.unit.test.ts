import { describe, expect, it } from 'vitest';
import {
  adaptTemplate,
  changesFor,
  expandTemplate,
  loadIncrementFor,
  proposeAdjustments,
  proposeLoadChange,
  type ExerciseHistory,
  type PlannedTarget,
  type ProgrammingInput,
  type TemplateDefinition,
} from '../src';

const target = (over: Partial<PlannedTarget> = {}): PlannedTarget => ({
  sessionExerciseId: 'se1',
  sessionId: 's1',
  date: '2026-10-06',
  weekIndex: 5,
  exerciseId: 'squat',
  exerciseName: 'Sentadilla',
  sets: 4,
  repsMin: 6,
  repsMax: 8,
  rirMin: 1,
  rirMax: 3,
  loadKg: 80,
  ...over,
});
const squatHistory = (sets: { reps: number; rir: number | null }[][]): ExerciseHistory => ({
  exerciseId: 'squat',
  exerciseName: 'Sentadilla',
  equipment: ['barbell', 'squat_rack'],
  sessions: sets.map((ss, i) => ({
    date: `2026-09-${String(28 + i).padStart(2, '0')}`,
    target: { repsMin: 6, repsMax: 8, rirMin: 1, rirMax: 3, loadKg: 80 },
    sets: ss.map((s) => ({ ...s, loadKg: 80 })),
  })),
});
const input = (over: Partial<ProgrammingInput> = {}): ProgrammingInput => ({
  today: '2026-10-04',
  upcoming: [
    target(),
    target({ sessionExerciseId: 'se2', sessionId: 's2', date: '2026-10-08', loadKg: 82.5 }),
    target({ sessionExerciseId: 'se3', sessionId: 's3', date: '2026-10-30', weekIndex: 8 }),
  ],
  history: [],
  signals: { srpeHigh: false, wellnessLow: false, adherenceLow: false, partialSessions: false },
  pains: [],
  painThreshold: 4,
  substitutes: {},
  ...over,
});

describe('week-to-week load (§12.7)', () => {
  it('double progression: all sets at the top of the range with the target RIR → +2.5 kg on a barbell', () => {
    const r = proposeLoadChange(
      squatHistory([
        [
          { reps: 8, rir: 2 },
          { reps: 8, rir: 2 },
          { reps: 8, rir: 1 },
        ],
      ]),
    );
    expect(r).toMatchObject({
      action: 'increase_load',
      fromKg: 80,
      toKg: 82.5,
      rule: 'double_progression',
    });
  });

  it('RIR far above the target in 2 sessions → +load; far below → −load; within → nothing', () => {
    const easy = proposeLoadChange(squatHistory([[{ reps: 6, rir: 5 }], [{ reps: 6, rir: 5 }]]));
    expect(easy).toMatchObject({ action: 'increase_load', rule: 'rir_adjustment' });
    // Target RIR 3–4 (e.g. a technique block) but logged at RIR 1 twice.
    const h = squatHistory([[{ reps: 6, rir: 1 }], [{ reps: 6, rir: 1 }]]);
    for (const s of h.sessions) Object.assign(s.target, { rirMin: 3, rirMax: 4 });
    expect(proposeLoadChange(h)).toMatchObject({ action: 'decrease_load', toKg: 77.5 });
    expect(
      proposeLoadChange(squatHistory([[{ reps: 7, rir: 2 }], [{ reps: 7, rir: 2 }]])),
    ).toBeNull();
  });

  it('fixed reps (5×5) are not progressed by double progression', () => {
    const h = squatHistory([[{ reps: 5, rir: 2 }]]);
    Object.assign(h.sessions[0]!.target, { repsMin: 5, repsMax: 5 });
    expect(proposeLoadChange(h)).toBeNull();
  });

  it('increment by equipment (practical, level F)', () => {
    expect(loadIncrementFor(['barbell'])).toBe(2.5);
    expect(loadIncrementFor(['dumbbells'])).toBe(2);
    expect(loadIncrementFor(['bodyweight'])).toBe(1);
  });

  it('a load proposal shifts the next 2 weeks of planned loads, keeping the planned progression', () => {
    const [c] = proposeAdjustments(
      input({
        history: [
          squatHistory([
            [
              { reps: 8, rir: 2 },
              { reps: 8, rir: 2 },
            ],
          ]),
        ],
      }),
    );
    expect(c).toMatchObject({ kind: 'load_progression', key: 'load:squat:2026-09-28' });
    // Only sessions within 14 days are targets (s3 is later).
    expect(c!.targets.map((t) => t.sessionExerciseId)).toEqual(['se1', 'se2']);
    expect(changesFor(c!.kind, c!.params, c!.targets)).toEqual([
      { sessionExerciseId: 'se1', field: 'loadKg', from: 80, to: 82.5 },
      { sessionExerciseId: 'se2', field: 'loadKg', from: 82.5, to: 85 },
    ]);
    // The trainer edits the target load: the change is recomputed from the same targets.
    expect(changesFor(c!.kind, { ...c!.params, toKg: 85 }, c!.targets)[0]!.to).toBe(85);
    expect(c!.explanation.limitations.join(' ')).toMatch(/autoinformado/);
    expect(c!.explanation.evidence).toEqual([]);
  });
});

describe('adjustments by response', () => {
  it('sRPE high → next whole week ahead as deload (−1 set, RIR +2)', () => {
    const cs = proposeAdjustments(
      input({
        signals: { srpeHigh: true, wellnessLow: false, adherenceLow: true, partialSessions: false },
      }),
    );
    expect(cs.map((c) => c.kind)).toEqual(['deload_week']);
    const c = cs[0]!;
    expect(c.key).toBe('deload:5');
    expect(changesFor(c.kind, c.params, c.targets)).toContainEqual({
      sessionExerciseId: 'se1',
      field: 'sets',
      from: 4,
      to: 3,
    });
    expect(changesFor(c.kind, c.params, c.targets)).toContainEqual({
      sessionExerciseId: 'se1',
      field: 'rirMin',
      from: 1,
      to: 3,
    });
    expect(c.explanation.limitations.join(' ')).toMatch(/REQUIERE VERIFICACIÓN/);
  });

  it('skips a week that already started (a session today)', () => {
    const cs = proposeAdjustments(
      input({
        today: '2026-10-07',
        signals: {
          srpeHigh: true,
          wellnessLow: false,
          adherenceLow: false,
          partialSessions: false,
        },
        upcoming: [
          target({ date: '2026-10-07' }),
          target({ sessionExerciseId: 'se3', date: '2026-10-13', weekIndex: 6 }),
        ],
      }),
    );
    expect(cs[0]!.key).toBe('deload:6');
    expect(cs[0]!.targets.map((t) => t.sessionExerciseId)).toEqual(['se3']);
  });

  it('low adherence → one set less on exercises with ≥ 3 sets (never below 2)', () => {
    const cs = proposeAdjustments(
      input({
        signals: {
          srpeHigh: false,
          wellnessLow: false,
          adherenceLow: true,
          partialSessions: false,
        },
        upcoming: [target(), target({ sessionExerciseId: 'se9', sets: 2 })],
      }),
    );
    expect(cs[0]).toMatchObject({ kind: 'volume_reduction', key: 'volume:5' });
    expect(changesFor(cs[0]!.kind, cs[0]!.params, cs[0]!.targets)).toEqual([
      { sessionExerciseId: 'se1', field: 'sets', from: 4, to: 3 },
    ]);
  });

  it('pain on an exercise → substitution with the pre-approved alternative first; never a diagnosis', () => {
    const cs = proposeAdjustments(
      input({
        pains: [
          { exerciseId: 'squat', exerciseName: 'Sentadilla', date: '2026-10-01', intensity: 5 },
          { exerciseId: 'bench', exerciseName: 'Press banca', date: '2026-10-01', intensity: 2 },
        ],
        substitutes: { squat: [{ id: 'box_squat', name: 'Sentadilla a cajón' }] },
      }),
    );
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ kind: 'substitution', params: { toExerciseId: 'box_squat' } });
    expect(cs[0]!.explanation.interpretation.join(' ')).toMatch(
      /No es un diagnóstico.*requiere valoración por profesional sanitario/,
    );
    expect(changesFor('substitution', { toExerciseId: 'box_squat' }, cs[0]!.targets)).toHaveLength(
      3,
    );
  });

  it('is deterministic and proposes nothing without signals or history', () => {
    expect(proposeAdjustments(input())).toEqual([]);
    const i = input({
      signals: { srpeHigh: true, wellnessLow: true, adherenceLow: false, partialSessions: false },
    });
    expect(proposeAdjustments(i)).toEqual(proposeAdjustments(i));
  });
});

describe('plan proposal from a template (§12.2.5)', () => {
  const def: TemplateDefinition = {
    durationMonths: 3,
    sessionsPerWeek: 1,
    phases: [
      {
        name: 'Base',
        mesocycles: [
          { name: 'M1', weeks: 4 },
          { name: 'M2', weeks: 4 },
        ],
      },
    ],
    sessions: [
      {
        dayLabel: 'A',
        title: 'Fuerza',
        blocks: [
          {
            type: 'strength',
            exercises: [
              {
                exercise: 'back_squat',
                prescription: { sets: 3, repsMin: 6, repsMax: 8, rirMin: 2, rirMax: 3 },
              },
            ],
          },
        ],
      },
    ],
  };

  it('adaptation phase: first 2 weeks introduction, later mesocycles untouched', () => {
    const a = adaptTemplate(def, {
      introLevel: 'fase de adaptación',
      replacements: [],
      templateName: 'Fuerza 1d',
    });
    const weeks = expandTemplate(a.definition).phases[0]!.mesocycles;
    expect(weeks[0]!.microcycles.map((w) => w.weekType)).toEqual([
      'introduction',
      'introduction',
      'progression',
      'deload',
    ]);
    expect(weeks[1]!.microcycles[0]!.weekType).toBe('introduction');
    expect(a.notes.join(' ')).toMatch(/Primeras 2 semanas de introducción/);
  });

  it('no intro phase for advanced clients; replacements keep the prescription', () => {
    const a = adaptTemplate(def, {
      introLevel: 'ninguna',
      replacements: [
        {
          from: 'back_squat',
          fromName: 'Sentadilla',
          to: 'id-box',
          toName: 'Sentadilla a cajón',
          reason: 'no tolerado',
        },
      ],
      templateName: 'Fuerza 1d',
    });
    const w1 = expandTemplate(a.definition).phases[0]!.mesocycles[0]!.microcycles[0]!;
    expect(w1.weekType).toBe('progression');
    expect(w1.sessions[0]!.blocks[0]!.exercises[0]).toMatchObject({
      exercise: 'id-box',
      prescription: { sets: 3 },
    });
    expect(a.notes).toContain('Sentadilla → Sentadilla a cajón: no tolerado');
    // The original definition is not mutated.
    expect(def.sessions[0]!.blocks[0]!.exercises[0]!.exercise).toBe('back_squat');
  });
});
