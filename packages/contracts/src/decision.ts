import { z } from 'zod';
import { optionalText } from './common';

export const DECISION_TRAITS = ['relative_strength_low', 'cmj_low', 'sprint_slow'] as const;

/** Accept · accept with changes (per field, audited as manual overrides) · reject · postpone (§13.9). */
export const decideRecommendationSchema = z.object({
  action: z.enum(['accept', 'accept_with_changes', 'reject', 'postpone']),
  changes: z.record(z.string().max(60), z.unknown()).optional(),
  reason: optionalText(500),
});

/** The trainer's judgement of a trait when there is no applicable reference (§13.10). */
export const traitFlagSchema = z.object({
  trait: z.enum(DECISION_TRAITS),
  value: z.boolean().nullable(),
  note: optionalText(300),
});

export const decisionRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        enabled: z.boolean(),
        parameters: z.record(z.string().max(40), z.coerce.number().finite().nullable()).default({}),
      }),
    )
    .min(1)
    .max(100),
  notes: optionalText(500),
});
