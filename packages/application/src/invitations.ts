import { createSession, hashPassword, randomToken, revokeAllSessions, sha256 } from '@tp/auth';
import { acceptInvitationSchema, createInvitationSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import { DomainError, type Role } from '@tp/domain';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import { assertPasswordPolicy, type LoginResult } from './auth-service';
import type { AppContext, RequestContext } from './context';
import { parse } from './validation';

const { invitations, users, userRoles, roles, trainers, clients } = schema;

const INVITATION_TTL_MS = 7 * 24 * 3600_000;

export async function createInvitation(
  ctx: RequestContext,
  input: unknown,
): Promise<{ invitationId: string; link: string; expiresAt: Date }> {
  const data = parse(createInvitationSchema, input);
  if (data.role === 'CLIENT') {
    await authorizeClient(ctx, 'invitations:create', data.clientId);
    const [c] = await ctx.db.select().from(clients).where(eq(clients.id, data.clientId));
    if (c?.userId) throw new DomainError('conflict', 'Este cliente ya tiene una cuenta.');
  } else {
    // Staff invitations are an ADMIN capability.
    requirePermission(ctx, 'users:manage', { organizationId: ctx.actor.organizationId });
  }
  const existing = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${data.email.toLowerCase()}`);
  if (existing.length > 0) throw new DomainError('conflict', 'Ya existe un usuario con ese email.');

  const token = randomToken();
  const expiresAt = new Date(ctx.now().getTime() + INVITATION_TTL_MS);
  const payload =
    data.role === 'TRAINER' ? { firstName: data.firstName, lastName: data.lastName } : null;
  const id = await ctx.db.transaction(async (tx) => {
    // Any previous pending invitation for the same email is superseded.
    await tx
      .update(invitations)
      .set({ revokedAt: ctx.now() })
      .where(
        and(
          eq(invitations.organizationId, ctx.actor.organizationId),
          sql`lower(${invitations.email}) = ${data.email.toLowerCase()}`,
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );
    const [row] = await tx
      .insert(invitations)
      .values({
        organizationId: ctx.actor.organizationId,
        email: data.email,
        role: data.role,
        clientId: data.role === 'CLIENT' ? data.clientId : null,
        payload,
        tokenHash: sha256(token),
        expiresAt,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: invitations.id });
    await writeAudit(tx, ctx, {
      action: 'invite',
      entityType: 'invitation',
      entityId: row!.id,
      clientId: data.role === 'CLIENT' ? data.clientId : null,
      changes: { role: data.role },
    });
    return row!.id;
  });
  const link = `${ctx.baseUrl}/invite?token=${token}`;
  await ctx.mailer.send({
    to: data.email,
    subject: 'Invitación a la plataforma de entrenamiento',
    text: `Has sido invitado/a. Crea tu contraseña aquí (válido 7 días): ${link}`,
  });
  return { invitationId: id, link, expiresAt };
}

export async function describeInvitation(
  ctx: AppContext,
  token: string,
): Promise<{ email: string; role: Role } | null> {
  const [inv] = await ctx.db
    .select({ email: invitations.email, role: invitations.role })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, sha256(token)),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, ctx.now()),
      ),
    );
  return inv ?? null;
}

export async function acceptInvitation(ctx: AppContext, input: unknown): Promise<LoginResult> {
  const data = parse(acceptInvitationSchema, input);
  const now = ctx.now();
  const [inv] = await ctx.db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, sha256(data.token)),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      ),
    );
  if (!inv) throw new DomainError('validation', 'La invitación no es válida o ha caducado.', { token: ['invalid'] });
  assertPasswordPolicy(data.password, inv.email);
  const passwordHash = await hashPassword(data.password);

  return ctx.db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        organizationId: inv.organizationId,
        email: inv.email,
        passwordHash,
        displayName: data.displayName,
      })
      .returning();
    const [role] = await tx.select().from(roles).where(eq(roles.key, inv.role));
    await tx.insert(userRoles).values({ userId: user!.id, roleId: role!.id, organizationId: inv.organizationId });
    if (inv.role === 'TRAINER') {
      const p = (inv.payload ?? {}) as { firstName?: string; lastName?: string };
      await tx.insert(trainers).values({
        organizationId: inv.organizationId,
        userId: user!.id,
        firstName: p.firstName ?? data.displayName,
        lastName: p.lastName ?? '',
      });
    }
    if (inv.role === 'CLIENT') {
      const linked = await tx
        .update(clients)
        .set({ userId: user!.id })
        .where(and(eq(clients.id, inv.clientId!), isNull(clients.userId)))
        .returning({ id: clients.id });
      if (linked.length === 0) throw new DomainError('conflict', 'Este cliente ya tiene una cuenta.');
    }
    await tx.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, inv.id));
    await revokeAllSessions(tx, user!.id, now);
    const s = await createSession(tx, user!.id, [inv.role], {
      secondFactorVerified: true,
      ipHash: ctx.ipHash ?? null,
      now,
    });
    await writeAudit(
      tx,
      ctx,
      {
        action: 'invitation_accepted',
        entityType: 'invitation',
        entityId: inv.id,
        clientId: inv.clientId,
      },
      { userId: user!.id, organizationId: inv.organizationId, roles: [inv.role] },
    );
    return { token: s.token, expiresAt: s.expiresAt, requiresSecondFactor: false };
  });
}
