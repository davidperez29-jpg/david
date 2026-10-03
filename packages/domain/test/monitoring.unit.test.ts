import { describe, expect, it } from 'vitest';
import {
  adherence,
  addDays,
  evaluateAlerts,
  resolveRules,
  sessionLoad,
  validateRuleConfig,
  weeklyLoad,
  wellnessScore,
  REFERRAL_TEXT,
  type MonitoringInput,
  type MonitoredSession,
  type PlannedSession,
} from '../src';

const TODAY = '2026-10-31';
const base = (over: Partial<MonitoringInput> = {}): MonitoringInput => ({
  today: TODAY,
  sessions: [],
  sets: [],
  pains: [],
  readiness: [],
  declines: [],
  reassessments: [],
  ...over,
});
const ses = (n: number, over: Partial<MonitoredSession> = {}): MonitoredSession => ({
  id: `s${n}`,
  date: addDays(TODAY, -n),
  title: `Sesión ${n}`,
  status: 'completed',
  reasonCode: null,
  sessionRpe: 6,
  targetRpe: null,
  ...over,
});
const rules = (key: string, parameters: Record<string, number> = {}) =>
  resolveRules(
    resolveRules()
      .map((r) => ({ ...r, enabled: r.key === key }))
      .map((r) => (r.key === key ? { ...r, parameters: { ...r.parameters, ...parameters } } : r)),
  );

describe('adherence', () => {
  it('24 planned / 21 done = 87.5 % (acceptance example, §16.2)', () => {
    const sessions: PlannedSession[] = Array.from({ length: 24 }, (_, i) => ({
      id: `s${i}`,
      date: addDays('2026-09-01', i),
      status: i < 19 ? 'completed' : i < 21 ? 'partial' : i < 23 ? 'missed' : null,
    }));
    const a = adherence(sessions, '2026-09-01', '2026-09-30');
    expect(a).toMatchObject({
      planned: 24,
      done: 21,
      completed: 19,
      partial: 2,
      missed: 2,
      unrecorded: 1,
    });
    expect(a.percent).toBe(87.5);
  });

  it('does not count rescheduled or cancelled sessions, nor sessions outside the window', () => {
    const a = adherence(
      [
        { id: 'a', date: '2026-09-01', status: 'completed' },
        { id: 'b', date: '2026-09-02', status: 'rescheduled' },
        { id: 'c', date: '2026-09-03', status: 'cancelled_by_trainer' },
        { id: 'd', date: '2026-10-05', status: 'completed' },
      ],
      '2026-09-01',
      '2026-09-30',
    );
    expect(a).toMatchObject({ planned: 1, done: 1, percent: 100 });
    expect(adherence([], '2026-09-01', '2026-09-30').percent).toBeNull();
  });
});

describe('internal load (sRPE)', () => {
  it('session load = sRPE × minutes; weekly load, monotony and strain', () => {
    expect(sessionLoad(6, 60)).toBe(360);
    expect(sessionLoad(null, 60)).toBeNull();
    const w = weeklyLoad(
      [
        { date: '2026-09-28', sessionRpe: 6, durationMin: 60 },
        { date: '2026-09-30', sessionRpe: 7, durationMin: 60 },
        { date: '2026-10-02', sessionRpe: 5, durationMin: 60 },
        { date: '2026-10-03', sessionRpe: null, durationMin: 60 },
      ],
      '2026-09-28',
      '2026-10-04',
    );
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ weekStart: '2026-09-28', sessions: 4, withLoad: 3, load: 1080 });
    // daily loads 360,0,420,0,300,0,0 → mean 154.3, SD (n−1) 195.5 → monotony 0.79
    expect(w[0]!.monotony).toBeCloseTo(0.79, 2);
    expect(w[0]!.strain).toBe(Math.round(1080 * w[0]!.monotony!));
  });

  it('no load → no monotony', () => {
    expect(weeklyLoad([], '2026-09-28', '2026-10-04')[0]).toMatchObject({
      load: 0,
      monotony: null,
    });
  });
});

