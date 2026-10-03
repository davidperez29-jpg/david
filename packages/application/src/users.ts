import { revokeAllSessions } from '@tp/auth';
import { schema } from '@tp/db';
import { DomainError } from '@tp/domain';
import { and, asc, eq, isNull, sql, gt } from 'drizzle-orm';
import { rolesOf } from './actor';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';

const { users, trainers, invitations } = schema;

export async function listUsers(ctx: RequestContext) {
  requirePermission(ctx, 'users:read', { organizationId: ctx.actor.organizationId });
  const rows = await ctx.db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      totpEnabled: sql<boolean>`${users.totpEnabledAt} IS NOT NULL`,
    })
    .from(users)
    .where(eq(users.organizationId, ctx.actor.organizationId))
    .orderBy(asc(users.displayName));
  const withRoles = await Promise.all(rows.map(async (u) => ({ ...u, roles: await rolesOf(ctx.db, u.id) })));
  const pending = await ctx.db
    .select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, ctx.actor.organizationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, ctx.now()),
      ),
    );
  return { users: withRoles, pendingInvitations: pending };
}

export async function listTrainers(ctx: RequestContext) {
  requirePermission(ctx, 'clients:read');
  return ctx.db
    .select({ id: trainers.id, firstName: trainers.firstName, lastName: trainers.lastName })
    .from(trainers)
    .where(and(eq(trainers.organizationId, ctx.actor.organizationId), eq(trainers.active, true)))
    .orderBy(asc(trainers.lastName));
}

export async function setUserActive(ctx: RequestContext, userId: string, active: boolean): Promise<void> {
  requirePermission(ctx, 'users:manage', { organizationId: ctx.actor.organizationId });
  if (userId === ctx.actor.userId) throw new DomainError('conflict', 'No puedes desactivar tu propia cuenta.');
  await ctx.db.transaction(async (tx) => {
    const [u] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.actor.organizationId)));
    if (!u) throw new DomainError('not_found', 'Usuario no encontrado.');
    await tx.update(users).set({ status: active ? 'active' : 'disabled' }).where(eq(users.id, userId));
    await tx.update(trainers).set({ active }).where(eq(trainers.userId, userId));
    if (!active) await revokeAllSessions(tx, userId, ctx.now());
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'user',
      entityId: userId,
      changes: [{ field: 'status', before: u.status, after: active ? 'active' : 'disabled' }],
    });
  });
}
