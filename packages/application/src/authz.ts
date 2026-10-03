import { schema, type Executor } from '@tp/db';
import { authorize, DomainError, type Permission, type ResourceContext } from '@tp/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestContext } from './context';

const { clients, trainerClientAssignments } = schema;

/** Throws `forbidden` unless the actor holds the permission for the resource. */
export function requirePermission(
  ctx: RequestContext,
  permission: Permission,
  resource?: ResourceContext,
): 'org' | 'assigned' | 'own' {
  const d = authorize(ctx.actor, permission, resource);
  if (!d.allowed) throw new DomainError('forbidden', 'No tienes permiso para esta acción.');
  return d.scope;
}

export async function isAssigned(
  db: Executor,
  trainerId: string | null | undefined,
  clientId: string,
): Promise<boolean> {
  if (!trainerId) return false;
  const rows = await db
    .select({ id: trainerClientAssignments.id })
    .from(trainerClientAssignments)
    .where(
      and(
        eq(trainerClientAssignments.trainerId, trainerId),
        eq(trainerClientAssignments.clientId, clientId),
        isNull(trainerClientAssignments.endedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Loads the facts the policy needs about a client and authorizes. A client of another
 * organization is reported as `not_found` (never confirm existence across tenants).
 */
export async function authorizeClient(
  ctx: RequestContext,
  permission: Permission,
  clientId: string,
  db: Executor = ctx.db,
): Promise<ResourceContext> {
  const [row] = await db
    .select({ organizationId: clients.organizationId })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!row || row.organizationId !== ctx.actor.organizationId) {
    throw new DomainError('not_found', 'Cliente no encontrado.');
  }
  const resource: ResourceContext = {
    organizationId: row.organizationId,
    clientId,
    assignedToActor: await isAssigned(db, ctx.actor.trainerId, clientId),
  };
  const d = authorize(ctx.actor, permission, resource);
  if (!d.allowed) {
    // Out-of-scope clients are also hidden as not_found to avoid enumeration.
    throw new DomainError('not_found', 'Cliente no encontrado.');
  }
  return resource;
}
