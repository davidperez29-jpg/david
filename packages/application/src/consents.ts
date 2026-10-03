import { consentGrantSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  CONSENT_PURPOSES,
  CONSENT_TEXT_VERSIONS,
  DomainError,
  hasActiveConsent,
  type ConsentPurpose,
} from '@tp/domain';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { parse } from './validation';

const { consents } = schema;

export async function listConsents(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'consents:read', clientId);
  const rows = await ctx.db
    .select()
    .from(consents)
    .where(eq(consents.clientId, clientId))
    .orderBy(desc(consents.grantedAt));
  const records = rows.map((r) => ({
    purpose: r.purpose as ConsentPurpose,
    textVersion: r.textVersion,
    grantedAt: r.grantedAt,
    revokedAt: r.revokedAt,
  }));
  return {
    status: CONSENT_PURPOSES.map((p) => ({
      purpose: p,
      currentVersion: CONSENT_TEXT_VERSIONS[p],
      active: hasActiveConsent(records, p),
    })),
    history: rows,
  };
}

export async function grantConsent(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const data = parse(consentGrantSchema, input);
  const resource = await authorizeClient(ctx, 'consents:write', clientId);
  const scope = requirePermission(ctx, 'consents:write', resource);
  if (scope === 'own' && data.method !== 'in_app') {
    throw new DomainError('validation', 'Método no válido.', { method: ['in_app_only'] });
  }
  if (scope !== 'own' && data.method === 'in_app') {
    // Staff can only record consent collected outside the app; in-app consent is the client's own act.
    throw new DomainError(
      'validation',
      'El consentimiento en la app solo puede darlo el propio cliente.',
      { method: ['client_only'] },
    );
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(consents)
      .set({ revokedAt: ctx.now() })
      .where(
        and(
          eq(consents.clientId, clientId),
          eq(consents.purpose, data.purpose),
          isNull(consents.revokedAt),
        ),
      );
    await tx.insert(consents).values({
      clientId,
      purpose: data.purpose,
      textVersion: CONSENT_TEXT_VERSIONS[data.purpose],
      method: data.method,
      grantedAt: ctx.now(),
      recordedBy: ctx.actor.userId,
    });
    await writeAudit(tx, ctx, {
      action: 'grant',
      entityType: 'consent',
      entityId: clientId,
      clientId,
      changes: {
        purpose: data.purpose,
        method: data.method,
        version: CONSENT_TEXT_VERSIONS[data.purpose],
      },
    });
  });
}

export async function revokeConsent(
  ctx: RequestContext,
  clientId: string,
  purpose: string,
): Promise<void> {
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) {
    throw new DomainError('validation', 'Finalidad desconocida.', { purpose: ['unknown'] });
  }
  const p = purpose as ConsentPurpose;
  await authorizeClient(ctx, 'consents:write', clientId);
  await ctx.db.transaction(async (tx) => {
    const revoked = await tx
      .update(consents)
      .set({ revokedAt: ctx.now() })
      .where(
        and(eq(consents.clientId, clientId), eq(consents.purpose, p), isNull(consents.revokedAt)),
      )
      .returning({ id: consents.id });
    if (!revoked.length)
      throw new DomainError('not_found', 'No hay un consentimiento activo para esa finalidad.');
    await writeAudit(tx, ctx, {
      action: 'revoke',
      entityType: 'consent',
      entityId: clientId,
      clientId,
      changes: { purpose: p },
    });
  });
}
