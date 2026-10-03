import { schema, type Executor } from '@tp/db';
import type { Actor, Role } from '@tp/domain';
import { eq } from 'drizzle-orm';

const { userRoles, roles, users, trainers, clients } = schema;

export async function rolesOf(db: Executor, userId: string): Promise<Role[]> {
  const rows = await db
    .select({ key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.key);
}

export async function loadActor(db: Executor, userId: string): Promise<Actor | null> {
  const [u] = await db
    .select({ id: users.id, organizationId: users.organizationId, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  if (!u || u.status !== 'active') return null;
  const r = await rolesOf(db, userId);
  const [t] = await db
    .select({ id: trainers.id, active: trainers.active })
    .from(trainers)
    .where(eq(trainers.userId, userId));
  const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
  return {
    userId: u.id,
    organizationId: u.organizationId,
    roles: r,
    trainerId: t?.active ? t.id : null,
    clientId: c?.id ?? null,
  };
}
