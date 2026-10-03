import { schema } from '@tp/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';

const { auditLogs, users } = schema;

export async function listClientAudit(ctx: RequestContext, clientId: string, limit = 100) {
  await authorizeClient(ctx, 'audit:read', clientId);
  const rows = await ctx.db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.clientId, clientId))
    .orderBy(desc(auditLogs.occurredAt))
    .limit(Math.min(limit, 500));
  const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((x): x is string => !!x))];
  const names = actorIds.length
    ? await ctx.db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, actorIds))
    : [];
  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt,
    actor: names.find((n) => n.id === r.actorUserId)?.name ?? null,
    action: r.action,
    entityType: r.entityType,
    changes: r.changes,
    reason: r.reason,
  }));
}
