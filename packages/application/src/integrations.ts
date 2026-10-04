/**
 * Integrations (Phase 15, MASTER_SPECIFICATION §5): external data enters through adapters that
 * implement `ExternalDataSource` and write `external_measurements`. Vendor connections (Garmin,
 * Polar, Strava…) will be adapters that fetch with the encrypted tokens of `integration_connections`;
 * until a real need appears there are two generic ones: a JSON array and a CSV export.
 *
 * - Physiological measurements (heart rate, HRV, sleep) are health data: stored only with the
 *   client's consent and shown only to whoever may read health data.
 * - Re-importing the same file creates no duplicates (dedupe key per source).
 */
import { externalImportSchema, externalListSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  DomainError,
  hasActiveConsent,
  MEASUREMENT_TYPES,
  parseCsv,
  rowsToRecords,
  validateMeasurement,
  type ConsentPurpose,
  type ExternalMeasurementInput,
} from '@tp/domain';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { writeAudit } from './audit';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const s = schema;
const MAX_ROWS = 5000;

/** An adapter turns what a device or app exported into measurements (validated afterwards). */
export interface ExternalDataSource {
  provider: string;
  parse(content: string): ExternalMeasurementInput[];
}

const num = (v: unknown) =>
  typeof v === 'number'
    ? v
    : Number(
        String(v ?? '')
          .trim()
          .replace(',', '.'),
      );

const jsonSource: ExternalDataSource = {
  provider: 'json',
  parse(content) {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new DomainError('validation', 'El archivo no es JSON válido.', { content: ['json'] });
    }
    const list = Array.isArray(data)
      ? data
      : ((data as { measurements?: unknown[] })?.measurements ?? null);
    if (!Array.isArray(list))
      throw new DomainError('validation', 'Se esperaba una lista de mediciones.', {
        content: ['shape'],
      });
    return list.map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        type: String(o.type ?? ''),
        value: num(o.value),
        unit: String(o.unit ?? ''),
        measuredAt: String(o.measuredAt ?? o.measured_at ?? ''),
        device: o.device ? String(o.device) : null,
        externalId:
          o.id != null ? String(o.id) : o.externalId != null ? String(o.externalId) : null,
      };
    });
  },
};

/** CSV with Spanish or English headers: tipo/type, valor/value, unidad/unit, fecha/measured_at… */
const csvSource: ExternalDataSource = {
  provider: 'csv',
  parse(content) {
    const { headers, records } = rowsToRecords(parseCsv(content));
    const pick = (r: Record<string, string>, ...keys: string[]) =>
      keys.map((k) => r[k]).find((v) => v != null && v !== '') ?? '';
    for (const need of [
      ['tipo', 'type'],
      ['valor', 'value'],
      ['unidad', 'unit'],
      ['fecha', 'measured_at'],
    ])
      if (!need.some((h) => headers.includes(h)))
        throw new DomainError('validation', `Falta la columna «${need[0]}».`, {
          content: ['columns'],
        });
    return records.map((r) => ({
      type: pick(r, 'tipo', 'type'),
      value: num(pick(r, 'valor', 'value')),
      unit: pick(r, 'unidad', 'unit'),
      measuredAt: pick(r, 'fecha', 'measured_at'),
      device: pick(r, 'dispositivo', 'device') || null,
      externalId: pick(r, 'id', 'external_id') || null,
    }));
  },
};

const SOURCES: Record<string, ExternalDataSource> = { json: jsonSource, csv: csvSource };

async function healthConsented(ctx: RequestContext, clientId: string) {
  const cs = await ctx.db.select().from(s.consents).where(eq(s.consents.clientId, clientId));
  return hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
}

async function importExternalMeasurements_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(externalImportSchema, input);
  const resource = await authorizeClient(ctx, 'integrations:import', clientId);
  const items = SOURCES[d.provider]!.parse(d.content);
  if (items.length > MAX_ROWS)
    throw new DomainError('validation', `Como máximo ${MAX_ROWS} mediciones por archivo.`, {
      content: ['rows'],
    });
  const consented = await healthConsented(ctx, clientId);
  const source = `import:${d.provider}`;
  const errors: { row: number; errors: Record<string, string> }[] = [];
  const values: (typeof s.externalMeasurements.$inferInsert)[] = [];
  for (const [i, m] of items.entries()) {
    const e = validateMeasurement(m, ctx.now());
    if (!e.type && MEASUREMENT_TYPES[m.type]!.health && !consented)
      e.type = 'Dato de salud: requiere el consentimiento de datos de salud del cliente.';
    if (Object.keys(e).length) {
      errors.push({ row: i + 1, errors: e });
      continue;
    }
    // Without an id from the device, the content itself identifies the measurement.
    const externalId =
      m.externalId ??
      createHash('sha256')
        .update(`${clientId}|${m.type}|${new Date(m.measuredAt).toISOString()}|${m.value}`)
        .digest('hex')
        .slice(0, 32);
    values.push({
      organizationId: resource.organizationId,
      clientId,
      source,
      device: m.device ?? d.device ?? null,
      type: m.type,
      value: String(m.value),
      unit: m.unit,
      measuredAt: new Date(m.measuredAt),
      externalId: `${clientId}:${externalId}`,
    });
  }
  let imported = 0;
  for (let i = 0; i < values.length; i += 500) {
    const r = await ctx.db
      .insert(s.externalMeasurements)
      .values(values.slice(i, i + 500))
      .onConflictDoNothing({
        target: [s.externalMeasurements.source, s.externalMeasurements.externalId],
      })
      .returning({ id: s.externalMeasurements.id });
    imported += r.length;
  }
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'external_measurements',
    entityId: clientId,
    clientId,
    changes: {
      provider: d.provider,
      imported,
      duplicates: values.length - imported,
      rejected: errors.length,
    },
  });
  return { imported, duplicates: values.length - imported, errors };
}

async function listExternalMeasurements_(ctx: RequestContext, clientId: string, query: unknown) {
  const q = parse(externalListSchema, query);
  await authorizeClient(ctx, 'clients:read', clientId);
  // Physiological types only for whoever may read health data of this client.
  let healthOk = false;
  try {
    await authorizeClient(ctx, 'health:read', clientId);
    healthOk = true;
  } catch {
    healthOk = false;
  }
  const allowed = Object.entries(MEASUREMENT_TYPES)
    .filter(([, t]) => healthOk || !t.health)
    .map(([k]) => k);
  const rows = await ctx.db
    .select()
    .from(s.externalMeasurements)
    .where(
      and(
        eq(s.externalMeasurements.clientId, clientId),
        inArray(
          s.externalMeasurements.type,
          q.type ? allowed.filter((t) => t === q.type) : allowed,
        ),
      ),
    )
    .orderBy(desc(s.externalMeasurements.measuredAt))
    .limit(q.limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    label: MEASUREMENT_TYPES[r.type]?.label ?? r.type,
    value: Number(r.value),
    unit: r.unit,
    measuredAt: r.measuredAt,
    device: r.device,
    source: r.source,
  }));
}

export const importExternalMeasurements = secured(importExternalMeasurements_);
export const listExternalMeasurements = secured(listExternalMeasurements_);
