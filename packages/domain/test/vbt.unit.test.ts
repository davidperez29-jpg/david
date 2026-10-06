import { describe, expect, it } from 'vitest';
import {
  E1RM_MAX_REPS,
  estimateOneRm,
  proposeAdjustments,
  proposeLoadChange,
  velocityAdjustment,
  type ExerciseHistory,
} from '../src';

describe('velocity-based load adjustment (phase 14)', () => {
  const t = { velocityTargetMps: 0.5, loadKg: 80 };
  it('needs 2 sessions with measured velocity', () => {
    expect(velocityAdjustment(t, [0.7], 2.5)).toMatchObject({ action: 'hold' });
  });
  it('faster than target + margin in the last 2 sessions → +load', () => {
    expect(velocityAdjustment(t, [0.4, 0.57, 0.58], 2.5)).toMatchObject({
      action: 'increase_load',
      fromKg: 80,
      toKg: 82.5,
    });
  });
  it('slower than target − margin → −load', () => {
    expect(velocityAdjustment(t, [0.43, 0.42], 2.5)).toMatchObject({
      action: 'decrease_load',
      toKg: 77.5,
    });
  });
  it('within the margin, or only one session off → hold', () => {
    expect(velocityAdjustment(t, [0.53, 0.47], 2.5).action).toBe('hold');
    expect(velocityAdjustment(t, [0.5, 0.6], 2.5).action).toBe('hold');
  });
  it('reason speaks in m/s', () => {
    expect(velocityAdjustment(t, [0.6, 0.6], 2.5).reason).toContain('m/s');
  });
});

describe('estimated 1RM (phase 14, informative)', () => {
  it('practical equation on the best set, rounded to 0.5 kg', () => {
    // 100 × (1 + 8/30) = 126.67 → 126.5
    expect(estimateOneRm([{ loadKg: 100, reps: 6, rir: 2 }])).toEqual({
      kg: 126.5,
      loadKg: 100,
      repsToFailure: 8,
    });
    expect(
      estimateOneRm([
        { loadKg: 100, reps: 6, rir: 2 },
        { loadKg: 110, reps: 5, rir: 1 },
      ])?.loadKg,
    ).toBe(110);
  });
  it('a single repetition to failure is the load itself', () => {
    expect(estimateOneRm([{ loadKg: 140, reps: 1, rir: 0 }])?.kg).toBe(140);
  });
  it(`ignores sets beyond ${E1RM_MAX_REPS} reps to failure, without RIR or without load`, () => {
    expect(
      estimateOneRm([
        { loadKg: 60, reps: 9, rir: 2 },
        { loadKg: 80, reps: 6, rir: null },
        { loadKg: null, reps: 5, rir: 1 },
        { loadKg: 0, reps: 5, rir: 1 },
      ]),
    ).toBeNull();
  });
});

const benchHistory = (velocities: number[]): ExerciseHistory => ({
  exerciseId: 'bench',
  exerciseName: 'Press de banca',
  equipment: ['barbell'],
  sessions: velocities.map((v, i) => ({
    date: `2026-09-${String(28 + i).padStart(2, '0')}`,
    target: { repsMin: 4, repsMax: 4, rirMin: 2, rirMax: 3, loadKg: 70, velocityTargetMps: 0.6 },
    sets: [
      { reps: 4, rir: 2, loadKg: 70, meanVelocityMps: v },
      { reps: 4, rir: 2, loadKg: 70, meanVelocityMps: v },
    ],
  })),
});

describe('load proposal with a velocity target (phase 14)', () => {
  it('velocity takes priority over RIR', () => {
    // RIR 2 is inside the target (no RIR change), but the bar moved 0.1 m/s too fast twice.
    expect(proposeLoadChange(benchHistory([0.7, 0.7]))).toMatchObject({
      action: 'increase_load',
      rule: 'velocity_target',
      toKg: 72.5,
    });
  });
  it('without 2 measured sessions it falls back to the RIR rules', () => {
    expect(proposeLoadChange(benchHistory([0.7]))).toBeNull();
  });
  it('explanation shows velocities, the estimated 1RM and their limitations', () => {
    const [c] = proposeAdjustments({
      today: '2026-10-01',
      upcoming: [
        {
          sessionExerciseId: 'se1',
          sessionId: 's1',
          date: '2026-10-02',
          weekIndex: 2,
          exerciseId: 'bench',
          exerciseName: 'Press de banca',
          sets: 3,
          repsMin: 4,
          repsMax: 4,
          rirMin: 2,
          rirMax: 3,
          loadKg: 70,
        },
      ],
      history: [benchHistory([0.7, 0.7])],
      signals: { srpeHigh: false, wellnessLow: false, adherenceLow: false, partialSessions: false },
      pains: [],
      painThreshold: 4,
      substitutes: {},
    });
    const text = JSON.stringify(c!.explanation);
    expect(text).toContain('0,70 m/s');
    expect(text).toContain('1RM estimado (orientativo)');
    expect(text).toContain('progression.velocity_target');
    expect(text).toContain('no sustituye a un 1RM medido');
  });
});
