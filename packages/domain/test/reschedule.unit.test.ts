import { describe, expect, it } from 'vitest';
import {
  changesFor,
  proposeReschedules,
  type PlanSessionSlot,
  type ProgrammingInput,
} from '../src';

// Week 2 of the plan starts on Monday 2026-10-12; today is Thursday 2026-10-08.
const slot = (id: string, date: string, over: Partial<PlanSessionSlot> = {}): PlanSessionSlot => ({
  sessionId: id,
  date,
  weekIndex: date < '2026-10-12' ? 1 : 2,
  weekStart: date < '2026-10-12' ? '2026-10-05' : '2026-10-12',
  name: `Sesión ${id}`,
  recorded: false,
  ...over,
});
const input = (sessions: PlanSessionSlot[], availableWeekdays: number[]): ProgrammingInput => ({
  today: '2026-10-08',
  upcoming: [],
  history: [],
  signals: { srpeHigh: false, wellnessLow: false, adherenceLow: false, partialSessions: false },
  pains: [],
  painThreshold: 4,
  substitutes: {},
  availableWeekdays,
  sessions,
});

describe('availability-based moves (restructure phase 15)', () => {
  it('moves a session on an unavailable day to the nearest free available day of its week', () => {
    // Mon 12, Wed 14, Fri 16 planned; the client can train Mon, Thu and Fri.
    const [c] = proposeReschedules(
      input([slot('a', '2026-10-12'), slot('b', '2026-10-14'), slot('c', '2026-10-16')], [1, 4, 5]),
    );
    expect(c).toMatchObject({
      key: 'schedule:2:145',
      kind: 'reschedule',
      params: { moves: [{ sessionId: 'b', from: '2026-10-14', to: '2026-10-15' }] },
    });
    expect(c!.explanation.data.join(' ')).toContain('miércoles 14/10/2026 → jueves 15/10/2026');
    expect(c!.explanation.rules[0]!.key).toBe('schedule.availability');
    expect(changesFor(c!.kind, c!.params, c!.targets)).toEqual([
      {
        sessionExerciseId: '',
        sessionId: 'b',
        field: 'scheduledDate',
        from: '2026-10-14',
        to: '2026-10-15',
      },
    ]);
  });

  it('on a tie picks the later day; never today, a past day or a taken day', () => {
    // Wed 14 → Tue 13 and Thu 15 are both 1 day away: Thursday.
    const [c] = proposeReschedules(input([slot('b', '2026-10-14')], [2, 4]));
    expect(c!.params.moves).toEqual([{ sessionId: 'b', from: '2026-10-14', to: '2026-10-15' }]);
    // This week: Fri 9 is unavailable; Thu 8 is today and Wed 7 is past → no free day.
    expect(proposeReschedules(input([slot('x', '2026-10-09')], [3, 4]))).toEqual([]);
    // Thursday is taken by another session (recorded or not) → Tuesday.
    const [d] = proposeReschedules(
      input([slot('b', '2026-10-14'), slot('t', '2026-10-15', { recorded: true })], [2, 4]),
    );
    expect(d!.params.moves![0]!.to).toBe('2026-10-13');
  });

  it('more sessions than free days: moves what fits and lists the rest for the trainer', () => {
    const [c] = proposeReschedules(
      input([slot('a', '2026-10-13'), slot('b', '2026-10-14'), slot('c', '2026-10-15')], [1]),
    );
    expect(c!.params.moves).toEqual([{ sessionId: 'a', from: '2026-10-13', to: '2026-10-12' }]);
    expect(c!.explanation.data.join(' ')).toMatch(/no cabe en ningún día libre/);
    expect(c!.explanation.interpretation.join(' ')).toMatch(/nunca borra sesiones/);
  });

  it('nothing to do without stated availability, when sessions already fit, or beyond 14 days', () => {
    expect(proposeReschedules(input([slot('b', '2026-10-14')], []))).toEqual([]);
    expect(proposeReschedules(input([slot('b', '2026-10-14')], [3]))).toEqual([]);
    expect(
      proposeReschedules(
        input([slot('z', '2026-10-28', { weekIndex: 4, weekStart: '2026-10-26' })], [1]),
      ),
    ).toEqual([]);
    // A recorded session on an unavailable day is history, not moved.
    expect(proposeReschedules(input([slot('b', '2026-10-14', { recorded: true })], [1]))).toEqual(
      [],
    );
  });
});
