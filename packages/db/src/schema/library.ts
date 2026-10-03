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
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { orgScoped } from './_org';
import { methods } from './science';
import { equipment } from './catalog';

/**
 * BIBLIOTECA DE EJERCICIOS (§4.2 capa B). Exercises never embed evidence: they link to methods
 * (science layer) by id. Taxonomies are data.
 */
export const pubStatus = pgEnum('publication_status', ['draft', 'published', 'archived']);
export const bodyRegion = pgEnum('body_region', ['lower', 'upper', 'trunk', 'full_body']);
export const laterality = pgEnum('laterality', [
  'bilateral',
  'unilateral',
  'alternating',
  'asymmetric_load',
]);
export const plane = pgEnum('movement_plane', ['sagittal', 'frontal', 'transverse']);
export const contractionType = pgEnum('contraction_type', [
  'concentric',
  'eccentric',
  'isometric',
  'reactive_ssc',
  'mixed',
]);
export const intendedVelocity = pgEnum('intended_velocity', [
  'slow_controlled',
  'moderate',
  'maximal_intent',
  'ballistic',
]);
export const level = pgEnum('exercise_level', ['beginner', 'intermediate', 'advanced']);
export const spaceRequired = pgEnum('space_required', ['minimal', 'small', 'large', 'track_field']);
export const loadLevel = pgEnum('load_level', ['none', 'low', 'moderate', 'high']);
export const muscleRole = pgEnum('muscle_role', ['primary', 'secondary', 'stabilizer']);
export const mediaType = pgEnum('media_type', ['silhouette', 'image', 'video']);
export const mediaProvider = pgEnum('media_provider', ['upload', 'youtube', 'vimeo', 'url']);
export const mediaStatus = pgEnum('media_status', [
  'pending_verification',
  'verified',
  'broken',
  'replaced',
]);
export const progressionRelation = pgEnum('progression_relation', [
  'progression',
  'regression',
  'variant',
]);
export const instructionKind = pgEnum('instruction_kind', [
  'cue',
  'common_error',
  'precaution',
  'setup',
  'execution',
]);
export const variableValueType = pgEnum('variable_value_type', [
  'integer',
  'number',
  'range',
  'text',
  'enum',
  'tempo',
  'json',
]);

