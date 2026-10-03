import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_common';
import { orgOwned } from './_org';
import { users } from './iam';
import { clients } from './clients';

/** Cross-cutting: notifications, reports, imports, files, outbox, integrations (§6.2). */
export const notificationChannel = pgEnum('notification_channel', ['in_app', 'email', 'push']);
export const jobStatus = pgEnum('job_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const reportFormat = pgEnum('report_format', ['pdf', 'xlsx', 'csv', 'json']);
export const importRowStatus = pgEnum('import_row_status', [
  'valid',
  'invalid',
  'imported',
  'skipped',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    organizationId: orgOwned(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: notificationChannel('channel').notNull().default('in_app'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt)],
);

export const files = pgTable('files', {
  id: id(),
  organizationId: orgOwned(),
  storageKey: text('storage_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256'),
  purpose: text('purpose').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by'),
  ...timestamps(),
});

export const reports = pgTable(
  'reports',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    format: reportFormat('format').notNull(),
    parameters: jsonb('parameters'),
    status: jobStatus('status').notNull().default('pending'),
    fileId: uuid('file_id').references(() => files.id),
    error: text('error'),
    generatedBy: uuid('generated_by'),
    ...timestamps(),
  },
  (t) => [index('reports_client_idx').on(t.clientId)],
);

export const importJobs = pgTable('import_jobs', {
  id: id(),
  organizationId: orgOwned(),
  entity: text('entity').notNull(),
  fileId: uuid('file_id').references(() => files.id),
  status: jobStatus('status').notNull().default('pending'),
  totalRows: integer('total_rows'),
  validRows: integer('valid_rows'),
  createdBy: uuid('created_by'),
  ...timestamps(),
});

export const importRows = pgTable(
  'import_rows',
  {
    id: id(),
    organizationId: orgOwned(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => importJobs.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    data: jsonb('data').notNull(),
    errors: jsonb('errors'),
    status: importRowStatus('status').notNull(),
    createdEntityId: uuid('created_entity_id'),
  },
  (t) => [unique('import_rows_uq').on(t.jobId, t.rowNumber)],
);

/** Transactional outbox for domain events processed by the worker (§4.1.4). */
export const domainEvents = pgTable(
  'domain_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    organizationId: uuid('organization_id'),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    index('domain_events_pending_idx')
      .on(t.occurredAt)
      .where(sql`${t.processedAt} IS NULL`),
  ],
);

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    /** OAuth tokens, AES-256-GCM encrypted. */
    credentialsEnc: text('credentials_enc'),
    status: text('status').notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    check('integration_connections_status_ck', sql`${t.status} IN ('active','revoked','error')`),
  ],
);

export const externalMeasurements = pgTable(
  'external_measurements',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id').references(() => integrationConnections.id, {
      onDelete: 'set null',
    }),
    source: text('source').notNull(),
    device: text('device'),
    type: text('type').notNull(),
    value: text('value'),
    unit: text('unit'),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    raw: jsonb('raw'),
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('external_measurements_client_idx').on(t.clientId, t.type, t.measuredAt),
    unique('external_measurements_dedupe_uq').on(t.source, t.externalId),
  ],
);
