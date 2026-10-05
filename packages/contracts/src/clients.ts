import { z } from 'zod';
import { isoDate, nonEmpty, optionalText, paginationSchema } from './common';

export const SEX = ['female', 'male', 'other', 'undisclosed'] as const;
export const CLIENT_STATUS = ['lead', 'active', 'paused', 'archived'] as const;
export const MODALITY = ['in_person', 'online', 'hybrid'] as const;
export const EXPERIENCE = ['none', 'beginner', 'intermediate', 'advanced'] as const;
export const LOCATION = ['gym', 'home', 'outdoor', 'studio', 'mixed'] as const;
export const COMPETITIVE_LEVEL = [
  'recreational',
  'amateur',
  'semi_professional',
  'professional',
  'elite',
] as const;

const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+0-9 ()-]*$/, 'Teléfono no válido')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const birthDate = isoDate
  .refine((d) => {
    const t = new Date(`${d}T00:00:00Z`).getTime();
    return t < Date.now() && t > Date.UTC(1900, 0, 1);
  }, 'Fecha de nacimiento no válida')
  .nullable()
  .optional();

const clientBasicsFields = z.object({
  firstName: nonEmpty(80),
  lastName: nonEmpty(120),
  birthDate,
  sex: z.enum(SEX),
  email: z
    .union([z.email().max(254), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  phone,
  modality: z.enum(MODALITY),
  status: z.enum(CLIENT_STATUS),
  preferences: optionalText(2000),
  /** Main programming profile (catalogue) and its level 1–3. */
  programmingProfileId: z.uuid().nullable().optional(),
  programmingLevel: z.coerce.number().int().min(1).max(3).nullable().optional(),
  /** Main sport. */
  sportId: z.uuid().nullable().optional(),
});

/** Creation: enums get defaults. */
export const clientBasicsSchema = clientBasicsFields.extend({
  sex: z.enum(SEX).default('undisclosed'),
  modality: z.enum(MODALITY).default('in_person'),
  status: z.enum(CLIENT_STATUS).default('active'),
});

export const trainingProfileSchema = z.object({
  experienceLevel: z.enum(EXPERIENCE).default('none'),
  yearsTraining: z.coerce.number().min(0).max(80).nullable().optional(),
  sessionsPerWeek: z.coerce.number().int().min(1).max(14).nullable().optional(),
  sessionDurationMin: z.coerce.number().int().min(10).max(300).nullable().optional(),
  location: z.enum(LOCATION).nullable().optional(),
  notes: optionalText(2000),
});

export const clientGoalInputSchema = z.object({
  goalId: z.uuid(),
  isPrimary: z.boolean(),
  priorityWeight: z.coerce.number().min(0).max(1),
  targetDate: isoDate.nullable().optional(),
  sportId: z.uuid().nullable().optional(),
  competitiveLevel: z.enum(COMPETITIVE_LEVEL).nullable().optional(),
  notes: optionalText(1000),
});
export const setGoalsSchema = z.object({ goals: z.array(clientGoalInputSchema).min(1).max(10) });

export const availabilitySlotSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    maxDurationMin: z.coerce.number().int().min(10).max(300).nullable().optional(),
  })
  .refine((s) => !s.startTime || !s.endTime || s.startTime < s.endTime, {
    message: 'La hora de inicio debe ser anterior a la de fin',
  });
export const setAvailabilitySchema = z.object({ slots: z.array(availabilitySlotSchema).max(21) });

export const setEquipmentSchema = z.object({
  items: z
    .array(
      z.object({ equipmentId: z.uuid(), location: z.enum(['home', 'gym', 'both']).default('gym') }),
    )
    .max(100),
});

export const createClientSchema = z.object({
  basics: clientBasicsSchema,
  profile: trainingProfileSchema.optional(),
  goals: z.array(clientGoalInputSchema).max(10).optional(),
  availability: z.array(availabilitySlotSchema).max(21).optional(),
  equipment: setEquipmentSchema.shape.items.optional(),
  /** Trainer to assign; defaults to the acting trainer. ADMIN may choose any trainer. */
  trainerId: z.uuid().optional(),
});
export type CreateClientInput = z.input<typeof createClientSchema>;

/** Update: no defaults, so only the fields actually sent are changed. */
export const updateClientSchema = clientBasicsFields.partial().extend({
  expectedVersion: z.coerce.number().int().min(1),
});

export const listClientsSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(CLIENT_STATUS).optional(),
});

export const historyEntrySchema = z.object({
  kind: z.enum(['sport', 'training']),
  periodStart: isoDate.nullable().optional(),
  periodEnd: isoDate.nullable().optional(),
  description: nonEmpty(2000),
});

export const healthDeclarationSchema = z.object({
  type: z.enum(['injury', 'surgery', 'limitation', 'other']),
  bodyRegion: optionalText(80),
  declaredOn: isoDate.optional(),
  declaredStatus: z.enum(['active', 'resolved', 'unknown']).default('unknown'),
  requiresProfessionalAssessment: z.boolean().default(false),
  description: optionalText(2000),
});
export const clearHealthDeclarationSchema = z.object({ note: nonEmpty(1000) });

export const screeningSchema = z.object({
  questionnaire: nonEmpty(80),
  questionnaireVersion: optionalText(40),
  result: z.enum(['clear', 'refer']),
  completedOn: isoDate,
});

export const consentGrantSchema = z.object({
  purpose: z.enum(['service_terms', 'health_data', 'photo', 'marketing']),
  method: z.enum(['in_app', 'paper', 'verbal_recorded']),
});

export const assignTrainerSchema = z.object({
  trainerId: z.uuid(),
  role: z.enum(['primary', 'collaborator']).default('collaborator'),
});

/** ADMIN moves clients from one trainer to another (Phase 15); all of them when `clientIds` is absent. */
export const transferClientsSchema = z
  .object({
    fromTrainerId: z.uuid(),
    toTrainerId: z.uuid(),
    clientIds: z.array(z.uuid()).min(1).max(1000).optional(),
  })
  .refine((d) => d.fromTrainerId !== d.toTrainerId, {
    message: 'Elige dos entrenadores distintos.',
    path: ['toTrainerId'],
  });
