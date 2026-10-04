import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export const totpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
});

export const passwordResetRequestSchema = z.object({ email: z.email().max(254) });
export const passwordResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(128),
});

export const createInvitationSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('TRAINER'),
    email: z.email().max(254),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(120),
  }),
  z.object({ role: z.literal('ADMIN'), email: z.email().max(254) }),
  z.object({ role: z.literal('CLIENT'), email: z.email().max(254), clientId: z.uuid() }),
]);
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Login second factor: a 6-digit TOTP code or a one-time recovery code (XXXX-XXXX). */
export const secondFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^(\d{6}|[A-Za-z0-9]{4}[- ]?[A-Za-z0-9]{4})$/, 'Código no válido.'),
});
