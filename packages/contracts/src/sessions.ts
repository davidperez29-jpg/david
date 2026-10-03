import { z } from 'zod';
import { isoDate, optionalText } from './common';
import { SUBSTITUTION_REASONS } from './library';
import { exerciseFeedbackSchema } from './monitoring';

/** Offline idempotency key generated on the device (§4.5). */
const mutationId = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const scale = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const num = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const publishSchema = z.object({
  scope: z.enum(['session', 'week', 'plan']),
  id: z.uuid(),
  published: z.boolean(),
});

export const agendaQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const setLogSchema = z.object({
  clientMutationId: mutationId,
  sessionId: z.uuid(),
  sessionExerciseId: z.uuid().nullable().optional(),
  exerciseId: z.uuid(),
  setIndex: scale(1, 50),
  loadKg: num(0, 1000).nullable().optional(),
  reps: scale(0, 200).nullable().optional(),
  rir: scale(0, 10).nullable().optional(),
  rpe: num(1, 10).nullable().optional(),
  durationS: scale(0, 7200).nullable().optional(),
  distanceM: num(0, 100000).nullable().optional(),
  side: z.enum(['left', 'right']).nullable().optional(),
  completed: z.boolean().default(true),
  /** When the set was done on the device (offline logs keep their real time). */
  loggedAt: z.iso.datetime({ offset: true }).optional(),
  /** When the device downloaded the session: later edits by the trainer flag the log for review. */
  downloadedAt: z.iso.datetime({ offset: true }).optional(),
});
export type SetLogInput = z.infer<typeof setLogSchema>;

export const substitutionRequestSchema = z.object({
  clientMutationId: mutationId,
  sessionExerciseId: z.uuid(),
  reason: z.enum(SUBSTITUTION_REASONS),
  chosenExerciseId: z.uuid().nullable().optional(),
  comment: optionalText(500),
});

const painSchema = z.object({
  intensity: scale(0, 10),
  bodyRegion: z.string().trim().min(1).max(60),
  context: z.enum(['during', 'after', 'next_day', 'at_rest']).default('during'),
});

export const ABSENCE_REASONS = [
  'illness',
  'injury_or_pain',
  'work',
  'travel',
  'fatigue',
  'motivation',
  'schedule',
  'other',
] as const;

export const completeSessionSchema = z.object({
  clientMutationId: mutationId.optional(),
  /** Omitted: computed from the logged sets. */
  status: z.enum(['completed', 'partial', 'missed']).optional(),
  reasonCode: z.enum(ABSENCE_REASONS).nullable().optional(),
  reasonText: optionalText(300),
  performedDate: isoDate.optional(),
  durationMin: scale(1, 600).nullable().optional(),
  /** Session RPE, CR-10 (0–10). */
  sessionRpe: num(0, 10).nullable().optional(),
  feeling: scale(0, 10).nullable().optional(),
  fatigue: scale(0, 10).nullable().optional(),
  motivation: scale(0, 10).nullable().optional(),
  comment: optionalText(1000),
  /** Health data: stored only with the client's health-data consent. */
  pain: painSchema.nullable().optional(),
});

export const readinessSchema = z.object({
  recordedOn: isoDate,
  sleepQuality: scale(0, 10).nullable().optional(),
  sleepHours: num(0, 24).nullable().optional(),
  energy: scale(0, 10).nullable().optional(),
  fatigue: scale(0, 10).nullable().optional(),
  stress: scale(0, 10).nullable().optional(),
  soreness: scale(0, 10).nullable().optional(),
  motivation: scale(0, 10).nullable().optional(),
  comment: optionalText(500),
});

/**
 * Offline queue replayed in order on reconnect. Each item is validated on its own (see
 * `syncItemSchemas`) so one invalid mutation is rejected without blocking the rest.
 */
export const syncSchema = z.object({
  mutations: z
    .array(
      z.looseObject({
        type: z.enum(['set', 'substitution', 'complete', 'exercise_feedback']),
        clientMutationId: z.string().max(100),
      }),
    )
    .min(1)
    .max(500),
});
export const syncItemSchemas = {
  set: setLogSchema,
  substitution: substitutionRequestSchema,
  complete: completeSessionSchema.extend({ clientMutationId: mutationId, sessionId: z.uuid() }),
  exercise_feedback: exerciseFeedbackSchema.extend({ clientMutationId: mutationId }),
};
export type SyncInput = z.infer<typeof syncSchema>;

export const decideSubstitutionSchema = z.object({
  approve: z.boolean(),
  chosenExerciseId: z.uuid().nullable().optional(),
  /** Also add the exercise to the pre-approved alternatives of this session exercise. */
  addAsAlternative: z.boolean().default(false),
  comment: optionalText(500),
});

export const resolveLogSchema = z.object({ note: optionalText(300) });
