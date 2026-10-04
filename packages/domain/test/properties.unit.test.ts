/**
 * Property-based tests (fast-check) for the calculation engines (MASTER_SPECIFICATION §15.1:
 * monotonicity, bounds, idempotence). Each property states an invariant that must hold for any
 * input, not just the hand-picked examples of the other test files.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  adherence,
  aggregateAttempts,
  asymmetryPercent,
  combineErrors,
  doubleProgression,
  interpretChange,
  isoWeekday,
  mdc95FromSem,
  parseCsv,
  privacyDueOn,
  retentionExpired,
  rirAdjustment,
  safeText,
  sd,
  semFromIcc,
  sessionCompletion,
  sessionLoad,
  toCsv,
  trend,
  weeklyLoad,
  wellnessScore,
  type MeasurementError,
} from '../src';

const close = (a: number, b: number, eps = 1e-6) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const value = fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true });
const positive = fc.double({ min: 0.01, max: 1e4, noNaN: true, noDefaultInfinity: true });
const isoDate = fc
  .date({
    min: new Date('2000-01-01T00:00:00Z'),
    max: new Date('2099-12-31T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));
const direction = fc.constantFrom('higher' as const, 'lower' as const);

describe('assessment: aggregation of attempts', () => {
  it('best is the extreme in the better direction; every aggregate lies within [min, max]', () => {
    fc.assert(
      fc.property(
        fc.array(value, { minLength: 1, maxLength: 8 }),
        fc.constantFrom('best', 'mean', 'mean_of_best_n', 'last') as fc.Arbitrary<
          'best' | 'mean' | 'mean_of_best_n' | 'last'
        >,
        direction,
        fc.integer({ min: 1, max: 5 }),
        (xs, aggregation, betterDirection, n) => {
          const a = aggregateAttempts(xs, { aggregation, n, betterDirection });
          const lo = Math.min(...xs);
          const hi = Math.max(...xs);
          expect(a.best).toBeCloseTo(betterDirection === 'higher' ? hi : lo, 3);
          expect(a.value).toBeGreaterThanOrEqual(lo - 1e-3);
          expect(a.value).toBeLessThanOrEqual(hi + 1e-3);
          if (a.cvIntraPercent != null) expect(a.cvIntraPercent).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it('order of the attempts does not matter (except for "last")', () => {
    fc.assert(
      fc.property(
        fc.array(value, { minLength: 1, maxLength: 8 }),
        fc.constantFrom('best', 'mean', 'mean_of_best_n') as fc.Arbitrary<
          'best' | 'mean' | 'mean_of_best_n'
        >,
        direction,
        (xs, aggregation, betterDirection) => {
          const rule = { aggregation, n: 2, betterDirection };
          expect(aggregateAttempts([...xs].reverse(), rule).value).toBeCloseTo(
            aggregateAttempts(xs, rule).value,
            3,
          );
        },
      ),
    );
  });

  it('sample SD is non-negative, zero for constants and invariant to a shift', () => {
    fc.assert(
      fc.property(fc.array(value, { minLength: 2, maxLength: 10 }), value, (xs, c) => {
        expect(sd(xs)).toBeGreaterThanOrEqual(0);
        expect(sd(xs.map(() => c))).toBeCloseTo(0, 9);
        expect(close(sd(xs.map((x) => x + c)), sd(xs), 1e-6)).toBe(true);
      }),
    );
  });
});

describe('assessment: change against measurement error', () => {
  const error = (te: number, k = 2): MeasurementError => ({
    te,
    mdc95: te * k,
    swc: null,
    origin: 'local',
    basis: 'test',
    label: 'test',
  });

  it('SEM falls as ICC rises; MDC95 = 1.96·√2·SEM is always larger than the SEM', () => {
    fc.assert(
      fc.property(
        positive,
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        (sdb, i1, i2) => {
          const [lo, hi] = i1 <= i2 ? [i1, i2] : [i2, i1];
          expect(semFromIcc(sdb, hi)).toBeLessThanOrEqual(semFromIcc(sdb, lo));
          const sem = semFromIcc(sdb, lo);
          if (sem > 0) expect(mdc95FromSem(sem)).toBeGreaterThan(sem);
        },
      ),
    );
  });

  it('a change smaller than the typical error is never an improvement or a decline', () => {
    fc.assert(
      fc.property(
        value,
        positive,
        direction,
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        (pre, te, better, f) => {
          const post = pre + te * f;
          expect(interpretChange(pre, post, better, error(te)).verdict).toBe('within_error');
        },
      ),
    );
  });

  it('flipping the better direction swaps improvement and decline', () => {
    fc.assert(
      fc.property(value, value, positive, (pre, post, te) => {
        const up = interpretChange(pre, post, 'higher', error(te)).verdict;
        const down = interpretChange(pre, post, 'lower', error(te)).verdict;
        const swap: Record<string, string> = {
          probable_improvement: 'probable_decline',
          probable_decline: 'probable_improvement',
        };
        expect(down).toBe(swap[up] ?? up);
      }),
    );
  });

  it('the verdict never weakens as the change grows (within → possible → probable)', () => {
    const rank = {
      within_error: 0,
      possible_change: 1,
      probable_improvement: 2,
      probable_decline: 2,
    };
    fc.assert(
      fc.property(value, positive, positive, positive, direction, (pre, te, d1, d2, better) => {
        const [small, big] = d1 <= d2 ? [d1, d2] : [d2, d1];
        const a = interpretChange(pre, pre + small, better, error(te)).verdict as keyof typeof rank;
        const b = interpretChange(pre, pre + big, better, error(te)).verdict as keyof typeof rank;
        expect(rank[b]).toBeGreaterThanOrEqual(rank[a]);
      }),
    );
  });

  it('without a known error the verdict is always "unknown"', () => {
    fc.assert(
      fc.property(value, value, direction, (pre, post, better) => {
        expect(interpretChange(pre, post, better, null).verdict).toBe('unknown_error');
      }),
    );
  });

  it('combined error (√(a²+b²)) is commutative and at least the larger of the two', () => {
    fc.assert(
      fc.property(positive, positive, (a, b) => {
        const ab = combineErrors(error(a), error(b), 'x')!;
        expect(close(ab.te, combineErrors(error(b), error(a), 'x')!.te)).toBe(true);
        expect(ab.te).toBeGreaterThanOrEqual(Math.max(a, b) - 1e-9);
        expect(ab.te).toBeLessThanOrEqual(a + b + 1e-9);
      }),
    );
  });

  it('trend: unchanged by a constant offset, flipped by negating the values', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), { minLength: 3, maxLength: 8 }),
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 8, maxLength: 8 }),
        fc.integer({ min: -1000, max: 1000 }),
        (ts, vs, c) => {
          const pts = [...ts].sort((a, b) => a - b).map((t, i) => ({ t, value: vs[i]! }));
          const base = trend(pts);
          expect(trend(pts.map((p) => ({ ...p, value: p.value + c })))).toBe(base);
          const flip = { up: 'down', down: 'up', flat: 'flat', insufficient: 'insufficient' };
          expect(trend(pts.map((p) => ({ ...p, value: -p.value })))).toBe(flip[base]);
        },
      ),
    );
  });

  it('asymmetry is non-negative (below 100 % when higher is better); swapping sides swaps the weaker side', () => {
    fc.assert(
      fc.property(positive, positive, direction, (l, r, better) => {
        const a = asymmetryPercent(l, r, better)!;
        const b = asymmetryPercent(r, l, better)!;
        expect(a.value).toBeGreaterThanOrEqual(0);
        // Relative to the better side: with times (lower is better) 1 s vs 2.5 s is 150 %.
        if (better === 'higher') expect(a.value).toBeLessThanOrEqual(100);
        expect(b.value).toBe(a.value);
        const opposite = { left: 'right', right: 'left', none: 'none' };
        expect(b.weaker).toBe(opposite[a.weaker]);
      }),
    );
  });
});

describe('monitoring: adherence, load and wellness', () => {
  const status = fc.constantFrom(
    'completed' as const,
    'partial' as const,
    'missed' as const,
    'rescheduled' as const,
    'cancelled_by_trainer' as const,
    null,
  );
  const sessions = fc.array(
    fc.record({
      id: fc.uuid(),
      date: fc.constantFrom('2026-03-02', '2026-03-05', '2026-03-09', '2026-03-20', '2026-04-01'),
      status,
    }),
    { maxLength: 30 },
  );

  it('0 ≤ done ≤ planned, percent in [0, 100], and the order of the sessions is irrelevant', () => {
    fc.assert(
      fc.property(sessions, (ss) => {
        const a = adherence(ss, '2026-03-01', '2026-03-31');
        expect(a.done).toBeLessThanOrEqual(a.planned);
        expect(a.completed + a.partial + a.missed + a.unrecorded).toBe(a.planned);
        if (a.percent != null) {
          expect(a.percent).toBeGreaterThanOrEqual(0);
          expect(a.percent).toBeLessThanOrEqual(100);
        } else expect(a.planned).toBe(0);
        expect(adherence([...ss].reverse(), '2026-03-01', '2026-03-31')).toEqual(a);
      }),
    );
  });

  it('rescheduled or trainer-cancelled sessions never change adherence', () => {
    fc.assert(
      fc.property(
        sessions,
        fc.constantFrom('rescheduled' as const, 'cancelled_by_trainer' as const),
        (ss, st) => {
          const extra = [...ss, { id: 'x', date: '2026-03-10', status: st }];
          expect(adherence(extra, '2026-03-01', '2026-03-31')).toEqual(
            adherence(ss, '2026-03-01', '2026-03-31'),
          );
        },
      ),
    );
  });

  it('weekly loads add up to the sum of session loads; monotony is positive or absent', () => {
    const loaded = fc.array(
      fc.record({
        date: fc.integer({ min: 0, max: 27 }).map((d) => addDays('2026-03-02', d)),
        sessionRpe: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        durationMin: fc.option(fc.integer({ min: 0, max: 180 }), { nil: null }),
      }),
      { maxLength: 25 },
    );
    fc.assert(
      fc.property(loaded, (ss) => {
        const weeks = weeklyLoad(ss, '2026-03-02', '2026-03-29');
        expect(weeks).toHaveLength(4);
        const total = ss.reduce((a, s) => a + (sessionLoad(s.sessionRpe, s.durationMin) ?? 0), 0);
        expect(weeks.reduce((a, w) => a + w.load, 0)).toBe(total);
        for (const w of weeks) {
          if (w.monotony != null) {
            expect(w.monotony).toBeGreaterThan(0);
            expect(w.strain).toBe(Math.round(w.load * w.monotony));
          } else expect(w.strain).toBeNull();
        }
      }),
    );
  });

  it('wellness stays on 0–10 (or null when nothing was answered)', () => {
    const item = fc.option(fc.integer({ min: 0, max: 10 }), { nil: null });
    fc.assert(
      fc.property(
        fc.record({
          energy: item,
          sleepQuality: item,
          motivation: item,
          fatigue: item,
          stress: item,
          soreness: item,
        }),
        (r) => {
          const w = wellnessScore({ date: '2026-03-02', ...r });
          if (Object.values(r).every((v) => v == null)) expect(w).toBeNull();
          else {
            expect(w).toBeGreaterThanOrEqual(0);
            expect(w).toBeLessThanOrEqual(10);
          }
        },
      ),
    );
  });
});

describe('programming: load progression', () => {
  const set = fc.record({
    reps: fc.integer({ min: 0, max: 20 }),
    loadKg: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
    rir: fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }),
  });
  const inc = fc.constantFrom(1, 2, 2.5);

  it('double progression never lowers the load and only adds one increment when every set hit the top', () => {
    fc.assert(
      fc.property(
        fc.array(set, { maxLength: 6 }),
        fc.integer({ min: 3, max: 15 }),
        fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
        fc.integer({ min: 0, max: 300 }),
        inc,
        (sets, repsMax, rirMin, loadKg, increment) => {
          const p = doubleProgression({ repsMax, rirMin, loadKg }, sets, increment);
          const allTop =
            sets.length > 0 &&
            sets.every(
              (s) => s.reps >= repsMax && (rirMin == null || s.rir == null || s.rir >= rirMin),
            );
          expect(p.toKg).toBe(allTop ? loadKg + increment : loadKg);
        },
      ),
    );
  });

  it('RIR adjustment moves at most one increment, never below 0 kg, and needs two sessions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 8, noNaN: true }), { maxLength: 5 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 300 }),
        inc,
        (rirs, a, b, loadKg, increment) => {
          const [rirMin, rirMax] = a <= b ? [a, b] : [b, a];
          const p = rirAdjustment({ rirMin, rirMax, loadKg }, rirs, increment);
          expect(p.toKg).toBeGreaterThanOrEqual(0);
          expect(Math.abs(p.toKg! - loadKg)).toBeLessThanOrEqual(increment);
          if (rirs.length < 2) expect(p.action).toBe('hold');
        },
      ),
    );
  });

  it('session completion is in [0, 100] and "completed" exactly when every prescribed set was done', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 0, max: 60 }), (p, c) => {
        const r = sessionCompletion(p, c);
        expect(r.percent).toBeGreaterThanOrEqual(0);
        expect(r.percent).toBeLessThanOrEqual(100);
        expect(r.status === 'completed').toBe(c >= p);
      }),
    );
  });
});

describe('dates, retention and rights', () => {
  it('addDays is invertible and a 7-day jump keeps the weekday', () => {
    fc.assert(
      fc.property(isoDate, fc.integer({ min: -2000, max: 2000 }), (d, n) => {
        expect(addDays(addDays(d, n), -n)).toBe(d);
        expect(isoWeekday(addDays(d, 7 * Math.trunc(n / 7)))).toBe(isoWeekday(d));
      }),
    );
  });

  it('the answer to a rights request is due 28–31 days later, on the same day or the month end', () => {
    fc.assert(
      fc.property(isoDate, (d) => {
        const due = privacyDueOn(d);
        const days = (Date.parse(due) - Date.parse(d)) / 86_400_000;
        expect(days).toBeGreaterThanOrEqual(28);
        expect(days).toBeLessThanOrEqual(31);
        const sameDay = due.slice(8) === d.slice(8);
        const monthEnd = addDays(due, 1).slice(8) === '01';
        expect(sameDay || monthEnd).toBe(true);
      }),
    );
  });

  it('retention never expires without a period, and once expired stays expired', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true }),
        fc.option(fc.integer({ min: 1, max: 240 }), { nil: null }),
        fc.integer({ min: 0, max: 4000 }),
        fc.integer({ min: 0, max: 4000 }),
        (archived, months, d1, d2) => {
          const at = (d: number) => new Date(archived.getTime() + d * 86_400_000);
          if (months == null) expect(retentionExpired(archived, null, at(d1))).toBe(false);
          const [early, late] = d1 <= d2 ? [d1, d2] : [d2, d1];
          if (retentionExpired(archived, months, at(early)))
            expect(retentionExpired(archived, months, at(late))).toBe(true);
          expect(retentionExpired(null, months, at(d1))).toBe(false);
        },
      ),
    );
  });
});

describe('CSV (export/import)', () => {
  it('no exported text cell can start a spreadsheet formula', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(safeText(s)).not.toMatch(/^[=+\-@\t\r]/);
      }),
    );
  });

  it('round trip: what is exported is read back identically (any separator, quotes, newlines)', () => {
    const cell = fc
      .string({ maxLength: 12 })
      .filter((s) => s.trim() !== '' && !/^[=+\-@\t\r]/.test(s));
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }).chain((cols) =>
          fc.array(fc.array(cell, { minLength: cols, maxLength: cols }), {
            minLength: 1,
            maxLength: 5,
          }),
        ),
        fc.constantFrom(';' as const, ',' as const),
        (rows, separator) => {
          expect(parseCsv(toCsv(rows, { separator }))).toEqual(rows);
        },
      ),
    );
  });
});

describe('CSV regression found by the properties', () => {
  it('a quoted separator in the header does not fool the separator detection', () => {
    expect(parseCsv('.,";"\r\n.,!\r\n')).toEqual([
      ['.', ';'],
      ['.', '!'],
    ]);
  });
});
