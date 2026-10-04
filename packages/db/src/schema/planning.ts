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
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { organizations } from './iam';
import { clients } from './clients';
import { goals } from './catalog';
import { exercises, pubStatus } from './library';
import { orgScoped } from './_org';

/**
 * PLANIFICACIÓN (§12). plan → phases → mesocycles → microcycles → sessions → blocks →
 * session_exercises → exercise_sets. Every level carries organization_id and client_id
 * (NULL for templates). They are filled/validated by the `inherit_scope` trigger from the
 * parent row (migration 0003), so children can never point to another tenant or client.
 * Prescription (planned) is never overwritten by what was performed (tracking.ts).
 */
export const planKind = pgEnum('plan_kind', ['CLIENT_PLAN', 'TEMPLATE', 'PROPOSAL']);
export const planStatus = pgEnum('plan_status', [
  'draft',
  'proposed',
  'active',
  'completed',
  'archived',
]);
export const periodizationModel = pgEnum('periodization_model', [
  'linear',
  'block',
  'undulating_daily',
  'undulating_weekly',
  'concurrent',
  'flexible',
  'custom',
]);
export const weekType = pgEnum('week_type', [
  'introduction',
  'progression',
  'peak',
  'deload',
  'test',
  'taper',
  'transition',
  'competition',
]);
export const sessionLocation = pgEnum('session_location', [
  'in_person',
  'online',
  'home',
  'gym',
  'outdoor',
]);
export const blockType = pgEnum('block_type', [
  'warm_up',
  'activation',
  'power_potentiation',
  'main_strength',
  'hypertrophy',
  'plyometric',
  'sprint_cod',
  'conditioning',
  'core',
  'mobility',
  'cool_down',
  'custom',
]);
export const blockOrganization = pgEnum('block_organization', [
  'straight_sets',
  'superset',
  'triset',
  'circuit',
  'cluster',
  'contrast',
  'complex',
  'emom',
  'amrap',
  'intervals',
]);
export const romSpec = pgEnum('rom_spec', [
  'full',
  'partial_lengthened',
  'partial_shortened',
  'specified',
]);
export const sideSpec = pgEnum('side_spec', ['both', 'left', 'right', 'each']);
export const prescriptionSource = pgEnum('prescription_source', [
  'manual',
  'template',
  'proposal',
  'progression_rule',
]);

const scope = () => ({
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
});

