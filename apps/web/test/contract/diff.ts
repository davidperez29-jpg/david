/**
 * Breaking-change rules for the API contract (MASTER_SPECIFICATION §15.1: "sin cambios rompientes
 * sin versión"). The contract is what clients depend on: the routes (path, method, access) and the
 * input schema of every request body or query. A change is breaking when a request that was valid
 * before can be rejected now, or when something a client calls disappears.
 */
export interface Contract {
  routes: string[];
  schemas: Record<string, unknown>;
}

export interface ContractChange {
  breaking: boolean;
  where: string;
  what: string;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown) => JSON.stringify(v ?? null);

/** Bounds that make a schema stricter when they appear or grow (min*) / shrink (max*). */
const LOWER = ['minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties'];
const UPPER = ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties'];

export function diffSchema(a: unknown, b: unknown, where: string, out: ContractChange[]): void {
  const o = obj(a);
  const n = obj(b);
  const add = (breaking: boolean, what: string) => out.push({ breaking, where, what });

  if (str(o.type) !== str(n.type)) add(true, `tipo ${str(o.type)} → ${str(n.type)}`);
  if (str(o.format) !== str(n.format) && n.format != null) add(true, `formato → ${str(n.format)}`);
  if (str(o.pattern) !== str(n.pattern) && n.pattern != null)
    add(true, `patrón → ${str(n.pattern)}`);
  if (str(o.const) !== str(n.const)) add(true, `constante ${str(o.const)} → ${str(n.const)}`);

  if (Array.isArray(o.enum) || Array.isArray(n.enum)) {
    const before = (o.enum as unknown[] | undefined) ?? [];
    const after = new Set(((n.enum as unknown[] | undefined) ?? []).map(str));
    const removed = before.filter((v) => !after.has(str(v)));
    if (n.enum && removed.length) add(true, `valores eliminados: ${removed.map(str).join(', ')}`);
    else if (str(o.enum) !== str(n.enum)) add(false, 'valores añadidos');
  }

  for (const k of LOWER) {
    const x = o[k] as number | undefined;
    const y = n[k] as number | undefined;
    if (y != null && (x == null || y > x)) add(true, `${k} ${x ?? '—'} → ${y}`);
    else if (x !== y) add(false, `${k} ${x} → ${y ?? '—'}`);
  }
  for (const k of UPPER) {
    const x = o[k] as number | undefined;
    const y = n[k] as number | undefined;
    if (y != null && (x == null || y < x)) add(true, `${k} ${x ?? '—'} → ${y}`);
    else if (x !== y) add(false, `${k} ${x} → ${y ?? '—'}`);
  }

  const props = obj(o.properties);
  const nprops = obj(n.properties);
  const req = new Set((o.required as string[] | undefined) ?? []);
  const nreq = new Set((n.required as string[] | undefined) ?? []);
  for (const k of Object.keys(props)) {
    if (!(k in nprops)) add(true, `campo eliminado: ${k}`);
    else diffSchema(props[k], nprops[k], `${where}.${k}`, out);
  }
  for (const k of Object.keys(nprops))
    if (!(k in props))
      add(
        nreq.has(k),
        nreq.has(k) ? `nuevo campo obligatorio: ${k}` : `nuevo campo opcional: ${k}`,
      );
  for (const k of nreq) if (k in props && !req.has(k)) add(true, `campo ahora obligatorio: ${k}`);
  for (const k of req) if (k in nprops && !nreq.has(k)) add(false, `campo ahora opcional: ${k}`);

  if (o.items || n.items) diffSchema(o.items, n.items, `${where}[]`, out);

  for (const key of ['anyOf', 'oneOf'] as const) {
    if (!o[key] && !n[key]) continue;
    // Variants are matched by type (e.g. `integer | null`) and compared recursively.
    const after = [...((n[key] as unknown[] | undefined) ?? [])];
    for (const v of (o[key] as unknown[] | undefined) ?? []) {
      const i = after.findIndex((w) => str(obj(w).type) === str(obj(v).type));
      if (i < 0) add(true, `${key}: variante eliminada ${str(obj(v).type)}`);
      else diffSchema(v, after.splice(i, 1)[0], `${where}|${str(obj(v).type)}`, out);
    }
    for (const w of after) add(false, `${key}: variante añadida ${str(obj(w).type)}`);
  }
}

export function diffContracts(before: Contract, after: Contract): ContractChange[] {
  const out: ContractChange[] = [];
  const routes = new Set(after.routes);
  const routeKey = (r: string) => r.split(' ').slice(0, 2).join(' ');
  const afterByKey = new Map(after.routes.map((r) => [routeKey(r), r]));
  for (const r of before.routes) {
    if (routes.has(r)) continue;
    const now = afterByKey.get(routeKey(r));
    if (!now) out.push({ breaking: true, where: r, what: 'ruta eliminada' });
    else
      out.push({
        breaking: !now.endsWith('public'),
        where: routeKey(r),
        what: `acceso ${r.split(' ')[2]} → ${now.split(' ')[2]}`,
      });
  }
  const beforeKeys = new Set(before.routes.map(routeKey));
  for (const r of after.routes)
    if (!beforeKeys.has(routeKey(r))) out.push({ breaking: false, where: r, what: 'ruta nueva' });

  for (const [name, schema] of Object.entries(before.schemas)) {
    if (!(name in after.schemas))
      out.push({ breaking: true, where: name, what: 'esquema eliminado' });
    else diffSchema(schema, after.schemas[name], name, out);
  }
  for (const name of Object.keys(after.schemas))
    if (!(name in before.schemas))
      out.push({ breaking: false, where: name, what: 'esquema nuevo' });
  return out;
}
