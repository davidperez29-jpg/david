import { sql } from 'drizzle-orm';
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
  smallint,
  text,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { orgOwned, orgScoped } from './_org';
import { clients } from './clients';
import { users } from './iam';
import { pubStatus } from './library';
import { evidenceSources, populations } from './science';

/** EVALUACIÓN (§11). Tests are data; a new test needs no code (§11.1.8). */
export const testCategory = pgEnum('test_category', [
  'strength',
  'power',
  'speed',
  'cod',
  'agility',
  'endurance',
  'mobility',
  'body_composition',
  'functional',
  'balance',
  'questionnaire',
]);
export const testValueType = pgEnum('test_value_type', [
  'number',
  'time',
  'distance',
  'angle',
  'count',
  'scale',
]);
export const betterDirection = pgEnum('better_direction', ['higher', 'lower', 'target_range']);
export const aggregation = pgEnum('aggregation', ['best', 'mean', 'mean_of_best_n', 'last']);
export const statisticType = pgEnum('statistic_type', [
  'mean_sd',
  'median_iqr',
  'percentiles',
  'cutoff',
  'category_bands',
]);
export const side = pgEnum('side', ['both', 'left', 'right']);
export const resultSource = pgEnum('result_source', ['manual', 'device', 'import']);
export const assessmentStatus = pgEnum('assessment_status', [
  'planned',
  'in_progress',
  'completed',
  'cancelled',
]);

export const assessmentTests = pgTable(
  'assessment_tests',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    category: testCategory('category').notNull(),
    purpose: text('purpose'),
    targetPopulations: text('target_populations'),
    protocol: text('protocol'),
    protocolVersion: text('protocol_version').notNull().default('1'),
    equipment: text('equipment')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    unit: text('unit').notNull(),
    valueType: testValueType('value_type').notNull(),
    betterDirection: betterDirection('better_direction').notNull(),
    defaultAttempts: smallint('default_attempts').notNull().default(1),
    aggregation: aggregation('aggregation').notNull().default('best'),
    aggregationN: smallint('aggregation_n'),
    sided: boolean('sided').notNull().default(false),
    /** Ids of domain formulas producing derived metrics (e.g. 'rsi', 'e1rm_oconnor'). */
    derivedFormulas: text('derived_formulas')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    limitations: text('limitations'),
    /** The value is an estimate (e.g. 1RM from load-velocity, %fat by BIA): shown with its error. */
    isEstimate: boolean('is_estimate').notNull().default(false),
    sourceIds: uuid('source_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    status: pubStatus('status').notNull().default('draft'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    unique('assessment_tests_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
    check('assessment_tests_attempts_ck', sql`${t.defaultAttempts} BETWEEN 1 AND 20`),
  ],
);

export const testReliabilityData = pgTable(
  'test_reliability_data',
  {
    id: id(),
    organizationId: orgScoped(),
    testId: uuid('test_id')
      .notNull()
      .references(() => assessmentTests.id, { onDelete: 'cascade' }),
    populationId: uuid('population_id').references(() => populations.id),
    measurementMethod: text('measurement_method'),
    icc: numeric('icc'),
    iccModel: text('icc_model'),
    cvPercent: numeric('cv_percent'),
    sem: numeric('sem'),
    semUnit: text('sem_unit'),
    mdc95: numeric('mdc95'),
    swc: numeric('swc'),
    sourceId: uuid('source_id').references(() => evidenceSources.id),
    /** Reliability measured locally (test-retest in this centre) instead of published. */
    isLocal: boolean('is_local').notNull().default(false),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('test_reliability_test_idx').on(t.testId),
    check('test_reliability_icc_ck', sql`${t.icc} IS NULL OR (${t.icc} >= 0 AND ${t.icc} <= 1)`),
    check('test_reliability_source_ck', sql`${t.isLocal} OR ${t.sourceId} IS NOT NULL`),
  ],
);