export const trainingPlans = pgTable(
  'training_plans',
  {
    id: id(),
    ...scope(),
    kind: planKind('kind').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    primaryGoalId: uuid('primary_goal_id').references(() => goals.id),
    secondaryGoalIds: uuid('secondary_goal_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    startDate: date('start_date'),
    durationMonths: smallint('duration_months').notNull(),
    endDate: date('end_date'),
    sessionsPerWeek: smallint('sessions_per_week'),
    periodizationModel: periodizationModel('periodization_model'),
    status: planStatus('status').notNull().default('draft'),
    currentRevision: integer('current_revision').notNull().default(1),
    basedOnTemplateId: uuid('based_on_template_id'),
    proposalOfPlanId: uuid('proposal_of_plan_id'),
    recommendationId: uuid('recommendation_id'),
    /** For PROPOSAL plans: what the programming engine adapted and why. */
    generationNotes: text('generation_notes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    publishedToClientAt: timestamp('published_to_client_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    check('training_plans_duration_ck', sql`${t.durationMonths} IN (3, 6, 9, 12)`),
    check(
      'training_plans_spw_ck',
      sql`${t.sessionsPerWeek} IS NULL OR ${t.sessionsPerWeek} BETWEEN 1 AND 7`,
    ),
    check('training_plans_kind_client_ck', sql`(${t.kind} = 'TEMPLATE') = (${t.clientId} IS NULL)`),
    check(
      'training_plans_dates_ck',
      sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`,
    ),
    index('training_plans_client_idx').on(t.clientId, t.status),
  ],
);

export const planRevisions = pgTable(
  'plan_revisions',
  {
    id: id(),
    ...scope(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => trainingPlans.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    diff: jsonb('diff'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (t) => [unique('plan_revisions_uq').on(t.planId, t.revision)],
);

export const phases = pgTable(
  'phases',
  {
    id: id(),
    ...scope(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => trainingPlans.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    objective: text('objective'),
    startWeek: smallint('start_week').notNull(),
    endWeek: smallint('end_week').notNull(),
    /** Weights per quality (descriptive), e.g. {"hypertrophy":0.6,"max_strength":0.2}. */
    emphasis: jsonb('emphasis'),
    sessionsPerWeek: smallint('sessions_per_week'),
    ...timestamps(),
  },
  (t) => [
    unique('phases_pos_uq').on(t.planId, t.position),
    check('phases_weeks_ck', sql`${t.startWeek} >= 1 AND ${t.endWeek} >= ${t.startWeek}`),
  ],
);

export const mesocycles = pgTable(
  'mesocycles',
  {
    id: id(),
    ...scope(),
    phaseId: uuid('phase_id')
      .notNull()
      .references(() => phases.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    weeks: smallint('weeks').notNull(),
    focus: text('focus'),
    assessmentPlanned: boolean('assessment_planned').notNull().default(false),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    unique('mesocycles_pos_uq').on(t.phaseId, t.position),
    check('mesocycles_weeks_ck', sql`${t.weeks} BETWEEN 1 AND 16`),
  ],
);

export const microcycles = pgTable(
  'microcycles',
  {
    id: id(),
    ...scope(),
    mesocycleId: uuid('mesocycle_id')
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    /** Week number within the plan (1-based). */
    weekIndex: smallint('week_index').notNull(),
    weekType: weekType('week_type').notNull().default('progression'),
    relativeVolume: numeric('relative_volume', { precision: 4, scale: 2 }),
    relativeIntensity: numeric('relative_intensity', { precision: 4, scale: 2 }),
    startDate: date('start_date'),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [unique('microcycles_week_uq').on(t.mesocycleId, t.weekIndex)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    ...scope(),
    microcycleId: uuid('microcycle_id')
      .notNull()
      .references(() => microcycles.id, { onDelete: 'cascade' }),
    dayLabel: text('day_label').notNull(),
    position: smallint('position').notNull().default(0),
    scheduledDate: date('scheduled_date'),
    scheduledTime: time('scheduled_time'),
    location: sessionLocation('location'),
    title: text('title'),
    objective: text('objective'),
    estimatedDurationMin: smallint('estimated_duration_min'),
    /** Planned session RPE (CR-10), compared with the client's sRPE by the monitoring rules. */
    targetSessionRpe: numeric('target_session_rpe', { precision: 3, scale: 1 }),
    notesForClient: text('notes_for_client'),
    notesForTrainer: text('notes_for_trainer'),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    index('sessions_client_date_idx').on(t.clientId, t.scheduledDate),
    index('sessions_microcycle_idx').on(t.microcycleId),
  ],
);

export const sessionBlocks = pgTable(
  'session_blocks',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    label: text('label'),
    type: blockType('type').notNull(),
    organization: blockOrganization('organization').notNull().default('straight_sets'),
    rounds: smallint('rounds'),
    restBetweenRoundsS: smallint('rest_between_rounds_s'),
    notes: text('notes'),
  },
  (t) => [unique('session_blocks_pos_uq').on(t.sessionId, t.position)],
);

/** Prescription variables (§12.4) as typed columns; uncommon ones in `extra`. */
const prescription = () => ({
  sets: smallint('sets'),
  repsMin: smallint('reps_min'),
  repsMax: smallint('reps_max'),
  repsPerCluster: smallint('reps_per_cluster'),
  intraClusterRestS: smallint('intra_cluster_rest_s'),
  durationS: integer('duration_s'),
  distanceM: numeric('distance_m'),
  contacts: smallint('contacts'),
  loadKg: numeric('load_kg', { precision: 6, scale: 2 }),
  loadPct1rm: numeric('load_pct_1rm', { precision: 5, scale: 2 }),
  rirMin: smallint('rir_min'),
  rirMax: smallint('rir_max'),
  rpeTarget: numeric('rpe_target', { precision: 3, scale: 1 }),
  effortCharacter: text('effort_character'),
  velocityTargetMps: numeric('velocity_target_mps', { precision: 4, scale: 2 }),
  velocityLossPct: smallint('velocity_loss_pct'),
  tempo: text('tempo'),
  restS: smallint('rest_s'),
  rom: romSpec('rom'),
  intensityNote: text('intensity_note'),
  bandTension: jsonb('band_tension'),
  chainLoadKg: numeric('chain_load_kg', { precision: 6, scale: 2 }),
  extra: jsonb('extra'),
});

const prescriptionChecks = (t: Record<string, unknown>, prefix: string) => {
  const c = t as Record<string, import('drizzle-orm/pg-core').AnyPgColumn>;
  return [
    check(
      `${prefix}_reps_ck`,
      sql`${c.repsMin} IS NULL OR ${c.repsMax} IS NULL OR ${c.repsMin} <= ${c.repsMax}`,
    ),
    check(
      `${prefix}_rir_ck`,
      sql`(${c.rirMin} IS NULL OR ${c.rirMin} BETWEEN 0 AND 10) AND (${c.rirMax} IS NULL OR ${c.rirMax} BETWEEN 0 AND 10) AND (${c.rirMin} IS NULL OR ${c.rirMax} IS NULL OR ${c.rirMin} <= ${c.rirMax})`,
    ),
    check(
      `${prefix}_rpe_ck`,
      sql`${c.rpeTarget} IS NULL OR (${c.rpeTarget} BETWEEN 1 AND 10 AND (${c.rpeTarget} * 2) = trunc(${c.rpeTarget} * 2))`,
    ),
    check(
      `${prefix}_vl_ck`,
      sql`${c.velocityLossPct} IS NULL OR ${c.velocityLossPct} BETWEEN 0 AND 60`,
    ),
    check(`${prefix}_pct_ck`, sql`${c.loadPct1rm} IS NULL OR ${c.loadPct1rm} BETWEEN 0 AND 110`),
    check(
      `${prefix}_tempo_ck`,
      sql`${c.tempo} IS NULL OR ${c.tempo} ~ '^[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}$'`,
    ),
    check(
      `${prefix}_nonneg_ck`,
      sql`coalesce(${c.sets},0) >= 0 AND coalesce(${c.loadKg},0) >= 0 AND coalesce(${c.restS},0) >= 0`,
    ),
  ];
};

export const sessionExercises = pgTable(
  'session_exercises',
  {
    id: id(),
    ...scope(),
    blockId: uuid('block_id')
      .notNull()
      .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: smallint('position').notNull(),
    pairingLabel: text('pairing_label'),
    methodIds: uuid('method_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /** Alternatives pre-approved by the trainer for live substitution (§9.3). */
    alternativeExerciseIds: uuid('alternative_exercise_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    ...prescription(),
    /** Which 1RM/e1RM metric %1RM refers to. */
    loadBasisMetric: text('load_basis_metric'),
    side: sideSpec('side').notNull().default('both'),
    progressionRuleId: uuid('progression_rule_id'),
    notesForClient: text('notes_for_client'),
    coachNotes: text('coach_notes'),
    source: prescriptionSource('source').notNull().default('manual'),
    recommendationId: uuid('recommendation_id'),
    /** True when values were generated by a progression rule and not edited by hand. */
    derived: boolean('derived').notNull().default(false),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    unique('session_exercises_pos_uq').on(t.blockId, t.position),
    ...prescriptionChecks(t, 'session_exercises'),
    index('session_exercises_exercise_idx').on(t.exerciseId),
  ],
);

export const exerciseSets = pgTable(
  'exercise_sets',
  {
    id: id(),
    ...scope(),
    sessionExerciseId: uuid('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    setIndex: smallint('set_index').notNull(),
    ...prescription(),
    setType: text('set_type'),
  },
  (t) => [
    unique('exercise_sets_idx_uq').on(t.sessionExerciseId, t.setIndex),
    ...prescriptionChecks(t, 'exercise_sets'),
  ],
);

/**
 * Plan templates (§12.3): compact JSON definitions (phases, mesocycles, weekly session pattern,
 * declarative progression) expanded into a client plan on demand. Global templates
 * (organization NULL) are platform data loaded from seed-data/templates; organizations save
 * their own ("Guardar como plantilla"), anonymized: no client, no absolute dates.
 */
export const planTemplates = pgTable(
  'plan_templates',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    goalSlug: text('goal_slug'),
    level: text('level'),
    sessionsPerWeek: smallint('sessions_per_week').notNull(),
    durationMonths: smallint('duration_months').notNull(),
    definition: jsonb('definition').notNull(),
    /** Global method slugs whose evidence supports the doses used (traceability, §10.1). */
    methodSlugs: text('method_slugs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: pubStatus('status').notNull().default('published'),
    derivedFromPlanId: uuid('derived_from_plan_id'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    unique('plan_templates_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
    check('plan_templates_duration_ck', sql`${t.durationMonths} IN (3, 6, 9, 12)`),
    check('plan_templates_spw_ck', sql`${t.sessionsPerWeek} BETWEEN 1 AND 7`),
  ],
);
