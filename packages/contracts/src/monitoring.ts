import { z } from 'zod';
import { optionalText } from './common';

export const alertsQuerySchema = z.object({
  status: z.enum(['live', 'open', 'seen', 'resolved']).optional(),
  severity: z.enum(['green', 'yellow', 'red']).optional(),
  clientId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const alertStatusSchema = z.object({
  status: z.enum(['seen', 'resolved']),
  note: optionalText(500),
});

export const monitoringRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60),
        enabled: z.boolean(),
        parameters: z.record(z.string(), z.coerce.number().finite()).default({}),
      }),
    )
    .min(1)
    .max(50),
  notes: optionalText(500),
});

export const clientRuleOverrideSchema = z.object({
  ruleKey: z.string().trim().min(1).max(60),
  enabled: z.boolean(),
  reason: optionalText(300),
});

/** Per-exercise feedback from the player (pain stored only with health-data consent). */
export const exerciseFeedbackSchema = z.object({
  clientMutationId: z
    .string()
    .trim()
    .min(8)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  sessionExerciseId: z.uuid(),
  difficulty: z.coerce.number().int().min(0).max(10).nullable().optional(),
  pain: z.coerce.number().int().min(0).max(10).nullable().optional(),
  comment: optionalText(500),
});
