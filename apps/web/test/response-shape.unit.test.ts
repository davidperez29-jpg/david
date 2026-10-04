import { describe, expect, it } from 'vitest';
import { breakingDiff, mergeShapes, shapeOf } from './contract/shape';

const diff = (a: unknown, b: unknown) => {
  const out: string[] = [];
  breakingDiff(shapeOf(a), shapeOf(b), 'r', out);
  return out;
};

describe('response contract rules', () => {
  it('records keys and types, not values', () => {
    expect(shapeOf({ b: 1, a: 'x', c: [{ d: true }], e: null })).toEqual({
      a: 'string',
      b: 'number',
      c: [{ d: 'boolean' }],
      e: 'null',
    });
  });

  it('removed field or changed type is breaking; added field, null or empty list is not', () => {
    expect(diff({ a: 1, b: 'x' }, { a: 1 })).toEqual(['r.b: campo eliminado']);
    expect(diff({ a: 1 }, { a: '1' })).toEqual(['r.a: number → string']);
    expect(diff({ a: 1 }, { a: 1, z: 2 })).toEqual([]);
    expect(diff({ a: 1 }, { a: null })).toEqual([]);
    expect(diff({ items: [{ id: 'x' }] }, { items: [] })).toEqual([]);
    expect(diff({ items: [{ id: 'x' }] }, { items: [{ id: 2 }] })).toEqual([
      'r.items[].id: string → number',
    ]);
  });

  it('merging samples keeps the union of keys and types', () => {
    expect(mergeShapes(shapeOf({ a: null }), shapeOf({ a: 'x', b: 1 }))).toEqual({
      a: 'string',
      b: 'number',
    });
    expect(mergeShapes('string', 'number')).toBe('number|string');
  });

  it('free-form maps only promise an object', () => {
    expect(shapeOf({ changes: { from: 'a' } })).toEqual({ changes: 'object' });
    expect(diff({ changes: { from: 'a' } }, { changes: { other: 1 } })).toEqual([]);
    expect(diff({ changes: { from: 'a' } }, { changes: 'x' })).toEqual([
      'r.changes: object → string',
    ]);
  });
});
