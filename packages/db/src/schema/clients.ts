import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps, version } from './_common';
import { organizations, users } from './iam';
import { equipment, goals, sports } from './catalog';

export const sex = pgEnum('sex', ['female', 'male', 'other', 'undisclosed']);
export const clientStatus = pgEnum('client_status', ['lead', 'active', 'paused', 'archived']);
export const modality = pgEnum('modality', ['in_person', 'online', 'hybrid']);
export const experienceLevel = pgEnum('experience_level', [
  'none',
  'beginner',
  'intermediate',
  'advanced',
]);
export const trainingLocation = pgEnum('training_location', [
  'gym',
  'home',
  'outdoor',
  'studio',
  'mixed',
]);
export const competitiveLevel = pgEnum('competitive_level', [
  'recreational',
  'amateur',
  'semi_professional',
  'professional',
  'elite',
]);
export const goalStatus = pgEnum('client_goal_status', ['active', 'achieved', 'dropped']);
export const assignmentRole = pgEnum('assignment_role', ['primary', 'collaborator']);
export const equipmentLocation = pgEnum('equipment_location', ['home', 'gym', 'both']);
export const historyKind = pgEnum('history_kind', ['sport', 'training']);
export const healthDeclarationType = pgEnum('health_declaration_type', [
  'injury',
  'surgery',
  'limitation',
  'other',
]);
export const declaredStatus = pgEnum('declared_status', ['active', 'resolved', 'unknown']);
export const consentPurpose = pgEnum('consent_purpose', [
  'service_terms',
  'health_data',
  'photo',
  'marketing',
]);
export const consentMethod = pgEnum('consent_method', ['in_app', 'paper', 'verbal_recorded']);
export const screeningResult = pgEnum('screening_result', ['clear', 'refer']);

export const trainers = pgTable('trainers', {
  id: id(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps(),
});

export const clients = pgTable(
  'clients',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    /** NULL = client without an account (in-person only). */
    userId: uuid('user_id')
      .unique()
      .references(() => users.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthDate: date('birth_date'),
    sex: sex('sex').notNull().default('undisclosed'),
    email: text('email'),
    /** AES-256-GCM encrypted (§6.4). */
    phoneEnc: text('phone_enc'),
    photoFileId: uuid('photo_file_id'),
    joinedAt: date('joined_at')
      .notNull()
      .default(sql`CURRENT_DATE`),
    status: clientStatus('status').notNull().default('active'),
    modality: modality('modality').notNull().default('in_person'),
    preferences: text('preferences'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
    version: version(),
  },
  (t) => [
    index('clients_org_status_idx').on(t.organizationId, t.status),
    index('clients_org_name_idx').on(t.organizationId, t.lastName, t.firstName),
  ],
);

export const trainerClientAssignments = pgTable(
  'trainer_client_assignments',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    role: assignmentRole('role').notNull().default('primary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
  },
  (t) => [
    uniqueIndex('tca_active_uq')
      .on(t.trainerId, t.clientId)
      .where(sql`${t.endedAt} IS NULL`),
    index('tca_client_idx').on(t.clientId),
  ],
);

export const clientTrainingProfiles = pgTable('client_training_profiles', {
  clientId: uuid('client_id')
    .primaryKey()
    .references(() => clients.id, { onDelete: 'cascade' }),
  experienceLevel: experienceLevel('experience_level').notNull().default('none'),
  yearsTraining: numeric('years_training', { precision: 4, scale: 1 }),
  sessionsPerWeek: smallint('sessions_per_week'),
  sessionDurationMin: smallint('session_duration_min'),
  location: trainingLocation('location'),
  notes: text('notes'),
  ...timestamps(),
  ...authorship(),
  version: version(),
});

export const clientAvailability = pgTable(
  'client_availability',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    /** ISO weekday 1 = Monday … 7 = Sunday. */
    weekday: smallint('weekday').notNull(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    maxDurationMin: smallint('max_duration_min'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('client_availability_client_idx').on(t.clientId)],
);

export const clientEquipment = pgTable(
  'client_equipment',
  {
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id),
    location: equipmentLocation('location').notNull().default('gym'),
  },
  (t) => [uniqueIndex('client_equipment_uq').on(t.clientId, t.equipmentId)],
);

export const clientGoals = pgTable(
  'client_goals',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id),
    isPrimary: boolean('is_primary').notNull().default(false),
    priorityWeight: numeric('priority_weight', { precision: 3, scale: 2 }).notNull(),
    targetDate: date('target_date'),
    sportId: uuid('sport_id').references(() => sports.id),
    competitiveLevel: competitiveLevel('competitive_level'),
    notes: text('notes'),
    status: goalStatus('status').notNull().default('active'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [
    uniqueIndex('client_goals_one_primary_uq')
      .on(t.clientId)
      .where(sql`${t.isPrimary} AND ${t.status} = 'active'`),
    index('client_goals_client_idx').on(t.clientId),
  ],
);

export const clientHistoryEntries = pgTable('client_history_entries', {
  id: id(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  kind: historyKind('kind').notNull(),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  description: text('description').notNull(),
  ...timestamps(),
  ...authorship(),
});

/** [SALUD] Declared health information — never a diagnosis (§6.1.7, §14.5). */
export const healthDeclarations = pgTable(
  'health_declarations',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    type: healthDeclarationType('type').notNull(),
    bodyRegion: text('body_region'),
    declaredOn: date('declared_on')
      .notNull()
      .default(sql`CURRENT_DATE`),
    declaredStatus: declaredStatus('declared_status').notNull().default('unknown'),
    requiresProfessionalAssessment: boolean('requires_professional_assessment')
      .notNull()
      .default(false),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    clearedBy: uuid('cleared_by'),
    clearanceNote: text('clearance_note'),
    /** Free text, AES-256-GCM encrypted. */
    descriptionEnc: text('description_enc'),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [index('health_declarations_client_idx').on(t.clientId)],
);

/**
 * [SALUD] Result of a pre-participation screening done with an external questionnaire
 * (e.g. PAR-Q+). Questions are not reproduced in-app until a verified, licensed version is
 * loaded as data; only questionnaire identity, version and outcome are stored.
 */
export const screeningResponses = pgTable('screening_responses', {
  id: id(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  questionnaire: text('questionnaire').notNull(),
  questionnaireVersion: text('questionnaire_version'),
  result: screeningResult('result').notNull(),
  answers: jsonb('answers'),
  completedOn: date('completed_on').notNull(),
  ...timestamps(),
  ...authorship(),
});

export const consents = pgTable(
  'consents',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    purpose: consentPurpose('purpose').notNull(),
    textVersion: text('text_version').notNull(),
    method: consentMethod('method').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    recordedBy: uuid('recorded_by').notNull(),
  },
  (t) => [index('consents_client_idx').on(t.clientId, t.purpose)],
);
