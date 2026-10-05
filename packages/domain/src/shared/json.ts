/**
 * JSON text with object keys sorted at every level, so two values with the same content compare
 * equal whatever their key order. PostgreSQL's jsonb does not keep the order in which keys were
 * written: comparing `JSON.stringify` of a stored value with a new one reports changes that do
 * not exist. Array order is content and is kept; undefined properties are dropped, as in JSON.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/** Same content, whatever the key order (see `canonicalJson`). */
export const sameJson = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
