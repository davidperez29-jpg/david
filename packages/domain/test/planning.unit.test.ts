import { describe, expect, it } from 'vitest';
import {
  addDays,
  defaultWeekTypes,
  doubleProgression,
  expandTemplate,
  isoWeekday,
  loadFromPct,
  prescriptionForClient,
  prescriptionForWeek,
  prescriptionShort,
  rirAdjustment,
  validateDefinition,
  validatePrescription,
  weekDates,
  weekIndicators,
  weeksFor,
  type TemplateDefinition,
} from '../src';

describe('prescription', () => {
  it('writes plain-language text for the client', () => {
    expect(prescriptionForClient({ sets: 4, repsMin: 8, repsMax: 8, rirMin: 2, rirMax: 2 })).toBe(
      '4 series de 8 repeticiones dejando aproximadamente 2 repeticiones en reserva.',
    );
    expect(prescriptionForClient({ sets: 3, durationS: 30, restS: 60 })).toBe(
      '3 series de 30 s y descansando 1 min entre series.',
    );
    expect(
      prescriptionForClient({ sets: 1, repsMin: 10, repsMax: 12, rirMin: 1, rirMax: 1 }),
    ).toContain('1 repetición en reserva');
  });
  it('compact notation for the trainer', () => {
    expect(
      prescriptionShort({
        sets: 4,
        repsMin: 8,
        repsMax: 10,
        rirMin: 1,
        rirMax: 2,
        loadPct1rm: 75,
        restS: 120,
      }),
    ).toBe('4×8–10 · @ RIR 1–2 · 75 % 1RM · descanso 2 min');
  });
  it('validates ranges, tempo, RIR vs RPE and the VBT rule', () => {
    expect(
      validatePrescription(
        { sets: 3, repsMin: 8, repsMax: 12, rirMin: 1, rirMax: 3 },
        { supportsVbt: false },
      ),
    ).toEqual({});
    const bad = validatePrescription(
      { repsMin: 12, repsMax: 8, rirMin: 11, rpeTarget: 8.3, tempo: '3-1-1', velocityLossPct: 20 },
      { supportsVbt: false },
    );
    expect(Object.keys(bad).sort()).toEqual(
      ['repsMax', 'rirMin', 'rpeTarget', 'tempo', 'velocityTargetMps'].sort(),
    );
    expect(
      validatePrescription(
        { velocityLossPct: 20 },
        { supportsVbt: true, clientExperience: 'beginner' },
      ).velocityTargetMps,
    ).toBeTruthy();
    expect(
      validatePrescription(
        { velocityLossPct: 20 },
        { supportsVbt: true, clientExperience: 'advanced' },
      ),
    ).toEqual({});
    expect(
      validatePrescription({ rirMin: 2, rpeTarget: 8 }, { supportsVbt: false }).rpeTarget,
    ).toBeTruthy();
  });
  it('converts %1RM to kg from a measured 1RM, rounded to the increment', () => {
    expect(loadFromPct(75, 102)).toBe(77.5);
    expect(loadFromPct(80, 100, 1)).toBe(80);
  });
});

