import { sql, type SQL } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { orgScoped } from './_org';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Global rows (organization NULL) share one uniqueness scope. */
const orgKey = (c: AnyPgColumn): SQL =>
  sql`coalesce(${c}, '00000000-0000-0000-0000-000000000000'::uuid)`;

/**
 * BIBLIOTECA CIENTÍFICA (§4.2 capa A, §10). Sources → findings (one result, one population,
 * one outcome) → claims (our statements) → methods. Grading rationale is stored, not just a
 * letter (§10.4). Only `verified*` sources may support automatic recommendations.
 */
export const studyDesign = pgEnum('study_design', [
  'guideline',
  'position_stand',
  'consensus',
  'umbrella_review',
  'systematic_review',
  'meta_analysis',
  'rct',
  'non_randomized_trial',
  'cohort',
  'cross_sectional',
  'case_series',
  'mechanistic',
  'narrative_review',
  'expert_opinion',
  'book',
  'website',
]);
export const verificationStatus = pgEnum('verification_status', [
  'verified',
  'verified_with_corrections',
  'unverified',
  'retracted',
  'non_scientific',
  // Restructure phase 9: cited in a user's document and not verified yet / not found anywhere.
  'cited_in_document',
  'unverifiable',
]);
/** What the claim's evidence measured (restructure phase 9, SCIENCE_SYSTEM.md §3). */
export const claimEvidenceKind = pgEnum('claim_evidence_kind', [
  'incidence_reduction',
  'risk_factor_change',
  'performance',
  'mechanism',
  'practical_criterion',
  'insufficient',
]);
/** Where it comes from (§2): the trainer's documents, the literature, or practice. */
export const evidenceOrigin = pgEnum('evidence_origin', [
  'user_document',
  'external_literature',
  'practical_proposal',
]);
export const sourceAccess = pgEnum('source_access', [
  'full_text',
  'abstract_only',
  'secondary_source',
  'not_accessed',
]);
/** A–H scale of §0.2. */
export const evidenceLevel = pgEnum('evidence_level', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
export const epistemicType = pgEnum('epistemic_type', [
  'fact',
  'inference',
  'hypothesis',
  'opinion',
]);
export const confidence = pgEnum('confidence', ['high', 'moderate', 'low', 'very_low']);
export const claimStatus = pgEnum('claim_status', ['draft', 'reviewed', 'published', 'deprecated']);
export const evidenceRole = pgEnum('evidence_role', ['supports', 'contradicts', 'context']);
export const methodKind = pgEnum('method_kind', [
  'training_method',
  'contraction_type',
  'organization_method',
  'autoregulation_method',
  'conditioning_method',
]);
export const methodNoteKind = pgEnum('method_note_kind', [
  'mechanism',
  'indication',
  'precaution',
  'progression',
  'limitation',
]);
export const trainingStatus = pgEnum('training_status', [
  'untrained',
  'recreational',
  'trained',
  'highly_trained',
  'elite',
  'mixed',
  'unknown',
]);
export const sexScope = pgEnum('sex_scope', ['female', 'male', 'mixed', 'unknown']);

/** Population taxonomy used for applicability checks (§10.5). */
export const populations = pgTable(
  'populations',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    ageMin: smallint('age_min'),
    ageMax: smallint('age_max'),
    sex: sexScope('sex').notNull().default('mixed'),
    trainingStatus: trainingStatus('training_status').notNull().default('unknown'),
    sportSlug: text('sport_slug'),
    clinical: text('clinical'),
    region: text('region'),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [unique('populations_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const outcomes = pgTable(
  'outcomes',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    ...timestamps(),
  },
  (t) => [unique('outcomes_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const evidenceSources = pgTable(
  'evidence_sources',
  {
    id: id(),
    organizationId: orgScoped(),
    /** Stable key used by curated seeds (idempotent import). */
    sourceKey: text('source_key'),
    title: text('title').notNull(),
    authors: jsonb('authors')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    year: smallint('year'),
    journal: text('journal'),
    volume: text('volume'),
    issue: text('issue'),
    pages: text('pages'),
    doi: text('doi'),
    pmid: text('pmid'),
    pmcid: text('pmcid'),
    url: text('url'),
    studyDesign: studyDesign('study_design').notNull(),
    populationSummary: text('population_summary'),
    ageRange: text('age_range'),
    sex: sexScope('sex'),
    trainingStatus: trainingStatus('training_status'),
    sport: text('sport'),
    intervention: text('intervention'),
    comparison: text('comparison'),
    outcomesMeasured: text('outcomes_measured'),
    resultsSummary: text('results_summary'),
    limitations: text('limitations'),
    practicalApplication: text('practical_application'),
    verificationStatus: verificationStatus('verification_status').notNull().default('unverified'),
    origin: evidenceOrigin('origin').notNull().default('external_literature'),
    /** The user's document that cites it (anonymized name), when the origin is a document. */
    citedIn: text('cited_in'),
    access: sourceAccess('access').notNull().default('not_accessed'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by'),
    verificationMethod: text('verification_method'),
    corrections: text('corrections'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    // Unique per scope (organization or global) only when the identifier is present.
    uniqueIndex('evidence_sources_doi_uq')
      .on(orgKey(t.organizationId), t.doi)
      .where(sql`${t.doi} IS NOT NULL`),
    uniqueIndex('evidence_sources_key_uq')
      .on(orgKey(t.organizationId), t.sourceKey)
      .where(sql`${t.sourceKey} IS NOT NULL`),
    uniqueIndex('evidence_sources_pmid_uq')
      .on(orgKey(t.organizationId), t.pmid)
      .where(sql`${t.pmid} IS NOT NULL`),
    check('evidence_sources_doi_ck', sql`${t.doi} IS NULL OR ${t.doi} ~ '^10\\.[0-9]{4,9}/\\S+$'`),
    check('evidence_sources_pmid_ck', sql`${t.pmid} IS NULL OR ${t.pmid} ~ '^[0-9]{1,9}$'`),
    check(
      'evidence_sources_verified_ck',
      sql`${t.verificationStatus} NOT IN ('verified','verified_with_corrections') OR (${t.verifiedAt} IS NOT NULL AND ${t.verificationMethod} IS NOT NULL)`,
    ),
  ],
);

export const evidenceFindings = pgTable(
  'evidence_findings',
  {
    id: id(),
    organizationId: orgScoped(),
    /** Stable key used by curated seeds (idempotent import). */
    findingKey: text('finding_key'),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => evidenceSources.id, { onDelete: 'cascade' }),
    outcomeId: uuid('outcome_id')
      .notNull()
      .references(() => outcomes.id),
    populationId: uuid('population_id')
      .notNull()
      .references(() => populations.id),
    intervention: text('intervention'),
    comparator: text('comparator'),
    effectMetric: text('effect_metric'),
    effectValue: numeric('effect_value'),
    ciLow: numeric('ci_low'),
    ciHigh: numeric('ci_high'),
    nStudies: integer('n_studies'),
    nParticipants: integer('n_participants'),
    heterogeneityI2: numeric('heterogeneity_i2'),
    certaintyGrade: text('certainty_grade'),
    evidenceLevel: evidenceLevel('evidence_level').notNull().default('H'),
    gradingRationale: jsonb('grading_rationale'),
    quote: text('quote'),
    epistemicType: epistemicType('epistemic_type').notNull().default('fact'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [
    index('evidence_findings_source_idx').on(t.sourceId),
    index('evidence_findings_outcome_idx').on(t.outcomeId),
    uniqueIndex('evidence_findings_key_uq')
      .on(orgKey(t.organizationId), t.findingKey)
      .where(sql`${t.findingKey} IS NOT NULL`),
  ],
);

export const knowledgeClaims = pgTable(
  'knowledge_claims',
  {
    id: id(),
    organizationId: orgScoped(),
    key: text('key').notNull(),
    statement: text('statement').notNull(),
    scope: text('scope'),
    epistemicType: epistemicType('epistemic_type').notNull(),
    evidenceLevel: evidenceLevel('evidence_level').notNull().default('H'),
    confidence: confidence('confidence').notNull().default('very_low'),
    limitations: text('limitations'),
    applicability: jsonb('applicability'),
    evidenceKind: claimEvidenceKind('evidence_kind'),
    origin: evidenceOrigin('origin').notNull().default('external_literature'),
    status: claimStatus('status').notNull().default('draft'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [unique('knowledge_claims_org_key_uq').on(t.organizationId, t.key).nullsNotDistinct()],
);

export const claimEvidence = pgTable(
  'claim_evidence',
  {
    claimId: uuid('claim_id')
      .notNull()
      .references(() => knowledgeClaims.id, { onDelete: 'cascade' }),
    findingId: uuid('finding_id')
      .notNull()
      .references(() => evidenceFindings.id, { onDelete: 'cascade' }),
    role: evidenceRole('role').notNull().default('supports'),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.findingId] })],
);

export const methods = pgTable(
  'methods',
  {
    id: id(),
    organizationId: orgScoped(),
    parentMethodId: uuid('parent_method_id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    kind: methodKind('kind').notNull(),
    definition: text('definition'),
    summaryForTrainer: text('summary_for_trainer'),
    summaryForClient: text('summary_for_client'),
    status: claimStatus('status').notNull().default('draft'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [unique('methods_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

/** Dose ranges per method/variable/population, each justified by a claim (§10.7). */
export const methodVariables = pgTable(
  'method_variables',
  {
    id: id(),
    organizationId: orgScoped(),
    methodId: uuid('method_id')
      .notNull()
      .references(() => methods.id, { onDelete: 'cascade' }),
    variableKey: text('variable_key').notNull(),
    populationId: uuid('population_id').references(() => populations.id),
    goalId: uuid('goal_id'),
    minValue: numeric('min_value'),
    maxValue: numeric('max_value'),
    typicalValue: numeric('typical_value'),
    unit: text('unit'),
    claimId: uuid('claim_id').references(() => knowledgeClaims.id),
    isDefaultSuggestion: boolean('is_default_suggestion').notNull().default(false),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('method_variables_method_idx').on(t.methodId),
    check(
      'method_variables_range_ck',
      sql`${t.minValue} IS NULL OR ${t.maxValue} IS NULL OR ${t.minValue} <= ${t.maxValue}`,
    ),
  ],
);

export const methodEvidence = pgTable(
  'method_evidence',
  {
    methodId: uuid('method_id')
      .notNull()
      .references(() => methods.id, { onDelete: 'cascade' }),
    findingId: uuid('finding_id')
      .notNull()
      .references(() => evidenceFindings.id, { onDelete: 'cascade' }),
    role: evidenceRole('role').notNull().default('supports'),
  },
  (t) => [primaryKey({ columns: [t.methodId, t.findingId] })],
);

/** Mechanisms, indications, precautions, progression notes and limitations of a method. */
export const methodNotes = pgTable(
  'method_notes',
  {
    id: id(),
    methodId: uuid('method_id')
      .notNull()
      .references(() => methods.id, { onDelete: 'cascade' }),
    kind: methodNoteKind('kind').notNull(),
    position: smallint('position').notNull().default(0),
    text: text('text').notNull(),
    claimId: uuid('claim_id').references(() => knowledgeClaims.id),
  },
  (t) => [index('method_notes_method_idx').on(t.methodId)],
);

/** Scientific QA record (§10.6). */
export const evidenceReviews = pgTable(
  'evidence_reviews',
  {
    id: id(),
    organizationId: orgScoped(),
    sourceId: uuid('source_id').references(() => evidenceSources.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').references(() => knowledgeClaims.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id').notNull(),
    reviewedOn: date('reviewed_on').notNull(),
    checklist: jsonb('checklist').notNull(),
    outcome: text('outcome').notNull(),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    check('evidence_reviews_target_ck', sql`${t.sourceId} IS NOT NULL OR ${t.claimId} IS NOT NULL`),
    check(
      'evidence_reviews_outcome_ck',
      sql`${t.outcome} IN ('approved','changes_requested','rejected')`,
    ),
  ],
);

/**
 * Specific searches (restructure phase 9, SCIENCE_SYSTEM.md §4): what was searched, for which
 * objective, population, injury, phase, method, test or criterion, and what was selected.
 */
export const scienceSearches = pgTable(
  'science_searches',
  {
    id: id(),
    organizationId: orgScoped(),
    searchKey: text('search_key'),
    topic: text('topic').notNull(),
    objective: text('objective').notNull(),
    population: text('population'),
    injury: text('injury'),
    phase: text('phase'),
    method: text('method'),
    test: text('test'),
    criterion: text('criterion'),
    query: text('query').notNull(),
    database: text('database').notNull().default('PubMed'),
    searchedOn: date('searched_on').notNull(),
    reviewed: integer('reviewed'),
    selectedSourceIds: uuid('selected_source_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    reason: text('reason'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [
    uniqueIndex('science_searches_key_uq')
      .on(orgKey(t.organizationId), t.searchKey)
      .where(sql`${t.searchKey} IS NOT NULL`),
    index('science_searches_topic_idx').on(t.topic, t.searchedOn),
  ],
);
