import { randomToken, sha256 } from '@tp/auth';
import { schema } from '@tp/db';
import { DomainError } from '@tp/domain';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { AppContext, RequestContext } from './context';
import { secured } from './rls';

/**
 * Password links shared by hand (restructure phase 23). No email provider is configured, so «He
 * olvidado mi contraseña» cannot deliver anything: the client's trainer (or an administrator)
 * creates a one-time link and sends it the way invitations are sent (WhatsApp, their own email).
 * The person opens it, chooses a new password and is signed in (resetPassword).
 */
const { users, clients, passwordResetTokens } = schema;

/** A shared link is often opened hours later than an emailed one: 24 h, still single use. */
const SHARED_LINK_TTL_MS = 24 * 3600_000;

interface Account {
  userId: string;
  clientId: string | null;
}

/** The account of a client the actor may invite (ADMIN: any in the organization; TRAINER: assigned). */
async function clientAccount_(ctx: RequestContext, clientId: string): Promise<Account> {
  await authorizeClient(ctx, 'invitations:create', clientId);
  const [c] = await ctx.db
    .select({ userId: clients.userId })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!c?.userId)
    throw new DomainError('conflict', 'Este cliente aún no tiene cuenta. Invítale a la app.');
  return { userId: c.userId, clientId };
}

/** Any other account of the organization, for an ADMIN. */
async function userAccount_(ctx: RequestContext, userId: string): Promise<Account> {
  requirePermission(ctx, 'users:manage', { organizationId: ctx.actor.organizationId });
  if (userId === ctx.actor.userId)
    throw new DomainError('conflict', 'Para tu cuenta, usa «Cambiar contraseña» en Ajustes.');
  const [u] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, ctx.actor.organizationId)));
  if (!u) throw new DomainError('not_found', 'Usuario no encontrado.');
  const [c] = await ctx.db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.userId, userId));
  return { userId, clientId: c?.id ?? null };
}

const clientAccount = secured(clientAccount_);
const userAccount = secured(userAccount_);

/**
 * Reset tokens are system-only, like login: once the secured step has authorized the actor, the
 * link is written on the owner connection. Only the newest link of an account works.
 */
async function issueLink(
  ctx: RequestContext,
  account: Account,
): Promise<{ link: string; expiresAt: Date }> {
  const token = randomToken();
  const now = ctx.now();
  const expiresAt = new Date(now.getTime() + SHARED_LINK_TTL_MS);
  await ctx.db.transaction(async (tx) => {
    const [u] = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, account.userId));
    if (u?.status !== 'active')
      throw new DomainError('conflict', 'La cuenta está desactivada. Actívala antes.');
    await tx
      .update(passwordResetTokens)
      .set({ expiresAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, account.userId),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    await tx
      .insert(passwordResetTokens)
      .values({ userId: account.userId, tokenHash: sha256(token), expiresAt });
    await writeAudit(tx, ctx, {
      action: 'password_link_created',
      entityType: 'user',
      entityId: account.userId,
      clientId: account.clientId,
    });
  });
  return { link: `${ctx.baseUrl}/reset-password?token=${token}`, expiresAt };
}

/** A new-password link for a client's account, created by their trainer or an administrator. */
export async function createClientPasswordLink(ctx: RequestContext, clientId: string) {
  return issueLink(ctx, await clientAccount(ctx, clientId));
}

/** A new-password link for another account of the organization, created by an administrator. */
export async function createUserPasswordLink(ctx: RequestContext, userId: string) {
  return issueLink(ctx, await userAccount(ctx, userId));
}

/** The email of a link that still works, for the page that opens it; null otherwise. */
export async function describePasswordLink(
  ctx: AppContext,
  token: string,
): Promise<{ email: string } | null> {
  const [row] = await ctx.db
    .select({ email: users.email })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, ctx.now()),
        eq(users.status, 'active'),
      ),
    );
  return row ?? null;
}
