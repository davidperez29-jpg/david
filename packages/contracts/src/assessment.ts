import { z } from 'zod';
import { optionalText } from './common';

export const TEST_CATEGORIES = [
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
] as const;
export const TEST_VALUE_TYPES = ['number', 'time', 'distance', 'angle', 'count', 'scale'] as const;
export const BETTER_DIRECTIONS = ['higher', 'lower', 'target_range'] as const;
export const AGGREGATIONS = ['best', 'mean', 'mean_of_best_n', 'last'] as const;
export const SIDES = ['both', 'left', 'right'] as const;

const isoDate = z.iso.date();
const num = z.coerce.number().finite();

// No defaults in the shared fields: `.partial()` keeps zod defaults (an update must not reset them).
const testFields = {
  name: z.string().trim().min(2).max(120),
  category: z.enum(TEST_CATEGORIES),
  purpose: optionalText(500),
  targetPopulations: optionalText(300),
  protocol: optionalText(4000),
  equipment: z.array(z.string().trim().min(1).max(60)).max(20),
  unit: z.string().trim().min(1).max(20),
  valueType: z.enum(TEST_VALUE_TYPES),
  betterDirection: z.enum(BETTER_DIRECTIONS),
  defaultAttempts: z.coerce.number().int().min(1).max(20),
  aggregation: z.enum(AGGREGATIONS),
  aggregationN: z.coerce.number().int().min(1).max(20).nullable().optional(),
  sided: z.boolean(),
  isEstimate: z.boolean(),
  limitations: optionalText(2000),
};
export const testSchema = z.object({
  ...testFields,
  equipment: testFields.equipment.default([]),
  defaultAttempts: testFields.defaultAttempts.default(1),
  aggregation: testFields.aggregation.default('best'),
  sided: testFields.sided.default(false),
  isEstimate: testFields.isEstimate.default(false),
});
export const updateTestSchema = z
  .object(testFields)
  .partial()
  .extend({ expectedVersion: z.coerce.number().int().min(1) });

/** Test-retest measured in this centre (§11.5: local reliability beats published data). */
export const localReliabilitySchema = z
  .object({
    measurementMethod: optionalText(120),
    icc: num.min(0).max(1).nullable().optional(),
    cvPercent: num.min(0).max(100).nullable().optional(),
    sem: num.min(0).nullable().optional(),
    semUnit: optionalText(20),
    mdc95: num.min(0).nullable().optional(),
    swc: num.min(0).nullable().optional(),
    notes: optionalText(1000),
  })
  .refine((v) => v.sem != null || v.cvPercent != null || v.mdc95 != null, {
    message: 'Indica al menos el SEM, el CV o el MDC95.',
    path: ['sem'],
  });

export const batterySchema = z.object({
  name: z.string().trim().min(2).max(120),
  goalFamily: optionalText(60),
  description: optionalText(1000),
  tests: z
    .array(
      z.object({ testId: z.uuid(), isCore: z.boolean().default(true), notes: optionalText(300) }),
    )
    .min(1)
    .max(40),
});

export const createAssessmentSchema = z.object({
  assessedOn: isoDate,
  batteryId: z.uuid().nullable().optional(),
  testIds: z.array(z.uuid()).max(60).default([]),
  context: optionalText(500),
  conditions: z
    .object({
      timeOfDay: optionalText(40),
      surface: optionalText(60),
      temperatureC: num.min(-30).max(55).nullable().optional(),
      priorTraining: optionalText(200),
      warmUp: optionalText(300),
    })
    .partial()
    .optional(),
  notes: optionalText(2000),
});

export const recordResultSchema = z.object({
  testId: z.uuid(),
  side: z.enum(SIDES).default('both'),
  attempts: z.array(num).min(1).max(20),
  measurementMethod: optionalText(120),
  device: optionalText(120),
  valid: z.boolean().default(true),
  notes: optionalText(1000),
});

export const assessmentStatusSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
});

export const progressQuerySchema = z.object({ testId: z.uuid().optional() });
