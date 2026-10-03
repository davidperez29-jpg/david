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
import { id, timestamps } from './_common';
import { organizations } from './iam';
import { clients } from './clients';
import { exercises, movementPatterns } from './library';
import { sessionExercises, sessions } from './planning';

/**
 * EJECUCIÓN Y SEGUIMIENTO (§6.2). What actually happened. Never overwrites the prescription.
 * Session-bound rows inherit organization_id/client_id from `sessions` via trigger.
 */
export const attendanceStatus = pgEnum('attendance_status', [
  'completed',
  'partial',
  'missed',
  'rescheduled',
  'cancelled_by_trainer',
]);
export const absenceReason = pgEnum('absence_reason', [
  'illness',
  'injury_or_pain',
  'work',
  'travel',
  'fatigue',
  'motivation',
  'schedule',
  'other',
]);
export const logSource = pgEnum('log_source', ['manual', 'device', 'import']);
export const loggedByRole = pgEnum('logged_by_role', ['client', 'trainer']);
export const painContext = pgEnum('pain_context', ['during', 'after', 'next_day', 'at_rest']);
export const substitutionReason = pgEnum('substitution_reason', [
  'pain',
  'missing_equipment',
  'too_difficult',
  'space',
  'preference',
  'fatigue',
]);
export const toleranceKind = pgEnum('tolerance_kind', ['tolerated', 'not_tolerated', 'restricted']);

const scope = () => ({
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
});

const scale010 = (name: string, col: import('drizzle-orm/pg-core').AnyPgColumn) =>
  check(name, sql`${col} IS NULL OR ${col} BETWEEN 0 AND 10`);

export const attendance = pgTable(
  'attendance',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id')
      .notNull()
      .unique()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    status: attendanceStatus('status').notNull(),
    performedDate: date('performed_date'),
    startTime: time('start_time'),
    durationMin: smallint('duration_min'),
    reasonCode: absenceReason('reason_code'),
    reasonText: text('reason_text'),
    recordedBy: uuid('recorded_by').notNull(),
    ...timestamps(),
  },
  (t) => [index('attendance_client_idx').on(t.clientId, t.performedDate)],
);

export const setLogs = pgTable(
  'set_logs',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    sessionExerciseId: uuid('session_exercise_id').references(() => sessionExercises.id, {
      onDelete: 'set null',
    }),
    exerciseIdPerformed: uuid('exercise_id_performed')
      .notNull()
      .references(() => exercises.id),
    setIndex: smallint('set_index').notNull(),
    loadKg: numeric('load_kg', { precision: 6, scale: 2 }),
    reps: smallint('reps'),
    rir: smallint('rir'),
    /** True when RIR was not reported and must not be treated as data (§18.1 #9). */
    rirAssumed: boolean('rir_assumed').notNull().default(false),
    rpe: numeric('rpe', { precision: 3, scale: 1 }),
    meanVelocityMps: numeric('mean_velocity_mps', { precision: 4, scale: 2 }),
    peakVelocityMps: numeric('peak_velocity_mps', { precision: 4, scale: 2 }),
    durationS: integer('duration_s'),
    distanceM: numeric('distance_m'),
    side: text('side'),
    bandTension: jsonb('band_tension'),
    completed: boolean('completed').notNull().default(true),
    loggedByRole: loggedByRole('logged_by_role').notNull(),
    loggedBy: uuid('logged_by').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
    /** Idempotency key for offline sync (§4.5). */
    clientMutationId: text('client_mutation_id').unique(),
    source: logSource('source').notNull().default('manual'),
  },
  (t) => [
    index('set_logs_session_idx').on(t.sessionId),
    index('set_logs_client_exercise_idx').on(t.clientId, t.exerciseIdPerformed, t.loggedAt),
    scale010('set_logs_rir_ck', t.rir),
    check('set_logs_rpe_ck', sql`${t.rpe} IS NULL OR ${t.rpe} BETWEEN 1 AND 10`),
    check('set_logs_nonneg_ck', sql`coalesce(${t.loadKg},0) >= 0 AND coalesce(${t.reps},0) >= 0`),
  ],
);

