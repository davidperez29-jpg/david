import {
  burnPasswordCheck,
  createSession,
  openSecret,
  encrypt,
  generateTotpSecret,
  hashPassword,
  isRateLimited,
  keyedHash,
  markSecondFactorVerified,
  randomToken,
  recordAttempt,
  revokeAllSessions,
  revokeSession,
  sha256,
  totpUri,
  validateSession,
  verifyPassword,
  verifyTotp,
} from '@tp/auth';
import {
  changePasswordSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@tp/contracts';
import { schema } from '@tp/db';
import { checkPassword, DomainError, type Actor } from '@tp/domain';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { loadActor, rolesOf } from './actor';
import { writeAudit } from './audit';
import type { AppContext, RequestContext } from './context';
import { parse } from './validation';
import { secured } from './rls';

const { users, passwordResetTokens } = schema;

const LOCK_AFTER_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const INVALID = 'Email o contraseña incorrectos.';

export interface LoginResult {
  token: string;
  expiresAt: Date;
  requiresSecondFactor: boolean;
}

function assertPasswordPolicy(password: string, email?: string): void {
  const problems = checkPassword(password, email);
  if (problems.length > 0) {
    throw new DomainError('validation', 'La contraseña no cumple la política de seguridad.', {
      password: problems,
    });
  }
}

export async function login(
  ctx: AppContext,
  input: unknown,
  meta: { userAgentHash?: string | null } = {},
): Promise<LoginResult> {
  const { email, password } = parse(loginSchema, input);
  const now = ctx.now();
  const emailHash = keyedHash(ctx.keys.hashKey, email.toLowerCase());
  const ipHash = ctx.ipHash ?? null;

  if (await isRateLimited(ctx.db, emailHash, ipHash, now)) {
    throw new DomainError('rate_limited', 'Demasiados intentos. Inténtalo de nuevo más tarde.');
  }

  const [user] = await ctx.db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`);

  const fail = async (userId?: string, organizationId?: string) => {
    await recordAttempt(ctx.db, emailHash, ipHash, false, now);
    await writeAudit(
      ctx.db,
      ctx,
      {
        action: 'login_failed',
        entityType: 'user',
        entityId: userId ?? null,
      },
      userId && organizationId ? { userId, organizationId, roles: [] } : undefined,
    );
    throw new DomainError('unauthenticated', INVALID);
  };

  if (!user || !user.passwordHash) {
    await burnPasswordCheck(password);
    return fail();
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new DomainError('rate_limited', 'Cuenta bloqueada temporalmente. Inténtalo más tarde.');
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || user.status !== 'active') {
    if (!ok) {
      const failures = user.failedLoginCount + 1;
      await ctx.db
        .update(users)
        .set({
          failedLoginCount: failures,
          lockedUntil: failures >= LOCK_AFTER_FAILURES ? new Date(now.getTime() + LOCK_MS) : null,
        })
        .where(eq(users.id, user.id));
    }
    return fail(user.id, user.organizationId);
  }

  const roles = await rolesOf(ctx.db, user.id);
  await ctx.db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, user.id));
  await recordAttempt(ctx.db, emailHash, ipHash, true, now);
  const totpEnabled = user.totpEnabledAt != null;
  const s = await createSession(ctx.db, user.id, roles, {
    secondFactorVerified: !totpEnabled,
    ipHash,
    userAgentHash: meta.userAgentHash ?? null,
    now,
  });
  await writeAudit(
    ctx.db,
    ctx,
    { action: 'login', entityType: 'user', entityId: user.id },
    { userId: user.id, organizationId: user.organizationId, roles },
  );
  return { token: s.token, expiresAt: s.expiresAt, requiresSecondFactor: totpEnabled };
}

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'second_factor_required'; sessionId: string; userId: string }
  | { status: 'authenticated'; sessionId: string; actor: Actor };

export async function resolveSession(
  ctx: AppContext,
  token: string | undefined,
): Promise<SessionState> {
  if (!token) return { status: 'anonymous' };
  const s = await validateSession(ctx.db, token, (id) => rolesOf(ctx.db, id), ctx.now());
  if (!s) return { status: 'anonymous' };
  if (!s.secondFactorVerified) {
    return { status: 'second_factor_required', sessionId: s.sessionId, userId: s.userId };
  }
  const actor = await loadActor(ctx.db, s.userId);
  if (!actor || actor.roles.length === 0) return { status: 'anonymous' };
  return { status: 'authenticated', sessionId: s.sessionId, actor };
}

export async function verifySecondFactor(
  ctx: AppContext,
  token: string,
  code: string,
): Promise<void> {
  const state = await resolveSession(ctx, token);
  if (state.status !== 'second_factor_required') {
    throw new DomainError('unauthenticated', 'Sesión no válida.');
  }
  const [u] = await ctx.db.select().from(users).where(eq(users.id, state.userId));
  if (!u?.totpSecretEnc || !u.totpEnabledAt)
    throw new DomainError('unauthenticated', 'Sesión no válida.');
  const emailHash = keyedHash(ctx.keys.hashKey, u.email.toLowerCase());
  if (await isRateLimited(ctx.db, emailHash, ctx.ipHash ?? null, ctx.now())) {
    throw new DomainError('rate_limited', 'Demasiados intentos. Inténtalo de nuevo más tarde.');
  }
  if (!verifyTotp(openSecret(ctx.keys, u.totpSecretEnc), code)) {
    await recordAttempt(ctx.db, emailHash, ctx.ipHash ?? null, false, ctx.now());
    throw new DomainError('unauthenticated', 'Código incorrecto.');
  }
  await markSecondFactorVerified(ctx.db, state.sessionId);
}

export async function logout(ctx: AppContext, token: string | undefined): Promise<void> {
  if (!token) return;
  const s = await validateSession(ctx.db, token, (id) => rolesOf(ctx.db, id), ctx.now());
  if (s) await revokeSession(ctx.db, s.sessionId, ctx.now());
}

async function beginTotpEnrollment_(ctx: RequestContext): Promise<{ secret: string; uri: string }> {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, ctx.actor.userId));
  if (!u) throw new DomainError('not_found', 'Usuario no encontrado.');
  if (u.totpEnabledAt)
    throw new DomainError('conflict', 'La verificación en dos pasos ya está activa.');
  const secret = generateTotpSecret();
  await ctx.db
    .update(users)
    .set({ totpSecretEnc: encrypt(ctx.keys.encryptionKey, secret) })
    .where(eq(users.id, u.id));
  return { secret, uri: totpUri(secret, u.email) };
}

async function confirmTotpEnrollment_(ctx: RequestContext, code: string): Promise<void> {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, ctx.actor.userId));
  if (!u?.totpSecretEnc || u.totpEnabledAt) {
    throw new DomainError('conflict', 'No hay una activación pendiente.');
  }
  if (!verifyTotp(openSecret(ctx.keys, u.totpSecretEnc), code)) {
    throw new DomainError('validation', 'Código incorrecto.', { code: ['invalid'] });
  }
  await ctx.db.transaction(async (tx) => {
    await tx.update(users).set({ totpEnabledAt: ctx.now() }).where(eq(users.id, u.id));
    await writeAudit(tx, ctx, { action: 'totp_enabled', entityType: 'user', entityId: u.id });
  });
}

async function changePassword_(
  ctx: RequestContext,
  input: unknown,
  currentSessionId: string,
): Promise<void> {
  const { currentPassword, newPassword } = parse(changePasswordSchema, input);
  const [u] = await ctx.db.select().from(users).where(eq(users.id, ctx.actor.userId));
  if (!u?.passwordHash || !(await verifyPassword(u.passwordHash, currentPassword))) {
    throw new DomainError('validation', 'La contraseña actual no es correcta.', {
      currentPassword: ['invalid'],
    });
  }
  assertPasswordPolicy(newPassword, u.email);
  const hash = await hashPassword(newPassword);
  await ctx.db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, u.id));
    // Revoke every other session (§14.1).
    await revokeAllSessions(tx, u.id, ctx.now());
    await writeAudit(tx, ctx, { action: 'password_changed', entityType: 'user', entityId: u.id });
  });
  // The current session was revoked with the rest; callers issue a fresh one.
  void currentSessionId;
}

const RESET_TTL_MS = 60 * 60_000;

/** Always succeeds from the caller's perspective (no account enumeration). */
export async function requestPasswordReset(ctx: AppContext, input: unknown): Promise<void> {
  const { email } = parse(passwordResetRequestSchema, input);
  const [u] = await ctx.db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  if (!u || u.status !== 'active') return;
  const token = randomToken();
  await ctx.db.insert(passwordResetTokens).values({
    userId: u.id,
    tokenHash: sha256(token),
    expiresAt: new Date(ctx.now().getTime() + RESET_TTL_MS),
  });
  await ctx.mailer.send({
    to: u.email,
    subject: 'Restablecer contraseña',
    text: `Para restablecer tu contraseña abre este enlace (válido 1 hora): ${ctx.baseUrl}/reset-password?token=${token}`,
  });
}

export async function resetPassword(ctx: AppContext, input: unknown): Promise<void> {
  const { token, password } = parse(passwordResetSchema, input);
  const now = ctx.now();
  const [row] = await ctx.db
    .select({ t: passwordResetTokens, u: users })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    );
  if (!row)
    throw new DomainError('validation', 'El enlace no es válido o ha caducado.', {
      token: ['invalid'],
    });
  assertPasswordPolicy(password, row.u.email);
  const hash = await hashPassword(password);
  const roles = await rolesOf(ctx.db, row.u.id);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, row.t.id));
    await tx
      .update(users)
      .set({ passwordHash: hash, failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, row.u.id));
    await revokeAllSessions(tx, row.u.id, now);
    await writeAudit(
      tx,
      ctx,
      { action: 'password_reset', entityType: 'user', entityId: row.u.id },
      { userId: row.u.id, organizationId: row.u.organizationId, roles },
    );
  });
}

export { assertPasswordPolicy };

async function getSecurityStatus_(
  ctx: RequestContext,
): Promise<{ totpEnabled: boolean; email: string }> {
  const [u] = await ctx.db
    .select({ totp: users.totpEnabledAt, email: users.email })
    .from(users)
    .where(eq(users.id, ctx.actor.userId));
  if (!u) throw new DomainError('not_found', 'Usuario no encontrado.');
  return { totpEnabled: u.totp != null, email: u.email };
}

// Use cases run under Row Level Security (see rls.ts).
export const beginTotpEnrollment = secured(beginTotpEnrollment_);
export const confirmTotpEnrollment = secured(confirmTotpEnrollment_);
export const changePassword = secured(changePassword_);
export const getSecurityStatus = secured(getSecurityStatus_);