describe('structure and dates', () => {
  it('weeks per duration and default week types', () => {
    expect([3, 6, 9, 12].map(weeksFor)).toEqual([13, 26, 39, 52]);
    expect(defaultWeekTypes(4)).toEqual(['introduction', 'progression', 'progression', 'deload']);
    expect(defaultWeekTypes(2)).toEqual(['introduction', 'progression']);
  });
  it('places sessions on the client weekdays from the start date', () => {
    expect(isoWeekday('2026-10-05')).toBe(1); // Monday
    expect(weekDates('2026-10-07', 1, [1, 3, 5])).toEqual([
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
    ]);
    expect(weekDates('2026-10-05', 2, [1, 3, 5])).toEqual([
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
    ]);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('progression rules', () => {
  const base = { sets: 3, repsMin: 8, repsMax: 10, rirMin: 3, rirMax: 3, loadKg: 60 };
  it('RIR wave lowers RIR each loading week down to the floor; deload removes a set and adds RIR', () => {
    const rule = { kind: 'rir_wave' as const, step: 1, floor: 1 };
    expect(
      prescriptionForWeek(base, rule, { weekType: 'introduction', loadingIndex: 0 }).rirMin,
    ).toBe(3);
    expect(
      prescriptionForWeek(base, rule, { weekType: 'progression', loadingIndex: 2 }).rirMin,
    ).toBe(1);
    expect(
      prescriptionForWeek(base, rule, { weekType: 'progression', loadingIndex: 5 }).rirMin,
    ).toBe(1);
    expect(prescriptionForWeek(base, rule, { weekType: 'deload', loadingIndex: 3 })).toMatchObject({
      sets: 2,
      rirMin: 5,
    });
  });
  it('linear load with a cap and add-set progression', () => {
    expect(
      prescriptionForWeek(
        base,
        { kind: 'linear_load', incrementKg: 2.5, capKg: 64 },
        { weekType: 'progression', loadingIndex: 3 },
      ).loadKg,
    ).toBe(64);
    expect(
      prescriptionForWeek(
        base,
        { kind: 'add_set', everyWeeks: 2, maxSets: 4 },
        { weekType: 'progression', loadingIndex: 4 },
      ).sets,
    ).toBe(4);
    expect(
      prescriptionForWeek({ sets: 1 }, undefined, { weekType: 'deload', loadingIndex: 0 }).sets,
    ).toBe(1);
  });
  it('post-session proposals never apply changes, they propose with a reason', () => {
    const t = { repsMax: 10, rirMin: 2, loadKg: 60 };
    expect(
      doubleProgression(
        t,
        [
          { reps: 10, rir: 2, loadKg: 60 },
          { reps: 10, rir: 2, loadKg: 60 },
        ],
        2.5,
      ),
    ).toMatchObject({ action: 'increase_load', toKg: 62.5 });
    expect(
      doubleProgression(
        t,
        [
          { reps: 10, rir: 2, loadKg: 60 },
          { reps: 8, rir: 1, loadKg: 60 },
        ],
        2.5,
      ).action,
    ).toBe('hold');
    expect(rirAdjustment({ rirMin: 1, rirMax: 2, loadKg: 60 }, [4, 4], 2.5).action).toBe(
      'increase_load',
    );
    expect(rirAdjustment({ rirMin: 2, rirMax: 3, loadKg: 60 }, [0, 0], 2.5).action).toBe(
      'decrease_load',
    );
    expect(rirAdjustment({ rirMin: 1, rirMax: 2, loadKg: 60 }, [4], 2.5).action).toBe('hold');
  });
});

describe('template expansion', () => {
  const def: TemplateDefinition = {
    durationMonths: 3,
    sessionsPerWeek: 2,
    phases: [
      { name: 'Base', mesocycles: [{ name: 'M1', weeks: 4 }] },
      {
        name: 'Desarrollo',
        mesocycles: [
          { name: 'M2', weeks: 4, weekTypes: ['progression', 'progression', 'peak', 'test'] },
        ],
      },
    ],
    sessions: [
      {
        dayLabel: 'A',
        title: 'Full body A',
        blocks: [
          {
            type: 'main_strength',
            exercises: [
              {
                exercise: 'back_squat',
                prescription: { sets: 3, repsMin: 8, repsMax: 10, rirMin: 3, rirMax: 3 },
                progression: { kind: 'rir_wave', step: 1, floor: 1 },
              },
            ],
          },
        ],
      },
      { dayLabel: 'B', title: 'Full body B', blocks: [] },
    ],
  };
  it('validates the definition', () => {
    expect(validateDefinition(def)).toEqual([]);
    expect(validateDefinition({ ...def, sessionsPerWeek: 3 }).map((i) => i.path)).toContain(
      'sessions',
    );
    expect(
      validateDefinition({
        ...def,
        phases: [{ name: 'x', mesocycles: [{ name: 'm', weeks: 14 }] }],
      }).map((i) => i.path),
    ).toContain('phases');
  });
  it('expands weeks with dates and per-week progression; restarts the wave each mesocycle', () => {
    const e = expandTemplate(def, { startDate: '2026-10-05', weekdays: [4, 1] });
    expect(e.totalWeeks).toBe(8);
    expect(e.endDate).toBe('2026-11-29');
    expect(e.phases[1]).toMatchObject({ startWeek: 5, endWeek: 8 });
    const weeks = e.phases.flatMap((p) => p.mesocycles.flatMap((m) => m.microcycles));
    expect(weeks.map((w) => w.weekType)).toEqual([
      'introduction',
      'progression',
      'progression',
      'deload',
      'progression',
      'progression',
      'peak',
      'test',
    ]);
    expect(weeks[0]!.sessions.map((s) => s.date)).toEqual(['2026-10-05', '2026-10-08']);
    const rir = (w: number) => weeks[w]!.sessions[0]!.blocks[0]!.exercises[0]!.prescription.rirMin;
    expect([0, 1, 2, 3, 4, 5, 6].map(rir)).toEqual([3, 2, 1, 5, 3, 2, 1]);
  });
  it('explicit weeks saved from a plan are kept as they are', () => {
    const e = expandTemplate({
      ...def,
      weeks: [
        {
          weekIndex: 2,
          sessions: [
            { dayLabel: 'A', title: 'Especial', blocks: [] },
            { dayLabel: 'B', title: 'B', blocks: [] },
          ],
        },
      ],
    });
    expect(e.phases[0]!.mesocycles[0]!.microcycles[1]!.sessions[0]!.title).toBe('Especial');
    expect(e.endDate).toBeNull();
  });
});

describe('indicators', () => {
  it('counts sets per muscle group (primary 1, secondary 0.5), pull:push, contacts and warns above thresholds', () => {
    const ex = (
      pattern: string,
      sets: number,
      muscles: { group: string; role: 'primary' | 'secondary' }[],
      extra = {},
    ) => ({
      sets,
      repsMin: 8,
      repsMax: 10,
      durationS: null,
      distanceM: null,
      contacts: null,
      restS: 90,
      patternSlug: pattern,
      profileSlug: 'loaded_dynamic',
      contactsPerRep: null,
      muscles,
      ...extra,
    });
    const w = weekIndicators([
      {
        id: 's1',
        exercises: [
          ex('horizontal_push', 4, [
            { group: 'chest', role: 'primary' },
            { group: 'triceps', role: 'secondary' },
          ]),
          ex('horizontal_pull', 3, [{ group: 'back', role: 'primary' }]),
        ],
      },
      {
        id: 's2',
        exercises: [
          ex('horizontal_push', 18, [{ group: 'chest', role: 'primary' }]),
          ex('jump_plyometric', 3, [], {
            profileSlug: 'plyometric',
            repsMax: 5,
            contactsPerRep: 1,
          }),
        ],
      },
    ]);
    expect(w.setsByMuscleGroup).toMatchObject({ chest: 22, triceps: 2, back: 3 });
    expect(w.pullPushRatio).toBe(0.14);
    expect(w.plyoContacts).toBe(15);
    expect(w.warnings[0]!.message).toMatch(/chest/);
    expect(w.warnings[0]!.level).toMatch(/F/);
    expect(w.sessionMinutes.s1).toBeGreaterThan(5);
  });
});
