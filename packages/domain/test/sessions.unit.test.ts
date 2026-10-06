import { describe, expect, it } from 'vitest';
import {
  adherence,
  autoAttendance,
  PAIN_MESSAGE,
  SESSION_TRACKING_LABELS,
  trackingState,
  pickToday,
  preloadSet,
  resolveSubstitution,
  sessionCompletion,
  syncConflict,
  validateSetLog,
} from '../src';

describe('session execution rules', () => {
  it('picks today’s session, else the next pending one, never a past one', () => {
    const s = [
      { id: 'a', date: '2026-10-05', attended: true },
      { id: 'b', date: '2026-10-07', attended: false },
      { id: 'c', date: '2026-10-09', attended: false },
    ];
    expect(pickToday(s, '2026-10-07')).toEqual({ session: s[1], isToday: true });
    expect(pickToday(s, '2026-10-08')).toEqual({ session: s[2], isToday: false });
    expect(pickToday(s, '2026-10-10').session).toBeNull();
    // Today's session already done: the next pending one, not the finished one.
    expect(pickToday(s, '2026-10-05')).toEqual({ session: s[1], isToday: false });
  });
  it('preloads the prescribed load, else the last one used', () => {
    const p = {
      sets: 3,
      repsMin: 8,
      repsMax: 10,
      loadKg: null,
      rirMin: 2,
      durationS: null,
      distanceM: null,
    };
    expect(preloadSet(p, { loadKg: 20, reps: 10 })).toMatchObject({ loadKg: 20, reps: 10, rir: 2 });
    expect(preloadSet({ ...p, loadKg: 22.5 }, { loadKg: 20, reps: 10 }).loadKg).toBe(22.5);
    expect(preloadSet(p, null).loadKg).toBeNull();
  });
  it('validates set logs', () => {
    expect(validateSetLog({ setIndex: 1, loadKg: 20, reps: 10, rir: 2 })).toEqual({});
    expect(
      Object.keys(validateSetLog({ setIndex: 0, rir: 11, rpe: 7.3, reps: -1 })).sort(),
    ).toEqual(['reps', 'rir', 'rpe', 'setIndex']);
    expect(validateSetLog({ setIndex: 1, rir: 2, rpe: 8 }).rpe).toBeTruthy();
  });
  it('applies pre-approved alternatives; otherwise waits for the trainer; pain always alerts', () => {
    expect(resolveSubstitution('missing_equipment', 'x', ['x'])).toEqual({
      status: 'approved',
      notifyTrainer: false,
      message: null,
    });
    expect(resolveSubstitution('preference', 'y', ['x'])).toMatchObject({
      status: 'pending',
      notifyTrainer: true,
    });
    expect(resolveSubstitution('pain', 'x', ['x'])).toMatchObject({
      status: 'approved',
      notifyTrainer: true,
      message: PAIN_MESSAGE,
    });
  });
  it('keeps conflicting offline logs and explains why they need review', () => {
    const ok = {
      sessionExerciseExists: true,
      sessionPublished: true,
      sessionEditedAfter: false,
      performedMatches: true,
    };
    expect(syncConflict(ok)).toBeNull();
    expect(syncConflict({ ...ok, sessionExerciseExists: false })).toMatch(/ya no está/);
    expect(syncConflict({ ...ok, sessionEditedAfter: true })).toMatch(/editó/);
  });
  it('computes completion', () => {
    expect(sessionCompletion(12, 12)).toEqual({ percent: 100, status: 'completed' });
    expect(sessionCompletion(12, 6)).toEqual({ percent: 50, status: 'partial' });
  });
});

describe('localDate', () => {
  it('uses the Spanish calendar day, not UTC', async () => {
    const { localDate } = await import('../src/sessions');
    // 23:30 UTC on 3 Oct is already 4 Oct in Madrid (CEST, UTC+2).
    expect(localDate(new Date('2026-10-03T23:30:00Z'))).toBe('2026-10-04');
    expect(localDate(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-03');
  });
});

describe('fichaje automático (restructure phase 8)', () => {
  const today = '2026-10-06';
  it('closes past published sessions: started → incompleta, nothing → no realizada', () => {
    expect(autoAttendance({ date: '2026-10-05', published: true, status: 'started', today })).toBe(
      'partial',
    );
    expect(autoAttendance({ date: '2026-10-05', published: true, status: null, today })).toBe(
      'missed',
    );
  });
  it('never touches today, the future, unpublished sessions or closed records', () => {
    expect(autoAttendance({ date: today, published: true, status: null, today })).toBeNull();
    expect(autoAttendance({ date: '2026-10-07', published: true, status: null, today })).toBeNull();
    expect(
      autoAttendance({ date: '2026-10-01', published: false, status: null, today }),
    ).toBeNull();
    expect(autoAttendance({ date: null, published: true, status: null, today })).toBeNull();
    for (const status of ['completed', 'partial', 'missed', 'rescheduled'])
      expect(autoAttendance({ date: '2026-10-01', published: true, status, today })).toBeNull();
  });
  it('maps every record to the five states the client sees', () => {
    expect(
      [null, 'started', 'completed', 'partial', 'missed'].map(
        (s) => SESSION_TRACKING_LABELS[trackingState(s)],
      ),
    ).toEqual(['Planificada', 'Iniciada', 'Completada', 'Incompleta', 'No realizada']);
  });
  it('a started session counts as done for adherence', () => {
    const a = adherence(
      [
        { id: '1', date: '2026-10-01', status: 'started' },
        { id: '2', date: '2026-10-02', status: 'missed' },
      ],
      '2026-10-01',
      '2026-10-05',
    );
    expect(a).toMatchObject({ planned: 2, done: 1, percent: 50 });
  });
});
