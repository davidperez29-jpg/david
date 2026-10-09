import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_common';
import { orgOwned, orgScoped } from './_org';
import { clients } from './clients';
import { evidenceLevel, knowledgeClaims } from './science';

/**
 * MOTOR DE DECISIONES (§13). Rules are versioned data; a published rule set is immutable.
 * Recommendations store the inputs snapshot and the explanation, so any output can be
 * reproduced and explained later (§36). Program proposals are training_plans with
 * kind = PROPOSAL linked through recommendation_id.
 */
export const ruleDomain = pgEnum('rule_domain', [
  'screening',
  'needs',
  'prioritization',
  'method_selection',
  'exercise_selection',
  'dosing',
  'progression',
  'monitoring_alert',
  'substitution',
]);
export const ruleSetStatus = pgEnum('rule_set_status', ['draft', 'published', 'retired']);
export const recommendationType = pgEnum('recommendation_type', [
  'need',
  'priority',
  'method',
  'exercise',
  'dose',
  'plan_proposal',
  'progression',
  'deload',
  'substitution',
  'reassessment',
  'referral_notice',
  // Restructure phase 15: sessions moved to the client's available days.
  'schedule',
]);
export const recommendationStatus = pgEnum('recommendation_status', [
  'proposed',
  'accepted',
  'accepted_with_changes',
  'rejected',
  'superseded',
  'expired',
  'postponed',
  /** Applied and then undone by the trainer (Phase 11). */
  'reverted',
]);
export const recConfidence = pgEnum('recommendation_confidence', ['high', 'moderate', 'low']);
export const alertSeverity = pgEnum('alert_severity', ['green', 'yellow', 'red']);
export const alertStatus = pgEnum('alert_status', ['open', 'seen', 'resolved']);

export const ruleSets = pgTable(
  'rule_sets',
  {
    id: id(),
    organizationId: orgScoped(),
    version: integer('version').notNull(),
    status: ruleSetStatus('status').notNull().default('draft'),
    notes: text('notes'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by'),
    ...timestamps(),
  },
  (t) => [unique('rule_sets_org_version_uq').on(t.organizationId, t.version).nullsNotDistinct()],
);

export const rules = pgTable(
  'rules',
  {
    id: id(),
    organizationId: orgScoped(),
    ruleSetId: uuid('rule_set_id')
      .notNull()
      .references(() => ruleSets.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    domain: ruleDomain('domain').notNull(),
    description: text('description').notNull(),
    condition: jsonb('condition').notNull(),
    action: jsonb('action').notNull(),
    parameters: jsonb('parameters')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Centre values of the parameters for populations (restructure phase 17): ParamVariant[]. */
    parameterVariants: jsonb('parameter_variants')
      .notNull()
      .default(sql`'[]'::jsonb`),
    priority: integer('priority').notNull().default(100),
    evidenceClaimIds: uuid('evidence_claim_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    evidenceLevel: evidenceLevel('evidence_level').notNull().default('F'),
    limitations: text('limitations'),
    appliesToPopulations: uuid('applies_to_populations')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps(),
  },
  (t) => [unique('rules_set_key_uq').on(t.ruleSetId, t.key)],
);

/** Per-client rule disabling (§13.9). */
export const clientRuleOverrides = pgTable(
  'client_rule_overrides',
  {
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    ruleKey: text('rule_key').notNull(),
    organizationId: orgOwned(),
    enabled: boolean('enabled').notNull(),
    reason: text('reason'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.ruleKey] })],
);

export const recommendations = pgTable(
  'recommendations',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    type: recommendationType('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: recommendationStatus('status').notNull().default('proposed'),
    explanation: jsonb('explanation').notNull(),
    inputsSnapshot: jsonb('inputs_snapshot').notNull(),
    ruleSetVersion: integer('rule_set_version').notNull(),
    ruleKeys: text('rule_keys')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    confidence: recConfidence('confidence').notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    /** Plan the adjustment applies to (Phase 11 programming engine). */
    planId: uuid('plan_id'),
    /** Stable situation key: the same situation is not proposed twice while pending. */
    key: text('key'),
    /** Changes actually applied ({sessionExerciseId, field, from, to}[]), for undo. */
    applied: jsonb('applied'),
    ...timestamps(),
  },
  (t) => [
    index('recommendations_client_idx').on(t.clientId, t.status),
    index('recommendations_key_idx').on(t.clientId, t.key),
    // Plan adjustments of the organization by status (Alertas card, phase 18). No enum literal in
    // the predicate: a fresh install runs every migration in one transaction.
    index('recommendations_org_adjustments_idx')
      .on(t.organizationId, t.status)
      .where(sql`${t.key} IS NOT NULL`),
    check(
      'recommendations_decided_ck',
      sql`${t.status} = 'proposed' OR ${t.status} = 'superseded' OR ${t.status} = 'expired' OR ${t.decidedAt} IS NOT NULL`,
    ),
  ],
);

export const recommendationEvidence = pgTable(
  'recommendation_evidence',
  {
    recommendationId: uuid('recommendation_id')
      .notNull()
      .references(() => recommendations.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => knowledgeClaims.id),
    applicability: jsonb('applicability'),
  },
  (t) => [primaryKey({ columns: [t.recommendationId, t.claimId] })],
);

export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    severity: alertSeverity('severity').notNull(),
    type: text('type').notNull(),
    message: text('message').notNull(),
    data: jsonb('data'),
    ruleKey: text('rule_key'),
    /** Stable key of the situation (e.g. `pain:rodilla`): one live alert per key and client. */
    alertKey: text('alert_key'),
    ruleSetVersion: integer('rule_set_version'),
    status: alertStatus('status').notNull().default('open'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    ...timestamps(),
  },
  (t) => [
    index('alerts_org_status_idx').on(t.organizationId, t.status, t.severity),
    index('alerts_client_idx').on(t.clientId),
    uniqueIndex('alerts_live_key_uq')
      .on(t.clientId, t.alertKey)
      .where(sql`${t.status} <> 'resolved' AND ${t.alertKey} IS NOT NULL`),
  ],
);

/** Proposed vs final value when a trainer changes a recommended value (§37). */
export const manualOverrides = pgTable(
  'manual_overrides',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    field: text('field').notNull(),
    proposedValue: jsonb('proposed_value'),
    finalValue: jsonb('final_value'),
    recommendationId: uuid('recommendation_id').references(() => recommendations.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    userId: uuid('user_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('manual_overrides_entity_idx').on(t.entityType, t.entityId),
    index('manual_overrides_client_idx').on(t.clientId),
  ],
);

/**
 * One execution of the decision engine for a client (§13.2): the full result and the inputs, so
 * the same view can be shown later and audited. Recommendations reference it by id.
 */
export const decisionRuns = pgTable(
  'decision_runs',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    ruleSetVersion: integer('rule_set_version').notNull(),
    inputHash: text('input_hash').notNull(),
    context: jsonb('context').notNull(),
    result: jsonb('result').notNull(),
    createdBy: uuid('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [index('decision_runs_client_idx').on(t.clientId, t.createdAt)],
);

/** The trainer's manual judgement of a trait when no applicable reference exists (§13.10). */
export const clientTraitFlags = pgTable(
  'client_trait_flags',
  {
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    trait: text('trait').notNull(),
    value: boolean('value').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.trait] })],
);
