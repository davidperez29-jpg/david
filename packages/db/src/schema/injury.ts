import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { orgOwned, orgScoped } from './_org';
import { clients, healthDeclarations } from './clients';
import { pubStatus } from './library';

/**
 * LESIONES, READAPTACIÓN Y RETURN TO SPORT (restructure phase 7, docs/INJURY_MODULE.md).
 * Catalogue: condition → protocol (versioned) → phases → criteria. Client data: injury case,
 * phase history, symptoms, safety alerts, criterion checks and return-to-sport decisions.
 * [SALUD] Everything about a client's injury is health data: consent required, staff only, the
 * diagnosis (information received) encrypted.
 */
export const criterionRole = pgEnum('injury_criterion_role', [
  'entry',
  'success',
  'progression',
  'regression',
  'stop',
]);
export const criterionEvidence = pgEnum('injury_criterion_evidence', [
  'evidence',
  'consensus',
  'practical',
]);
export const injuryStatus = pgEnum('injury_status', ['active', 'closed']);
export const injurySide = pgEnum('injury_side', ['left', 'right', 'both', 'none']);
export const injuryAlertSeverity = pgEnum('injury_alert_severity', ['review', 'stop']);
export const rtpStage = pgEnum('rtp_stage', [
  'return_to_participation',
  'return_to_sport',
  'return_to_performance',
]);
export const rtpOutcome = pgEnum('rtp_outcome', ['authorized', 'not_yet', 'deferred']);

