/**
 * Response contract (Phase 15 pending): the shape of every GET response (keys and value types, not
 * values). Data-dependent variations are not breaking: a null is compatible with any type and an
 * empty list says nothing about its elements.
 */
export type Shape = string | Shape[] | { [k: string]: Shape };

/**
 * Free-form JSON maps whose keys depend on the record (audit `changes`, alert `payload`, rule
 * `params`…): only "it is an object" is part of the contract.
 */
const OPEN_MAPS = new Set([
  'changes',
  'payload',
  'params',
  'parameters',
  'data',
  'details',
  'inputs',
  'metadata',
]);

export function shapeOf(v: unknown, depth = 0): Shape {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) {
    const items = v.slice(0, 5).map((x) => shapeOf(x, depth + 1));
    return items.length ? [items.reduce(mergeShapes)] : [];
  }
  if (typeof v === 'object') {
    if (depth > 6) return 'object';
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => {
          const x = (v as Record<string, unknown>)[k];
          const open = OPEN_MAPS.has(k) && x !== null && typeof x === 'object' && !Array.isArray(x);
          return [k, open ? 'object' : shapeOf(x, depth + 1)];
        }),
    );
  }
  return typeof v;
}

/** Union of two shapes of the same field (several samples, several runs). */
export function mergeShapes(a: Shape, b: Shape): Shape {
  if (a === 'null') return b;
  if (b === 'null') return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (!a.length) return b;
    if (!b.length) return a;
    return [mergeShapes(a[0]!, b[0]!)];
  }
  if (isObj(a) && isObj(b)) {
    const out: { [k: string]: Shape } = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)].sort()))
      out[k] = k in a && k in b ? mergeShapes(a[k]!, b[k]!) : (a[k] ?? b[k])!;
    return out;
  }
  return a === b ? a : [a, b].map(String).sort().join('|');
}

const isObj = (s: Shape): s is { [k: string]: Shape } => typeof s === 'object' && !Array.isArray(s);
const types = (s: string) => new Set(s.split('|'));

/** Breaking differences: a field that disappeared or whose type no longer matches. */
export function breakingDiff(before: Shape, after: Shape, where: string, out: string[]): void {
  if (before === 'null' || after === 'null') return;
  if (before === 'object' && isObj(after)) return;
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) return void out.push(`${where}: era una lista`);
    if (before.length && after.length) breakingDiff(before[0]!, after[0]!, `${where}[]`, out);
    return;
  }
  if (isObj(before)) {
    if (!isObj(after)) return void out.push(`${where}: era un objeto`);
    for (const k of Object.keys(before))
      if (!(k in after)) out.push(`${where}.${k}: campo eliminado`);
      else breakingDiff(before[k]!, after[k]!, `${where}.${k}`, out);
    return;
  }
  if (typeof after !== 'string') return void out.push(`${where}: era ${before}`);
  const was = types(before);
  const now = types(after);
  if (![...now].some((t) => was.has(t))) out.push(`${where}: ${before} → ${after}`);
}