export const movementPatterns = pgTable(
  'movement_patterns',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    family: text('family').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [unique('movement_patterns_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const muscles = pgTable(
  'muscles',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** Grouping used for weekly set counts (e.g. quadriceps, hamstrings, pectorals). */
    groupSlug: text('group_slug').notNull(),
    region: bodyRegion('region').notNull(),
    ...timestamps(),
  },
  (t) => [unique('muscles_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

/** Hierarchical categories (category / subcategory), e.g. Pliometría > Saltos verticales. */
export const exerciseCategories = pgTable(
  'exercise_categories',
  {
    id: id(),
    organizationId: orgScoped(),
    parentId: uuid('parent_id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('exercise_categories_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
  ],
);

export const exerciseTags = pgTable(
  'exercise_tags',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    ...timestamps(),
  },
  (t) => [unique('exercise_tags_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

/** Catalogue of programming variables (§12.4). Validates `session_exercises.extra`. */
export const prescriptionVariables = pgTable(
  'prescription_variables',
  {
    id: id(),
    organizationId: orgScoped(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    unit: text('unit'),
    valueType: variableValueType('value_type').notNull(),
    minValue: text('min_value'),
    maxValue: text('max_value'),
    enumValues: text('enum_values').array(),
    description: text('description'),
    /** True for variables stored in typed columns of session_exercises; false → `extra` JSON. */
    isTypedColumn: boolean('is_typed_column').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('prescription_variables_org_key_uq').on(t.organizationId, t.key).nullsNotDistinct(),
  ],
);

/** Which variables the UI shows by default for a kind of exercise (§12.5). */
export const prescriptionProfiles = pgTable(
  'prescription_profiles',
  {
    id: id(),
    organizationId: orgScoped(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    variableKeys: text('variable_keys').array().notNull(),
    ...timestamps(),
  },
  (t) => [
    unique('prescription_profiles_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
  ],
);

export const exercises = pgTable(
  'exercises',
  {
    id: id(),
    organizationId: orgScoped(),
    derivedFromId: uuid('derived_from_id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    altNames: text('alt_names')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    movementPatternId: uuid('movement_pattern_id').references(() => movementPatterns.id),
    bodyRegion: bodyRegion('body_region'),
    laterality: laterality('laterality'),
    planes: plane('planes')
      .array()
      .notNull()
      .default(sql`'{}'`),
    contractionEmphasis: contractionType('contraction_emphasis')
      .array()
      .notNull()
      .default(sql`'{}'`),
    intendedVelocity: intendedVelocity('intended_velocity'),
    level: level('level'),
    spaceRequired: spaceRequired('space_required'),
    technicalComplexity: smallint('technical_complexity'),
    axialLoad: loadLevel('axial_load'),
    impactLevel: loadLevel('impact_level'),
    /** Short explanation for the client. */
    clientDescription: text('client_description'),
    /** Long explanation for the trainer. */
    trainerDescription: text('trainer_description'),
    prescriptionProfileId: uuid('prescription_profile_id').references(
      () => prescriptionProfiles.id,
    ),
    supportsVbt: boolean('supports_vbt').notNull().default(false),
    /** Plyometric contacts per repetition (for weekly contact counts). */
    contactsPerRep: smallint('contacts_per_rep'),
    status: pubStatus('status').notNull().default('draft'),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    unique('exercises_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
    index('exercises_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('exercises_pattern_idx').on(t.movementPatternId),
    check(
      'exercises_complexity_ck',
      sql`${t.technicalComplexity} IS NULL OR ${t.technicalComplexity} BETWEEN 1 AND 5`,
    ),
  ],
);

export const exerciseCategoryLinks = pgTable(
  'exercise_category_links',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => exerciseCategories.id),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.categoryId] })],
);

export const exerciseTagLinks = pgTable(
  'exercise_tag_links',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => exerciseTags.id),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.tagId] })],
);

export const exerciseMuscles = pgTable(
  'exercise_muscles',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    muscleId: uuid('muscle_id')
      .notNull()
      .references(() => muscles.id),
    role: muscleRole('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.muscleId] })],
);

export const exerciseEquipment = pgTable(
  'exercise_equipment',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id),
    /** Optional equipment (can be done without it). */
    optional: boolean('optional').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.equipmentId] })],
);

export const exerciseMedia = pgTable(
  'exercise_media',
  {
    id: id(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    type: mediaType('type').notNull(),
    provider: mediaProvider('provider').notNull(),
    urlOrKey: text('url_or_key').notNull(),
    title: text('title'),
    channel: text('channel'),
    language: text('language'),
    status: mediaStatus('status').notNull().default('pending_verification'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by'),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index('exercise_media_exercise_idx').on(t.exerciseId),
    check(
      'exercise_media_verified_ck',
      sql`${t.status} <> 'verified' OR ${t.verifiedAt} IS NOT NULL`,
    ),
  ],
);

/** Directed graph: from → to, with the axes that change (§30). */
export const exerciseProgressions = pgTable(
  'exercise_progressions',
  {
    id: id(),
    organizationId: orgScoped(),
    fromExerciseId: uuid('from_exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    toExerciseId: uuid('to_exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    relation: progressionRelation('relation').notNull(),
    axes: text('axes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    unique('exercise_progressions_uq').on(t.fromExerciseId, t.toExerciseId, t.relation),
    check('exercise_progressions_no_self_ck', sql`${t.fromExerciseId} <> ${t.toExerciseId}`),
  ],
);

/** Ordered cues, common errors, precautions, setup and execution steps. */
export const exerciseInstructions = pgTable(
  'exercise_instructions',
  {
    id: id(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    kind: instructionKind('kind').notNull(),
    position: smallint('position').notNull(),
    text: text('text').notNull(),
    audience: text('audience').notNull().default('both'),
  },
  (t) => [
    unique('exercise_instructions_pos_uq').on(t.exerciseId, t.kind, t.position),
    check('exercise_instructions_audience_ck', sql`${t.audience} IN ('client','trainer','both')`),
  ],
);

export const exerciseMethodLinks = pgTable(
  'exercise_method_links',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    methodId: uuid('method_id')
      .notNull()
      .references(() => methods.id),
    notes: text('notes'),
    extra: jsonb('extra'),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.methodId] })],
);