/** Session-level feedback (§22). */
export const feedback = pgTable(
  'feedback',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id')
      .notNull()
      .unique()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    feeling: smallint('feeling'),
    sessionRpe: numeric('session_rpe', { precision: 3, scale: 1 }),
    fatigue: smallint('fatigue'),
    pain: smallint('pain'),
    motivation: smallint('motivation'),
    comment: text('comment'),
    trainerNote: text('trainer_note'),
    ...timestamps(),
  },
  (t) => [
    scale010('feedback_feeling_ck', t.feeling),
    scale010('feedback_fatigue_ck', t.fatigue),
    scale010('feedback_pain_ck', t.pain),
    scale010('feedback_motivation_ck', t.motivation),
    check('feedback_srpe_ck', sql`${t.sessionRpe} IS NULL OR ${t.sessionRpe} BETWEEN 0 AND 10`),
  ],
);

export const exerciseFeedback = pgTable(
  'exercise_feedback',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    sessionExerciseId: uuid('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    difficulty: smallint('difficulty'),
    pain: smallint('pain'),
    comment: text('comment'),
    ...timestamps(),
  },
  (t) => [
    unique('exercise_feedback_uq').on(t.sessionExerciseId),
    scale010('exercise_feedback_difficulty_ck', t.difficulty),
    scale010('exercise_feedback_pain_ck', t.pain),
  ],
);

/** Daily readiness / wellness (self-reported). */
export const readiness = pgTable(
  'readiness',
  {
    id: id(),
    ...scope(),
    recordedOn: date('recorded_on').notNull(),
    sleepQuality: smallint('sleep_quality'),
    sleepHours: numeric('sleep_hours', { precision: 3, scale: 1 }),
    energy: smallint('energy'),
    fatigue: smallint('fatigue'),
    stress: smallint('stress'),
    soreness: smallint('soreness'),
    motivation: smallint('motivation'),
    comment: text('comment'),
    ...timestamps(),
  },
  (t) => [
    unique('readiness_day_uq').on(t.clientId, t.recordedOn),
    scale010('readiness_sleep_ck', t.sleepQuality),
    scale010('readiness_energy_ck', t.energy),
    scale010('readiness_fatigue_ck', t.fatigue),
    scale010('readiness_stress_ck', t.stress),
    scale010('readiness_soreness_ck', t.soreness),
    scale010('readiness_motivation_ck', t.motivation),
  ],
);

/** [SALUD] Declared pain/discomfort. Never a diagnosis. */
export const painLogs = pgTable(
  'pain_logs',
  {
    id: id(),
    ...scope(),
    occurredOn: date('occurred_on').notNull(),
    bodyRegion: text('body_region').notNull(),
    intensity: smallint('intensity').notNull(),
    context: painContext('context').notNull(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    exerciseId: uuid('exercise_id').references(() => exercises.id),
    commentEnc: text('comment_enc'),
    ...timestamps(),
  },
  (t) => [
    index('pain_logs_client_idx').on(t.clientId, t.occurredOn),
    scale010('pain_logs_intensity_ck', t.intensity),
  ],
);

export const exerciseSubstitutions = pgTable(
  'exercise_substitutions',
  {
    id: id(),
    ...scope(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
    sessionExerciseId: uuid('session_exercise_id').references(() => sessionExercises.id, {
      onDelete: 'cascade',
    }),
    originalExerciseId: uuid('original_exercise_id')
      .notNull()
      .references(() => exercises.id),
    reason: substitutionReason('reason').notNull(),
    suggestions: jsonb('suggestions'),
    chosenExerciseId: uuid('chosen_exercise_id').references(() => exercises.id),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    comment: text('comment'),
    ...timestamps(),
  },
  (t) => [index('exercise_substitutions_client_idx').on(t.clientId)],
);

/** [SALUD] What the client tolerates or not, per exercise or movement pattern. */
export const exerciseTolerances = pgTable(
  'exercise_tolerances',
  {
    id: id(),
    ...scope(),
    exerciseId: uuid('exercise_id').references(() => exercises.id),
    movementPatternId: uuid('movement_pattern_id').references(() => movementPatterns.id),
    kind: toleranceKind('kind').notNull(),
    reason: text('reason'),
    ...timestamps(),
  },
  (t) => [
    check(
      'exercise_tolerances_target_ck',
      sql`(${t.exerciseId} IS NULL) <> (${t.movementPatternId} IS NULL)`,
    ),
  ],
);