export const injuryConditions = pgTable(
  'injury_conditions',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    region: text('region').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: pubStatus('status').notNull().default('published'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [unique('injury_conditions_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const injuryProtocols = pgTable(
  'injury_protocols',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    conditionId: uuid('condition_id')
      .notNull()
      .references(() => injuryConditions.id),
    name: text('name').notNull(),
    /** Protocol version: an open injury keeps the version it started with. */
    protocolVersion: integer('protocol_version').notNull().default(1),
    status: pubStatus('status').notNull().default('published'),
    description: text('description'),
    /** Pain (0–10) at or over which a symptom record raises «Revisar antes de progresar». */
    painThreshold: smallint('pain_threshold').notNull().default(5),
    painThresholdBasis: text('pain_threshold_basis'),
    sourceIds: uuid('source_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    limitations: text('limitations'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    unique('injury_protocols_uq')
      .on(t.organizationId, t.slug, t.protocolVersion)
      .nullsNotDistinct(),
    check('injury_protocols_pain_ck', sql`${t.painThreshold} BETWEEN 1 AND 10`),
  ],
);

export const injuryProtocolPhases = pgTable(
  'injury_protocol_phases',
  {
    id: id(),
    protocolId: uuid('protocol_id')
      .notNull()
      .references(() => injuryProtocols.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    goals: text('goals')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    restrictions: text('restrictions'),
    exercises: text('exercises')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    dosage: text('dosage'),
    /** Tests of this phase (slugs): the readaptation comparison shows only these. */
    recommendedTests: text('recommended_tests')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [unique('injury_protocol_phases_uq').on(t.protocolId, t.position)],
);

export const injuryProtocolCriteria = pgTable(
  'injury_protocol_criteria',
  {
    id: id(),
    protocolId: uuid('protocol_id')
      .notNull()
      .references(() => injuryProtocols.id, { onDelete: 'cascade' }),
    phaseId: uuid('phase_id')
      .notNull()
      .references(() => injuryProtocolPhases.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull().default(0),
    role: criterionRole('role').notNull(),
    text: text('text').notNull(),
    mandatory: boolean('mandatory').notNull().default(true),
    /** Automatic check: a test's value or its limb symmetry index against a threshold. */
    testSlug: text('test_slug'),
    metric: text('metric'),
    operator: text('operator'),
    threshold: numeric('threshold'),
    /** Item of the return-to-play checklist it feeds (strength, running, cod…). */
    rtpItem: text('rtp_item'),
    evidence: criterionEvidence('evidence').notNull().default('practical'),
    sourceIds: uuid('source_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    limitations: text('limitations'),
  },
  (t) => [
    index('injury_protocol_criteria_phase_idx').on(t.phaseId),
    check(
      'injury_protocol_criteria_auto_ck',
      sql`${t.testSlug} IS NULL OR (${t.metric} IN ('value', 'lsi') AND ${t.operator} IN ('>=', '<=') AND ${t.threshold} IS NOT NULL)`,
    ),
  ],
);

/** [SALUD] An injury case of a client. */
export const injuries = pgTable(
  'injuries',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    conditionId: uuid('condition_id')
      .notNull()
      .references(() => injuryConditions.id),
    protocolId: uuid('protocol_id').references(() => injuryProtocols.id),
    side: injurySide('side').notNull().default('none'),
    occurredOn: date('occurred_on').notNull(),
    mechanism: text('mechanism'),
    /** Diagnosis / information received from the health professional, AES-256-GCM encrypted. */
    diagnosisEnc: text('diagnosis_enc'),
    professional: text('professional'),
    clinicalClearanceOn: date('clinical_clearance_on'),
    currentPhaseId: uuid('current_phase_id').references(() => injuryProtocolPhases.id),
    phaseStartedOn: date('phase_started_on'),
    status: injuryStatus('status').notNull().default('active'),
    restrictions: text('restrictions'),
    notes: text('notes'),
    decisionRequestedAt: timestamp('decision_requested_at', { withTimezone: true }),
    healthDeclarationId: uuid('health_declaration_id').references(() => healthDeclarations.id, {
      onDelete: 'set null',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [index('injuries_client_idx').on(t.clientId, t.status)],
);

const injuryChild = () => ({
  id: id(),
  organizationId: orgOwned(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  injuryId: uuid('injury_id')
    .notNull()
    .references(() => injuries.id, { onDelete: 'cascade' }),
});

export const injuryPhaseHistory = pgTable(
  'injury_phase_history',
  {
    ...injuryChild(),
    phaseId: uuid('phase_id')
      .notNull()
      .references(() => injuryProtocolPhases.id),
    startedOn: date('started_on').notNull(),
    endedOn: date('ended_on'),
    advancedBy: uuid('advanced_by'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('injury_phase_history_injury_idx').on(t.injuryId)],
);

/** [SALUD] Symptoms recorded by the staff for the case (the client's session pain stays in pain_logs). */
export const injurySymptoms = pgTable(
  'injury_symptoms',
  {
    ...injuryChild(),
    recordedOn: date('recorded_on').notNull(),
    pain: smallint('pain').notNull(),
    worseThanBefore: boolean('worse_than_before').notNull().default(false),
    persistsNextDay: boolean('persists_next_day').notNull().default(false),
    functionLoss: boolean('function_loss').notNull().default(false),
    neurological: boolean('neurological').notNull().default(false),
    swelling: boolean('swelling').notNull().default(false),
    instability: boolean('instability').notNull().default(false),
    adverseReaction: boolean('adverse_reaction').notNull().default(false),
    noteEnc: text('note_enc'),
    recordedBy: uuid('recorded_by'),
    ...timestamps(),
  },
  (t) => [
    index('injury_symptoms_injury_idx').on(t.injuryId, t.recordedOn),
    check('injury_symptoms_pain_ck', sql`${t.pain} BETWEEN 0 AND 10`),
  ],
);

export const injuryAlerts = pgTable(
  'injury_alerts',
  {
    ...injuryChild(),
    symptomId: uuid('symptom_id').references(() => injurySymptoms.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    severity: injuryAlertSeverity('severity').notNull(),
    message: text('message').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('injury_alerts_injury_idx').on(t.injuryId, t.reviewedAt)],
);

export const injuryCriterionChecks = pgTable(
  'injury_criterion_checks',
  {
    ...injuryChild(),
    criterionId: uuid('criterion_id')
      .notNull()
      .references(() => injuryProtocolCriteria.id),
    met: boolean('met').notNull(),
    value: numeric('value'),
    /** auto (from an assessment) or manual (qualitative, by the trainer). */
    source: text('source').notNull(),
    assessmentId: uuid('assessment_id'),
    checkedBy: uuid('checked_by'),
    note: text('note'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('injury_criterion_checks_idx').on(t.injuryId, t.criterionId, t.checkedAt),
    check('injury_criterion_checks_source_ck', sql`${t.source} IN ('auto', 'manual')`),
  ],
);

/** The human decision on return to participation / sport / performance (never computed). */
export const rtpDecisions = pgTable(
  'rtp_decisions',
  {
    ...injuryChild(),
    stage: rtpStage('stage').notNull(),
    outcome: rtpOutcome('outcome').notNull(),
    decidedByName: text('decided_by_name').notNull(),
    decidedByRole: text('decided_by_role').notNull(),
    decidedOn: date('decided_on').notNull(),
    rationale: text('rationale'),
    recordedBy: uuid('recorded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rtp_decisions_injury_idx').on(t.injuryId)],
);
