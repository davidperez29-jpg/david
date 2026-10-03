export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v;
}

/**
 * Field-level diff used for audit_logs.changes (§14.6). Only listed fields are compared so that
 * technical columns (updatedAt, version) never pollute the audit trail.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T> | null,
  after: Partial<T> | null,
  fields: readonly (keyof T & string)[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const b = normalize(before?.[field]);
    const a = normalize(after?.[field]);
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/** Fields whose values must never be written to audit logs in clear text. */
export const REDACTED_AUDIT_FIELDS = new Set(['passwordHash', 'totpSecret', 'tokenHash']);

export function redact(changes: FieldChange[]): FieldChange[] {
  return changes.map((c) =>
    REDACTED_AUDIT_FIELDS.has(c.field) ? { ...c, before: '[redacted]', after: '[redacted]' } : c,
  );
}