describe('wellness', () => {
  it('reverses negative items and ignores unanswered ones', () => {
    expect(wellnessScore({ date: TODAY, energy: 8, fatigue: 2 })).toBe(8);
    expect(wellnessScore({ date: TODAY })).toBeNull();
  });
});

describe('alert rules', () => {
  it('adherence: yellow under 80 %, red under 60 %, silent with too few sessions', () => {
    const mk = (done: number, total: number) =>
      Array.from({ length: total }, (_, i) =>
        ses(i + 1, { status: i < done ? 'completed' : 'missed', reasonCode: 'work' }),
      );
    expect(evaluateAlerts(base({ sessions: mk(7, 8) }), rules('adherence_low'))).toHaveLength(0);
    const y = evaluateAlerts(base({ sessions: mk(6, 8) }), rules('adherence_low'));
    expect(y[0]).toMatchObject({ severity: 'yellow', key: 'adherence_low' });
    expect(y[0]!.message).toContain('75 %');
    expect(evaluateAlerts(base({ sessions: mk(4, 8) }), rules('adherence_low'))[0]!.severity).toBe(
      'red',
    );
    expect(evaluateAlerts(base({ sessions: mk(1, 3) }), rules('adherence_low'))).toHaveLength(0);
  });

  it('missed in a row: only without reason, and today does not count', () => {
    const s = [
      ses(0, { status: null }),
      ses(1, { status: null }),
      ses(3, { status: 'missed' }),
      ses(5),
    ];
    const a = evaluateAlerts(base({ sessions: s }), rules('missed_in_a_row'));
    expect(a[0]).toMatchObject({ severity: 'yellow', key: 'missed_in_a_row:s3' });
    const withReason = [
      ses(1, { status: 'missed', reasonCode: 'illness' }),
      ses(3, { status: null }),
    ];
    expect(evaluateAlerts(base({ sessions: withReason }), rules('missed_in_a_row'))).toHaveLength(
      0,
    );
  });

  it('partial sessions in the window', () => {
    const s = [1, 4, 9].map((n) => ses(n, { status: 'partial' }));
    expect(evaluateAlerts(base({ sessions: s }), rules('partial_sessions'))).toHaveLength(1);
    expect(
      evaluateAlerts(base({ sessions: s.slice(0, 2) }), rules('partial_sessions')),
    ).toHaveLength(0);
  });

  it('sRPE above target (or personal median) in the last sessions', () => {
    const withTarget = [1, 2, 3].map((n) => ses(n, { sessionRpe: 8, targetRpe: 6 }));
    expect(
      evaluateAlerts(base({ sessions: withTarget }), rules('srpe_high'))[0]!.message,
    ).toContain('lo previsto');
    const baseline = [
      ...[7, 8, 9, 10].map((n) => ses(n, { sessionRpe: 5 })),
      ...[1, 2, 3].map((n) => ses(n, { sessionRpe: 7 })),
    ];
    expect(evaluateAlerts(base({ sessions: baseline }), rules('srpe_high'))[0]!.message).toContain(
      'mediana',
    );
    const notAll = [1, 2, 3].map((n) => ses(n, { sessionRpe: n === 2 ? 6 : 8, targetRpe: 6 }));
    expect(evaluateAlerts(base({ sessions: notAll }), rules('srpe_high'))).toHaveLength(0);
  });

  it('RIR off target in 2 sessions of the same exercise → green proposal, never applied', () => {
    const set = (sessionId: string, n: number, rir: number) => ({
      sessionId,
      date: addDays(TODAY, -n),
      exerciseId: 'sq',
      exerciseName: 'Sentadilla',
      rir,
      rirMin: 1,
      rirMax: 2,
    });
    const a = evaluateAlerts(
      base({ sets: [set('a', 3, 4), set('a', 3, 5), set('b', 1, 4)] }),
      rules('rir_off_target'),
    );
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severity: 'green', key: 'rir_off_target:sq:easy' });
    expect(a[0]!.message).toContain('subir');
    expect(evaluateAlerts(base({ sets: [set('a', 3, 4)] }), rules('rir_off_target'))).toHaveLength(
      0,
    );
  });

  it('pain: yellow ≥ 4, red ≥ 7 or repeated in consecutive sessions, with referral, never a diagnosis', () => {
    const sessions = [ses(1), ses(3)];
    const y = evaluateAlerts(
      base({
        sessions,
        pains: [{ date: addDays(TODAY, -1), sessionId: 's1', where: 'Rodilla', intensity: 5 }],
      }),
      rules('pain'),
    );
    expect(y[0]).toMatchObject({ severity: 'yellow', key: 'pain:rodilla' });
    expect(y[0]!.message).not.toContain(REFERRAL_TEXT);
    const repeated = evaluateAlerts(
      base({
        sessions,
        pains: [
          { date: addDays(TODAY, -1), sessionId: 's1', where: 'rodilla', intensity: 5 },
          { date: addDays(TODAY, -3), sessionId: 's3', where: 'Rodilla ', intensity: 4 },
        ],
      }),
      rules('pain'),
    );
    expect(repeated).toHaveLength(1);
    expect(repeated[0]!.severity).toBe('red');
    expect(repeated[0]!.message).toContain(REFERRAL_TEXT);
    const intense = evaluateAlerts(
      base({ pains: [{ date: TODAY, sessionId: null, where: 'hombro', intensity: 7 }] }),
      rules('pain'),
    );
    expect(intense[0]!.severity).toBe('red');
    for (const a of [...y, ...repeated, ...intense])
      expect(a.message).not.toMatch(/tendinopat|lesión de|rotura|diagnóstico/i);
  });

  it('wellness low for consecutive recent days', () => {
    const low = (n: number) => ({ date: addDays(TODAY, -n), energy: 2, sleepQuality: 3 });
    expect(
      evaluateAlerts(base({ readiness: [low(0), low(1), low(2)] }), rules('wellness_low')),
    ).toHaveLength(1);
    // A gap breaks the run.
    expect(
      evaluateAlerts(base({ readiness: [low(0), low(1), low(3)] }), rules('wellness_low')),
    ).toHaveLength(0);
  });

  it('missing feedback, performance drop and overdue reassessment', () => {
    expect(
      evaluateAlerts(
        base({ sessions: [ses(2, { sessionRpe: null })] }),
        rules('feedback_missing'),
      )[0]!.severity,
    ).toBe('green');
    expect(
      evaluateAlerts(
        base({ declines: [{ testId: 't', testName: 'CMJ', date: addDays(TODAY, -10) }] }),
        rules('performance_drop'),
      )[0]!.message,
    ).toContain('CMJ');
    const r = { id: 'w12', weekIndex: 12, dueDate: addDays(TODAY, -10), assessed: false };
    expect(
      evaluateAlerts(base({ reassessments: [r] }), rules('reassessment_overdue')),
    ).toHaveLength(1);
    expect(
      evaluateAlerts(
        base({ reassessments: [{ ...r, assessed: true }] }),
        rules('reassessment_overdue'),
      ),
    ).toHaveLength(0);
  });

  it('disabled rules do not fire; configuration is validated', () => {
    const cfg = resolveRules([{ key: 'pain', enabled: false }]);
    expect(
      evaluateAlerts(
        base({ pains: [{ date: TODAY, sessionId: null, where: 'x', intensity: 9 }] }),
        cfg,
      ).filter((a) => a.ruleKey === 'pain'),
    ).toHaveLength(0);
    // Out-of-range parameters fall back to the default.
    expect(
      resolveRules([{ key: 'adherence_low', parameters: { yellowBelow: 500 } }])[0]!.parameters
        .yellowBelow,
    ).toBe(80);
    expect(
      validateRuleConfig([
        { key: 'adherence_low', enabled: true, parameters: { yellowBelow: 50, redBelow: 70 } },
      ]),
    ).toHaveProperty('adherence_low.redBelow');
    expect(validateRuleConfig([{ key: 'nope', enabled: true, parameters: {} }])).toHaveProperty(
      'nope',
    );
  });
});
