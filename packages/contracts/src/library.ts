import { z } from 'zod';
import { optionalText, paginationSchema } from './common';

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const BODY_REGIONS = ['lower', 'upper', 'trunk', 'full_body'] as const;
export const LATERALITY = ['bilateral', 'unilateral', 'alternating', 'asymmetric_load'] as const;
export const PLANES = ['sagittal', 'frontal', 'transverse'] as const;
export const CONTRACTIONS = [
  'concentric',
  'eccentric',
  'isometric',
  'reactive_ssc',
  'mixed',
] as const;
export const VELOCITIES = ['slow_controlled', 'moderate', 'maximal_intent', 'ballistic'] as const;
export const SPACES = ['minimal', 'small', 'large', 'track_field'] as const;
export const LOAD_LEVELS = ['none', 'low', 'moderate', 'high'] as const;
export const MUSCLE_ROLES = ['primary', 'secondary', 'stabilizer'] as const;
export const INSTRUCTION_KINDS = [
  'cue',
  'common_error',
  'precaution',
  'setup',
  'execution',
] as const;
export const SUBSTITUTION_REASONS = [
  'pain',
  'missing_equipment',
  'too_difficult',
  'space',
  'preference',
  'fatigue',
] as const;
export const PROGRESSION_RELATIONS = ['progression', 'regression', 'variant'] as const;

const nullableEnum = <T extends readonly [string, ...string[]]>(v: T) =>
  z.enum(v).nullable().optional();

export const exerciseFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  altNames: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  movementPatternId: z.uuid().nullable().optional(),
  bodyRegion: nullableEnum(BODY_REGIONS),
  laterality: nullableEnum(LATERALITY),
  planes: z.array(z.enum(PLANES)).max(3).optional(),
  contractionEmphasis: z.array(z.enum(CONTRACTIONS)).max(5).optional(),
  intendedVelocity: nullableEnum(VELOCITIES),
  level: nullableEnum(LEVELS),
  spaceRequired: nullableEnum(SPACES),
  technicalComplexity: z.coerce.number().int().min(1).max(5).nullable().optional(),
  axialLoad: nullableEnum(LOAD_LEVELS),
  impactLevel: nullableEnum(LOAD_LEVELS),
  clientDescription: optionalText(600),
  trainerDescription: optionalText(4000),
  prescriptionProfileId: z.uuid().nullable().optional(),
  supportsVbt: z.boolean().optional(),
  contactsPerRep: z.coerce.number().int().min(0).max(10).nullable().optional(),
  categoryIds: z.array(z.uuid()).max(10).optional(),
  tagIds: z.array(z.uuid()).max(20).optional(),
  muscles: z
    .array(z.object({ muscleId: z.uuid(), role: z.enum(MUSCLE_ROLES) }))
    .max(20)
    .optional(),
  equipment: z
    .array(z.object({ equipmentId: z.uuid(), optional: z.boolean().default(false) }))
    .max(15)
    .optional(),
  instructions: z
    .array(
      z.object({
        kind: z.enum(INSTRUCTION_KINDS),
        text: z.string().trim().min(1).max(500),
        audience: z.enum(['client', 'trainer', 'both']).default('both'),
      }),
    )
    .max(40)
    .optional(),
});
export const createExerciseSchema = exerciseFieldsSchema;
export const updateExerciseSchema = exerciseFieldsSchema
  .partial()
  .extend({ expectedVersion: z.coerce.number().int().min(1) });

const csv = <T extends z.ZodType>(item: T) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? (v === '' ? [] : v.split(',')) : v),
      z.array(item).max(20),
    )
    .optional();

export const listExercisesSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  patternId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  muscleGroup: z.string().max(40).optional(),
  level: z.enum(LEVELS).optional(),
  region: z.enum(BODY_REGIONS).optional(),
  laterality: z.enum(LATERALITY).optional(),
  contraction: z.enum(CONTRACTIONS).optional(),
  /** Only exercises doable with these equipment ids (all required equipment must be in the list). */
  equipmentIds: csv(z.uuid()),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  video: z.enum(['verified', 'pending', 'none']).optional(),
  scope: z.enum(['all', 'organization', 'global']).default('all'),
});

export const addVideoSchema = z.object({
  url: z.string().trim().min(5).max(300),
  title: optionalText(200),
  channel: optionalText(120),
  language: optionalText(10),
});
export const verifyMediaSchema = z.object({ status: z.enum(['verified', 'broken']) });
export const setStatusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });
export const reviewSchema = z.object({ notes: optionalText(1000) });

export const progressionSchema = z.object({
  fromExerciseId: z.uuid(),
  toExerciseId: z.uuid(),
  relation: z.enum(PROGRESSION_RELATIONS),
  axes: z
    .array(
      z.enum([
        'load',
        'reps',
        'volume',
        'effort',
        'rom',
        'complexity',
        'stability',
        'unilaterality',
        'velocity',
        'impact',
      ]),
    )
    .max(10)
    .default([]),
  notes: optionalText(500),
});

export const substitutesQuerySchema = z.object({
  reason: z.enum(SUBSTITUTION_REASONS),
  clientId: z.uuid().optional(),
  location: z.enum(['home', 'gym']).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const toleranceSchema = z
  .object({
    exerciseId: z.uuid().nullable().optional(),
    movementPatternId: z.uuid().nullable().optional(),
    kind: z.enum(['tolerated', 'not_tolerated', 'restricted']),
    reason: optionalText(500),
  })
  .refine((t) => !!t.exerciseId !== !!t.movementPatternId, {
    message: 'Indica un ejercicio o un patrón (solo uno).',
  });

/** The centre's own load increment for an exercise (phase 13); null = back to the default. */
export const exerciseLoadIncrementSchema = z.object({
  incrementKg: z.coerce
    .number('Escribe un número')
    .positive('Debe ser mayor que 0')
    .max(50, 'Como máximo 50 kg')
    .nullable(),
});
