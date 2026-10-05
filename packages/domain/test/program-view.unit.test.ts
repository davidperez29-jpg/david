import { describe, expect, it } from 'vitest';
import { currentWeekId, monthsOf, weekMonth } from '../src';

const weeks = [
  { id: 'w1', start: '2026-09-28' },
  { id: 'w2', start: '2026-10-05' },
  { id: 'w3', start: '2026-10-12' },
  { id: 'w4', start: '2026-10-26' },
  { id: 'w5', start: '2026-11-02' },
];

describe('Programa: months and weeks', () => {
  it('a week belongs to the month of its Thursday', () => {
    expect(weekMonth('2026-09-28')).toBe('2026-10'); // Thu 1 Oct
    expect(weekMonth('2026-08-31')).toBe('2026-09'); // Thu 3 Sep
    expect(weekMonth('2026-10-26')).toBe('2026-10'); // Thu 29 Oct
  });

  it('groups weeks by month in order; undated weeks together', () => {
    expect(monthsOf(weeks).map((m) => [m.key, m.weeks.map((w) => w.id)])).toEqual([
      ['2026-10', ['w1', 'w2', 'w3', 'w4']],
      ['2026-11', ['w5']],
    ]);
    expect(
      monthsOf([
        { id: 'a', start: null },
        { id: 'b', start: null },
      ]),
    ).toEqual([
      {
        key: '',
        weeks: [
          { id: 'a', start: null },
          { id: 'b', start: null },
        ],
      },
    ]);
  });

  it('opens the week of today, else the next one, else the last one', () => {
    expect(currentWeekId(weeks, '2026-10-07')).toBe('w2');
    expect(currentWeekId(weeks, '2026-10-11')).toBe('w2'); // Sunday still in w2
    expect(currentWeekId(weeks, '2026-10-20')).toBe('w4'); // gap: next week to come
    expect(currentWeekId(weeks, '2026-09-01')).toBe('w1');
    expect(currentWeekId(weeks, '2027-01-01')).toBe('w5');
    expect(currentWeekId([{ id: 'u', start: null }], '2026-10-07')).toBe('u');
    expect(currentWeekId([], '2026-10-07')).toBeNull();
  });
});
