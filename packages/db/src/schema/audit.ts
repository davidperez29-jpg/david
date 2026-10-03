import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './_common';

/**
 * Append-only audit trail (§14.6). The application role has no UPDATE/DELETE privilege on this
 * table (enforced by migration 0001_audit_append_only).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    organizationId: uuid('organization_id'),
    actorUserId: uuid('actor_user_id'),
    actorRoles: text('actor_roles').array(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    clientId: uuid('client_id'),
    changes: jsonb('changes'),
    reason: text('reason'),
    requestId: text('request_id'),
    ipHash: text('ip_hash'),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId, t.occurredAt),
    index('audit_client_idx').on(t.clientId, t.occurredAt),
    index('audit_org_idx').on(t.organizationId, t.occurredAt),
  ],
);
