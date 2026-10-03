import { describe, expect, it } from 'vitest';
import { milestones, monthGrid, planSpans, sessionStreak, shiftMonth } from '../src';

describe('session streak', () => {
  it('counts back from the latest recorded session and stops at a missed one', () => {
    const s = [
      { date: '2026-10-01', status: 'completed' as const },
      { date: '2026-09-29', status: 'partial' as const },
      { date: '2026-09-26', status: null },
      { date: '2026-09-24', status: 'completed' as const },
      // Today, not yet done: does not break the streak.
      { date: '2026-10-03', status: null },
      { date: '2026-09-30', status: 'rescheduled' as const },
    ];
    expect(sessionStreak(s, '2026-10-03')).toBe(2);
    expect(sessionStreak([], '2026-10-03')).toBe(0);
  });
});

describe('milestones', () => {
  it('positive messages: sessions done, streak and confirmed improvements only', () => {
    const doneDates = Array.from(
      { length: 11 },
      (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`,
    );
    const m = milestones({
      doneDates,
      streak: 6,
      improvements: [{ testName: 'CMJ', date: '2026-09-20' }],
    });
    expect(m.map((x) => x.text)).toEqual([
      'Mejora confirmada en CMJ',
      '10 sesiones completadas',
      '5 sesiones completadas',
      '¡Primera sesión completada!',
      'Racha de 5 sesiones seguidas',
    ]);
    expect(m.find((x) => x.key === 'sessions:10')!.date).toBe('2026-09-10');
    expect(milestones({ doneDates: [], streak: 0, improvements: [] })).toEqual([]);
  });
});

describe('calendar layout', () => {
  it('month grid starts on Monday and covers the whole month', () => {
    const g = monthGrid('2026-10');
    expect(g[0]![0]).toBe('2026-09-28');
    expect(g.at(-1)!.at(-1)).toBe('2026-11-01');
    expect(g.flat()).toContain('2026-10-31');
    expect(() => monthGrid('2026-13')).toThrow();
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('merges consecutive weeks of a phase and marks rest weeks', () => {
    const spans = planSpans([
      { start: '2026-09-28', weekType: 'introduction', phaseName: 'Base' },
      { start: '2026-10-05', weekType: 'progression', phaseName: 'Base' },
      { start: '2026-10-12', weekType: 'deload', phaseName: 'Base' },
      { start: '2026-10-19', weekType: 'progression', phaseName: 'Desarrollo' },
    ]);
    expect(spans).toEqual([
      { kind: 'phase', label: 'Base', from: '2026-09-28', to: '2026-10-18' },
      { kind: 'rest', label: 'Descarga', from: '2026-10-12', to: '2026-10-18' },
      { kind: 'phase', label: 'Desarrollo', from: '2026-10-19', to: '2026-10-25' },
    ]);
  });
});