/** Reference values: population and source are mandatory (§11.6, §33). */
export const referenceValues = pgTable(
  'reference_values',
  {
    id: id(),
    organizationId: orgScoped(),
    testId: uuid('test_id')
      .notNull()
      .references(() => assessmentTests.id, { onDelete: 'cascade' }),
    variable: text('variable').notNull(),
    unit: text('unit').notNull(),
    populationId: uuid('population_id')
      .notNull()
      .references(() => populations.id),
    ageMin: smallint('age_min'),
    ageMax: smallint('age_max'),
    sex: text('sex'),
    level: text('level'),
    sport: text('sport'),
    sampleSize: integer('sample_size'),
    statisticType: statisticType('statistic_type').notNull(),
    values: jsonb('values').notNull(),
    measurementMethod: text('measurement_method'),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => evidenceSources.id),
    applicabilityNotes: text('applicability_notes'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [index('reference_values_test_idx').on(t.testId)],
);

export const assessmentBatteries = pgTable(
  'assessment_batteries',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    goalFamily: text('goal_family'),
    description: text('description'),
    status: pubStatus('status').notNull().default('draft'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [
    unique('assessment_batteries_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
  ],
);

export const batteryTests = pgTable(
  'battery_tests',
  {
    id: id(),
    batteryId: uuid('battery_id')
      .notNull()
      .references(() => assessmentBatteries.id, { onDelete: 'cascade' }),
    testId: uuid('test_id')
      .notNull()
      .references(() => assessmentTests.id),
    position: smallint('position').notNull(),
    isCore: boolean('is_core').notNull().default(true),
    notes: text('notes'),
  },
  (t) => [unique('battery_tests_uq').on(t.batteryId, t.testId)],
);

/** An assessment event for a client. */
export const assessments = pgTable(
  'assessments',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    batteryId: uuid('battery_id').references(() => assessmentBatteries.id),
    assessedOn: date('assessed_on').notNull(),
    startTime: time('start_time'),
    assessorUserId: uuid('assessor_user_id').references(() => users.id),
    status: assessmentStatus('status').notNull().default('planned'),
    context: text('context'),
    conditions: jsonb('conditions'),
    /** Optional link to a training plan's planned (re)assessment. */
    planId: uuid('plan_id'),
    /** Tests planned for this assessment (from a battery or chosen by the trainer). */
    plannedTestIds: uuid('planned_test_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    notes: text('notes'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    index('assessments_client_idx').on(t.clientId, t.assessedOn),
    unique('assessments_id_client_uq').on(t.id, t.clientId),
  ],
);

export const assessmentResults = pgTable(
  'assessment_results',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    testId: uuid('test_id')
      .notNull()
      .references(() => assessmentTests.id),
    protocolVersion: text('protocol_version'),
    side: side('side').notNull().default('both'),
    /** Raw attempts, in test unit. */
    attempts: jsonb('attempts')
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    valueBest: numeric('value_best'),
    valueMean: numeric('value_mean'),
    /** The value used for comparisons, following the test's aggregation rule. */
    value: numeric('value'),
    cvIntraPercent: numeric('cv_intra_percent'),
    unit: text('unit').notNull(),
    measurementMethod: text('measurement_method'),
    device: text('device'),
    valid: boolean('valid').notNull().default(true),
    source: resultSource('source').notNull().default('manual'),
    notes: text('notes'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [
    index('assessment_results_assessment_idx').on(t.assessmentId, t.testId),
    index('assessment_results_client_test_idx').on(t.clientId, t.testId),
    unique('assessment_results_one_per_side_uq').on(t.assessmentId, t.testId, t.side),
  ],
);

export const derivedMetrics = pgTable(
  'derived_metrics',
  {
    id: id(),
    organizationId: orgOwned(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    resultId: uuid('result_id').references(() => assessmentResults.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id').references(() => assessments.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    formula: text('formula').notNull(),
    formulaVersion: text('formula_version').notNull().default('1'),
    value: numeric('value').notNull(),
    unit: text('unit').notNull(),
    isEstimate: boolean('is_estimate').notNull().default(false),
    errorEstimate: text('error_estimate'),
    inputs: jsonb('inputs'),
    ...timestamps(),
  },
  (t) => [
    index('derived_metrics_client_idx').on(t.clientId, t.metric),
    unique('derived_metrics_assessment_metric_uq').on(t.assessmentId, t.metric),
  ],
);
