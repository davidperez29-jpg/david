import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_DIMENSIONS,
  clipScore,
  dimensionScore,
  DIMENSION_SETS,
  radius,
  scoreOf,
  type Basis,
  type Scale,
} from '../src';

const group = [30, 34, 28, 40, 33, 31];
const bases: Basis[] = [
  { scale: 'z_reference', mean: 33, sd: 4 },
  { scale: 'z_group', values: group },
  { scale: 'percentile', values: group },
  { scale: 'percent_reference', reference: 33 },
];
const value = fc.double({ min: 1, max: 100, noNaN: true });

describe('normalization: from a result to a comparable score', () => {
  it('the four scales, oriented so that higher is better', () => {
    expect(scoreOf(37, 'higher', bases[0]!)).toBe(1);
    expect(scoreOf(37, 'lower', bases[0]!)).toBe(-1);
    expect(scoreOf(40, 'higher', bases[2]!)).toBeCloseTo(((5 + 0.5) / 6) * 100, 10);
    expect(scoreOf(28, 'lower', bases[2]!)).toBeCloseTo(((5 + 0.5) / 6) * 100, 10);
    expect(scoreOf(30, 'lower', bases[3]!)).toBeCloseTo(110, 10); // 33 / 30
    expect(scoreOf(36.3, 'higher', bases[3]!)).toBeCloseTo(110, 10);
  });

  it('no data, no direction or no usable basis is a gap (null), never a zero', () => {
    for (const b of bases) {
      expect(scoreOf(null, 'higher', b)).toBeNull();
      expect(scoreOf(Number.NaN, 'higher', b)).toBeNull();
      expect(scoreOf(30, 'target_range', b)).toBeNull();
    }
    expect(scoreOf(30, 'higher', { scale: 'z_reference', mean: 30, sd: 0 })).toBeNull();
    expect(scoreOf(30, 'higher', { scale: 'z_group', values: [30] })).toBeNull();
    expect(scoreOf(30, 'higher', { scale: 'percent_reference', reference: 0 })).toBeNull();
  });

  it('property: a better result never scores lower (monotonic), on every scale', () => {
    fc.assert(
      fc.property(value, value, fc.constantFrom(...bases), (a, b, basis) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(scoreOf(hi, 'higher', basis)!).toBeGreaterThanOrEqual(scoreOf(lo, 'higher', basis)!);
        expect(scoreOf(lo, 'lower', basis)!).toBeGreaterThanOrEqual(scoreOf(hi, 'lower', basis)!);
      }),
    );
  });

  it('property: reversing the direction reverses the axis', () => {
    fc.assert(
      fc.property(value, (v) => {
        for (const b of bases.slice(0, 2))
          expect(scoreOf(v, 'lower', b)!).toBeCloseTo(-scoreOf(v, 'higher', b)!, 9);
        // Percentile: what is better for one direction is worse for the other.
        expect(scoreOf(v, 'lower', bases[2]!)!).toBeCloseTo(
          100 - scoreOf(v, 'higher', bases[2]!)!,
          9,
        );
        // % of reference: reciprocal around 100 %.
        const up = scoreOf(v, 'higher', bases[3]!)! / 100;
        expect(scoreOf(v, 'lower', bases[3]!)! / 100).toBeCloseTo(1 / up, 9);
      }),
    );
  });

  it('property: every score lands inside the radar (radius 0…1); real values stay unclipped', () => {
    const scales: Scale[] = ['z_reference', 'z_group', 'percentile', 'percent_reference'];
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.constantFrom(...scales),
        (s, sc) => {
          const r = radius(s, sc);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(1);
        },
      ),
    );
    expect(clipScore(5.2, 'z_group')).toBe(3);
    expect(scoreOf(60, 'higher', bases[0]!)).toBeCloseTo(6.75, 10);
  });
});

describe('radar dimensions', () => {
  it('weighted mean of the items with a score; missing items are reported, not zeroed', () => {
    const d = dimensionScore([
      { slug: 'a', weight: 2, score: 1 },
      { slug: 'b', weight: 1, score: -2 },
      { slug: 'c', weight: 3, score: null },
    ]);
    expect(d.score).toBeCloseTo(0, 10);
    expect(d.used).toEqual(['a', 'b']);
    expect(d.missing).toEqual(['c']);
    expect(dimensionScore([{ slug: 'a', weight: 1, score: null }]).score).toBeNull();
  });

  it('property: a dimension score lies between its lowest and highest item', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: fc.string(),
            weight: fc.integer({ min: 1, max: 5 }),
            score: fc.option(fc.double({ min: -3, max: 3, noNaN: true }), { nil: null }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (items) => {
          const d = dimensionScore(items);
          const xs = items.map((i) => i.score).filter((x): x is number => x != null);
          if (!xs.length) {
            expect(d.score).toBeNull();
            return;
          }
          expect(d.score!).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
          expect(d.score!).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        },
      ),
    );
  });

  it('dimension sets: unique keys, no item twice in a dimension, positive weights', () => {
    expect(new Set(ALL_DIMENSIONS.map((d) => d.key)).size).toBe(ALL_DIMENSIONS.length);
    for (const set of Object.values(DIMENSION_SETS))
      for (const d of set) {
        expect(new Set(d.items.map((i) => i.slug)).size, d.key).toBe(d.items.length);
        for (const i of d.items) expect(i.weight).toBeGreaterThan(0);
      }
  });
});
