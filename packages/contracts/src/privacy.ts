import { z } from 'zod';
import { optionalText } from './common';

export const PRIVACY_REQUEST_TYPES = [
  'access',
  'portability',
  'rectification',
  'erasure',
  'restriction',
  'objection',
] as const;

export const privacyRequestSchema = z.object({
  type: z.enum(PRIVACY_REQUEST_TYPES),
  details: optionalText(2000),
});

export const resolvePrivacyRequestSchema = z.object({
  status: z.enum(['completed', 'rejected']),
  response: z.string().trim().min(3, 'Explica la respuesta al interesado.').max(2000),
});

/** Double confirmation: the ADMIN types the client's full name. */
export const eraseClientSchema = z.object({
  confirmation: z.string().trim().min(1).max(250),
  reason: z.string().trim().min(3, 'Indica el motivo (p. ej. solicitud del interesado).').max(500),
});

export const privacySettingsSchema = z.object({
  /** null = not decided by the controller (no automatic anonymization). */
  retentionMonths: z.coerce.number().int().min(1).max(240).nullable(),
  requireAdmin2fa: z.boolean(),
});

export const recoveryRegenerateSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
