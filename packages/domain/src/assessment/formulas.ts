/**
 * Derived formulas as data (restructure phase 4, docs/EVALUATION_SYSTEM.md §1): a small, safe
 * expression language with editable constants, like the club workbook («constantes editables»).
 * No `eval`: expressions are parsed into a tree and evaluated over known names only.
 *
 * - Names: test slugs (`body_mass`), one side of a sided test (`single_leg_cmj_height.right`),
 *   other formulas (`sum_6_skinfolds`) and the formula's own constants (`a`, `b`).
 * - Operators: + − × / ^ and parentheses; functions: sum, mean, min, max, abs, sqrt.
 * - A missing input gives no value (never a zero), as the workbook's `IF(COUNT(…)<n;"";…)`.
 */
import { DomainError } from '../shared/errors';

export type FormulaExpr =
  | { t: 'num'; v: number }
  | { t: 'name'; name: string }
  | { t: 'neg'; e: FormulaExpr }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; l: FormulaExpr; r: FormulaExpr }
  | { t: 'call'; fn: FunctionName; args: FormulaExpr[] };

export const FORMULA_FUNCTIONS = ['sum', 'mean', 'min', 'max', 'abs', 'sqrt'] as const;
type FunctionName = (typeof FORMULA_FUNCTIONS)[number];

const NAME = /^[a-z_][a-z0-9_]*(\.(left|right))?$/;

function tokenize(src: string): string[] {
  const out: string[] = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?)|([a-z_][a-z0-9_]*(?:\.(?:left|right))?)|(.))/gy;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1]) out.push(m[1].replace(',', '.'));
    else if (m[2]) out.push(m[2]);
    else if (m[3] && m[3].trim()) {
      if (!'+-*/^(),'.includes(m[3])) throw invalid(`Carácter no permitido: «${m[3]}».`);
      out.push(m[3]);
    }
  }
  return out;
}

const invalid = (msg: string) =>
  new DomainError('validation', `Fórmula no válida: ${msg}`, { expression: [msg] });

/** Parses an expression (throws a validation error with the reason). */
export function parseFormula(src: string): FormulaExpr {
  if (src.length > 500) throw invalid('demasiado larga (máximo 500 caracteres).');
  const tokens = tokenize(src.toLowerCase());
  let i = 0;
  const peek = () => tokens[i];
  const take = (t?: string) => {
    const x = tokens[i++];
    if (x === undefined || (t && x !== t)) throw invalid(t ? `se esperaba «${t}».` : 'incompleta.');
    return x;
  };
  const expr = (): FormulaExpr => {
    let l = term();
    while (peek() === '+' || peek() === '-') {
      const op = take() as '+' | '-';
      l = { t: 'bin', op, l, r: term() };
    }
    return l;
  };
  const term = (): FormulaExpr => {
    let l = power();
    while (peek() === '*' || peek() === '/') {
      const op = take() as '*' | '/';
      l = { t: 'bin', op, l, r: power() };
    }
    return l;
  };
  const power = (): FormulaExpr => {
    const l = unary();
    if (peek() === '^') {
      take();
      return { t: 'bin', op: '^', l, r: power() };
    }
    return l;
  };
  const unary = (): FormulaExpr => {
    if (peek() === '-') {
      take();
      return { t: 'neg', e: unary() };
    }
    return primary();
  };
  const primary = (): FormulaExpr => {
    const x = take();
    if (x === '(') {
      const e = expr();
      take(')');
      return e;
    }
    if (/^\d/.test(x)) return { t: 'num', v: Number(x) };
    if (NAME.test(x)) {
      if (peek() !== '(') return { t: 'name', name: x };
      if (!(FORMULA_FUNCTIONS as readonly string[]).includes(x))
        throw invalid(`función desconocida «${x}».`);
      take('(');
      const args: FormulaExpr[] = [];
      if (peek() !== ')') {
        args.push(expr());
        while (peek() === ',') {
          take();
          args.push(expr());
        }
      }
      take(')');
      if (!args.length) throw invalid(`«${x}» necesita al menos un valor.`);
      return { t: 'call', fn: x as FunctionName, args };
    }
    throw invalid(`símbolo inesperado «${x}».`);
  };
  if (!tokens.length) throw invalid('está vacía.');
  const e = expr();
  if (i < tokens.length) throw invalid(`sobra «${tokens[i]}».`);
  return e;
}

/** Names an expression uses, without repetitions (inputs and constants). */
export function formulaNames(e: FormulaExpr): string[] {
  const out = new Set<string>();
  const walk = (x: FormulaExpr) => {
    if (x.t === 'name') out.add(x.name);
    else if (x.t === 'neg') walk(x.e);
    else if (x.t === 'bin') {
      walk(x.l);
      walk(x.r);
    } else if (x.t === 'call') x.args.forEach(walk);
  };
  walk(e);
  return [...out];
}

