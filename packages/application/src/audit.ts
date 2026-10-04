import { schema, type Executor } from '@tp/db';
import { redact, type FieldChange } from '@tp/domain';
import type { AppContext, RequestContext } from './context';

export type AuditAction =
  | 'create'
  | 'update'
  | 'archive'
  | 'restore'
  | 'delete'
  | 'view_sensitive'
  | 'export'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'totp_enabled'
  | 'password_changed'
  | 'password_reset'
  | 'invite'
  | 'invitation_accepted'
  | 'assign'
  | 'unassign'
  | 'grant'
  | 'revoke'
  | 'clear'
  | 'recovery_code_used'
  | 'recovery_codes_regenerated'
  | 'session_revoked'
  | 'anonymize'
  | 'privacy_request';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  clientId?: string | null;
  changes?: FieldChange[] | Record<string, unknown> | null;
  reason?: string | null;
}

/**
 * Writes an audit entry using the same executor (transaction) as the change being audited,
 * so the change and its trail commit or roll back together (§14.6).
 */
export async function writeAudit(
  tx: Executor,
  ctx: RequestContext | (AppContext & { actor?: undefined }),
  entry: AuditEntry,
  actorOverride?: { userId: string | null; organizationId: string; roles: string[] },
): Promise<void> {
  const actor = actorOverride ?? ctx.actor;
  const changes = Array.isArray(entry.changes) ? redact(entry.changes) : (entry.changes ?? null);
  await tx.insert(schema.auditLogs).values({
    occurredAt: ctx.now(),
    organizationId: actor?.organizationId ?? null,
    actorUserId: actor?.userId ?? null,
    actorRoles: actor?.roles ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    clientId: entry.clientId ?? null,
    changes,
    reason: entry.reason ?? null,
    requestId: ctx.requestId ?? null,
    ipHash: ctx.ipHash ?? null,
  });
}
