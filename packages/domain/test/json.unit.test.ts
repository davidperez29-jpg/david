import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson, sameJson } from '../src';

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
    expect(sameJson([1, 2], [2, 1])).toBe(false);
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJson('x', 'x')).toBe(true);
  });

  it('equal content compares equal whatever the key order (property)', () => {
    const shuffleKeys = (v: unknown): unknown =>
      v && typeof v === 'object'
        ? Array.isArray(v)
          ? v.map(shuffleKeys)
          : Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, shuffleKeys(x)]),
            )
        : v;
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(sameJson(v, shuffleKeys(v))).toBe(true);
        expect(JSON.parse(canonicalJson(v))).toEqual(JSON.parse(JSON.stringify(v)));
      }),
    );
  });
});
