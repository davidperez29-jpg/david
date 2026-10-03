/**
 * Bounded rule DSL (MASTER_SPECIFICATION §13.4). JSON conditions evaluated by this interpreter —
 * never `eval`. Operators: and, or, not, ==, !=, <, <=, >, >=, in, between, exists, var, param,
 * trend, count_in_window.
 *
 * A comparison with a missing value is false and the path is reported in `missing`, so the
 * explanation can say which data were absent. A rule whose parameters are not configured
 * (`null`) does not run: `evaluate` reports it as pending.
 */
export type Expr = unknown;
export type Facts = Record<string, unknown>;

export interface EvalResult {
  value: boolean;
  /** Variable paths that were read, with the value seen (for the explanation). */
  used: Record<string, unknown>;
  missing: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function getPath(facts: Facts, path: string): unknown {
  let cur: unknown = facts;
  for (const k of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

const OPS = new Set([
  'and',
  'or',
  'not',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'between',
  'exists',
  'var',
  'param',
  'trend',
  'count_in_window',
]);

export class DslError extends Error {}

/** Structural validation (used by the rule editor before saving). */
export function validateExpr(e: Expr, params: Record<string, unknown> = {}): string[] {
  const errs: string[] = [];
  const walk = (x: Expr) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!isObj(x)) return;
    const keys = Object.keys(x);
    if (keys.length !== 1) return errs.push(`Nodo con ${keys.length} operadores`);
    const op = keys[0]!;
    if (!OPS.has(op)) return errs.push(`Operador desconocido «${op}»`);
    if (op === 'param' && !(String(x[op]) in params))
      errs.push(`Parámetro sin definir «${String(x[op])}»`);
    if (op !== 'var' && op !== 'param') walk(x[op]);
  };
  walk(e);
  return errs;
}

export function evaluate(e: Expr, facts: Facts, params: Record<string, unknown>): EvalResult {
  const used: Record<string, unknown> = {};
  const missing = new Set<string>();

  const val = (x: Expr): unknown => {
    if (Array.isArray(x)) return x.map(val);
    if (!isObj(x)) return x;
    const [op, arg] = Object.entries(x)[0] ?? [];
    switch (op) {
      case 'var': {
        const v = getPath(facts, String(arg));
        used[String(arg)] = v;
        if (v === undefined || v === null) missing.add(String(arg));
        return v;
      }
      case 'param':
        return params[String(arg)];
      default:
        return truth(x);
    }
  };

  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

  const truth = (x: Expr): boolean => {
    if (!isObj(x)) return Boolean(x);
    const [op, arg] = Object.entries(x)[0] ?? [];
    const args = Array.isArray(arg) ? arg : [arg];
    switch (op) {
      case 'and':
        return args.every((a) => truth(a));
      case 'or':
        return args.some((a) => truth(a));
      case 'not':
        return !truth(args[0]);
      case 'exists': {
        const v = val(args[0]);
        return v !== undefined && v !== null;
      }
      case '==':
      case '!=': {
        const [a, b] = args.map(val);
        if (a === undefined || b === undefined) return false;
        return op === '==' ? a === b : a !== b;
      }
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const [a, b] = args.map((y) => num(val(y)));
        if (a === undefined || b === undefined) return false;
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      }
      case 'between': {
        const [v, lo, hi] = args.map((y) => num(val(y)));
        if (v === undefined || lo === undefined || hi === undefined) return false;
        return v >= lo && v <= hi;
      }
      case 'in': {
        const [needle, hay] = args.map(val);
        if (needle === undefined || !Array.isArray(hay)) return false;
        return hay.includes(needle);
      }
      case 'trend': {
        // { trend: [ {var: series of numbers (oldest first)}, "down" | "up" ] } over ≥ 3 points.
        const [series, dir] = args.map(val);
        if (!Array.isArray(series) || series.length < 3) return false;
        const xs = series.map(Number);
        const up = xs.every((v, i) => i === 0 || v > xs[i - 1]!);
        const down = xs.every((v, i) => i === 0 || v < xs[i - 1]!);
        return dir === 'up' ? up : dir === 'down' ? down : false;
      }
      case 'count_in_window': {
        // { count_in_window: [ {var: dates[]}, days, {var: today}, min ] } → count ≥ min
        const [dates, days, today, min] = args.map(val);
        if (!Array.isArray(dates) || typeof today !== 'string') return false;
        const from = new Date(Date.parse(`${today}T00:00:00Z`) - Number(days) * 86_400_000)
          .toISOString()
          .slice(0, 10);
        return (
          dates.filter((d) => typeof d === 'string' && d >= from && d <= today).length >=
          Number(min ?? 1)
        );
      }
      case 'var':
      case 'param':
        return Boolean(val(x));
      default:
        throw new DslError(`Operador desconocido «${op}»`);
    }
  };

  const value = truth(e);
  return { value, used, missing: [...missing] };
}

/** Parameters left `null` mean "pending configuration": the rule must not run. */
export function pendingParams(params: Record<string, { value: unknown }>): string[] {
  return Object.entries(params)
    .filter(([, p]) => p.value === null || p.value === undefined)
    .map(([k]) => k);
}