/** Evaluates an expression; any missing name or invalid operation gives null. */
export function evaluateFormula(
  e: FormulaExpr,
  lookup: (name: string) => number | null | undefined,
): number | null {
  const ev = (x: FormulaExpr): number | null => {
    switch (x.t) {
      case 'num':
        return x.v;
      case 'name': {
        const v = lookup(x.name);
        return v == null || !Number.isFinite(v) ? null : v;
      }
      case 'neg': {
        const v = ev(x.e);
        return v == null ? null : -v;
      }
      case 'bin': {
        const l = ev(x.l);
        const r = ev(x.r);
        if (l == null || r == null) return null;
        const v =
          x.op === '+'
            ? l + r
            : x.op === '-'
              ? l - r
              : x.op === '*'
                ? l * r
                : x.op === '/'
                  ? r === 0
                    ? NaN
                    : l / r
                  : l ** r;
        return Number.isFinite(v) ? v : null;
      }
      case 'call': {
        const vs = x.args.map(ev);
        if (vs.some((v) => v == null)) return null;
        const n = vs as number[];
        const v =
          x.fn === 'sum'
            ? n.reduce((a, b) => a + b, 0)
            : x.fn === 'mean'
              ? n.reduce((a, b) => a + b, 0) / n.length
              : x.fn === 'min'
                ? Math.min(...n)
                : x.fn === 'max'
                  ? Math.max(...n)
                  : x.fn === 'abs'
                    ? Math.abs(n[0]!)
                    : Math.sqrt(n[0]!);
        return Number.isFinite(v) ? v : null;
      }
    }
  };
  return ev(e);
}

/** A derived formula as stored (global or the centre's own copy with other constants). */
export interface FormulaDef {
  slug: string;
  name: string;
  unit: string;
  expression: string;
  /** Editable constants, e.g. { a: 0.153, b: 5.783 }. */
  constants: Record<string, number>;
  better: 'higher' | 'lower' | 'target_range';
  isEstimate: boolean;
  /** How the inputs' error combines for a change verdict ('none' → no verdict). */
  errorModel: 'difference' | 'none';
  /** Plain-language definition shown next to the value (no black box). */
  definition: string;
  /** Only for this sex (e.g. an equation validated in men); others get no value. */
  sex?: 'male' | 'female' | null;
}

export interface CompiledFormula extends FormulaDef {
  ast: FormulaExpr;
  /** Test slugs and formula slugs it needs (constants excluded). */
  inputs: string[];
}

/**
 * Parses and orders formulas so each one comes after the formulas it uses. Unknown names are
 * allowed only if `knownInputs` says so (test slugs); cycles are a validation error.
 */
export function compileFormulas(
  defs: FormulaDef[],
  knownInputs?: (name: string) => boolean,
): CompiledFormula[] {
  const bySlug = new Map<string, CompiledFormula>();
  for (const d of defs) {
    for (const k of Object.keys(d.constants))
      if (!/^[a-z]$/.test(k))
        throw invalid(`la constante «${k}» debe ser una sola letra (a, b, c…).`);
    const ast = parseFormula(d.expression);
    const inputs = formulaNames(ast).filter((n) => !(n in d.constants));
    bySlug.set(d.slug, { ...d, ast, inputs });
  }
  for (const f of bySlug.values())
    for (const n of f.inputs) {
      const base = n.replace(/\.(left|right)$/, '');
      if (bySlug.has(base) || !knownInputs || knownInputs(base)) continue;
      throw invalid(`«${f.name}» usa «${n}», que no es un test ni otra fórmula.`);
    }
  const out: CompiledFormula[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (f: CompiledFormula, path: string[]) => {
    if (state.get(f.slug) === 'done') return;
    if (state.get(f.slug) === 'visiting')
      throw invalid(`dependencia circular: ${[...path, f.slug].join(' → ')}.`);
    state.set(f.slug, 'visiting');
    for (const n of f.inputs) {
      const dep = bySlug.get(n);
      if (dep) visit(dep, [...path, f.slug]);
    }
    state.set(f.slug, 'done');
    out.push(f);
  };
  for (const f of bySlug.values()) visit(f, []);
  return out;
}

/**
 * Evaluates every formula over one set of values (test slug → value, `slug.left/right` for
 * sides), in dependency order. Returns only the formulas with a value, with the inputs used.
 */
export function evaluateFormulas(
  compiled: CompiledFormula[],
  values: Record<string, number>,
  opts: { sex?: string | null } = {},
): { formula: CompiledFormula; value: number; inputs: Record<string, number> }[] {
  const known: Record<string, number> = { ...values };
  const out: { formula: CompiledFormula; value: number; inputs: Record<string, number> }[] = [];
  for (const f of compiled) {
    if (f.sex && f.sex !== opts.sex) continue;
    const v = evaluateFormula(f.ast, (n) => f.constants[n] ?? known[n]);
    if (v == null) continue;
    known[f.slug] = v;
    out.push({
      formula: f,
      value: v,
      inputs: Object.fromEntries(f.inputs.flatMap((n) => (n in known ? [[n, known[n]!]] : []))),
    });
  }
  return out;
}

/** The expression with the constants written in, for the definition shown to people. */
export function formulaText(f: Pick<FormulaDef, 'expression' | 'constants'>): string {
  return f.expression.replace(/\b([a-z])\b/g, (m) =>
    m in f.constants
      ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(f.constants[m]!)
      : m,
  );
}
