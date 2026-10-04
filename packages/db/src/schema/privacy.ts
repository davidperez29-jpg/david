/**
 * Privacy (Phase 13, RGPD arts. 15–21): data-subject requests with their legal deadline, and 2FA
 * recovery codes. Erasure itself anonymizes the client in place (clients.anonymized_at).
 */
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_common';
import { clients } from './clients';
import { organizations, users } from './iam';

export const privacyRequestType = pgEnum('privacy_request_type', [
  'access',
  'portability',
  'rectification',
  'erasure',
  'restriction',
  'objection',
]);
export const privacyRequestStatus = pgEnum('privacy_request_status', [
  'pending',
  'completed',
  'rejected',
  'cancelled',
]);

export const privacyRequests = pgTable(
  'privacy_requests',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    type: privacyRequestType('type').notNull(),
    status: privacyRequestStatus('status').notNull().default('pending'),
    details: text('details'),
    /** One month from the request (art. 12.3 RGPD). */
    dueOn: date('due_on').notNull(),
    requestedBy: uuid('requested_by'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    response: text('response'),
    ...timestamps(),
  },
  (t) => [
    index('privacy_requests_org_idx').on(t.organizationId, t.status),
    index('privacy_requests_client_idx').on(t.clientId),
  ],
);

/** One-time 2FA recovery codes (only the SHA-256 is stored). */
export const userRecoveryCodes = pgTable(
  'user_recovery_codes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('user_recovery_codes_user_idx').on(t.userId)],
);
