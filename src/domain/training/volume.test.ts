import { describe, expect, it } from 'vitest';
import { findFormula } from '../formulas';
import { summarizeVolume, VOLUME_FORMULAS, weeklyVolume } from './volume';

describe('volumen de entrenamiento (definiciones v1.0.0)', () => {
  it('cuenta solo las series completadas', () => {
    const summary = summarizeVolume([
      { reps: 8, loadKg: 60, completed: true },
      { reps: 8, loadKg: 60, completed: true },
      { reps: 8, loadKg: 60, completed: false },
    ]);
    expect(summary).toEqual({
      completedSets: 2,
      totalReps: 16,
      volumeLoadKg: 960,
      setsWithoutExternalLoad: 0,
    });
  });

  it('excluye del tonelaje las series sin carga externa y las cuenta aparte', () => {
    const summary = summarizeVolume([
      { reps: 10, loadKg: null, completed: true },
      { reps: 12, loadKg: 0, completed: true },
      { reps: 5, loadKg: 22.5, completed: true },
    ]);
    expect(summary.volumeLoadKg).toBe(112.5);
    expect(summary.totalReps).toBe(27);
    expect(summary.setsWithoutExternalLoad).toBe(2);
  });

  it('evita errores de coma flotante en cargas decimales', () => {
    const summary = summarizeVolume([
      { reps: 1, loadKg: 0.1, completed: true },
      { reps: 1, loadKg: 0.2, completed: true },
    ]);
    expect(summary.volumeLoadKg).toBe(0.3);
  });

  it('rechaza repeticiones o cargas imposibles en lugar de sumarlas', () => {
    expect(() => summarizeVolume([{ reps: -1, loadKg: 20, completed: true }])).toThrow(RangeError);
    expect(() => summarizeVolume([{ reps: 2.5, loadKg: 20, completed: true }])).toThrow(RangeError);
    expect(() => summarizeVolume([{ reps: 5, loadKg: Number.NaN, completed: true }])).toThrow(
      RangeError,
    );
  });

  it('agrega por semana ISO e incluye las semanas sin registros', () => {
    const weeks = weeklyVolume(
      [
        { date: '2026-10-19', sets: [{ reps: 10, loadKg: 50, completed: true }] },
        { date: '2026-10-22', sets: [{ reps: 5, loadKg: 100, completed: true }] },
        { date: '2026-11-03', sets: [{ reps: 8, loadKg: null, completed: true }] },
        { date: '2026-11-04', sets: [{ reps: 8, loadKg: 40, completed: false }] },
      ],
      { from: '2026-10-19', to: '2026-11-08' },
    );
    expect(weeks.map((w) => [w.week, w.sessions, w.volumeLoadKg])).toEqual([
      ['2026-W43', 2, 1000],
      ['2026-W44', 0, 0],
      ['2026-W45', 1, 0],
    ]);
  });

  it('declara fórmulas que existen en el registro', () => {
    for (const ref of Object.values(VOLUME_FORMULAS)) expect(findFormula(ref)).toBeDefined();
  });
});
