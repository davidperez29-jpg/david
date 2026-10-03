import { ROLE_PERMISSIONS, type Permission, type Role, type Scope } from './permissions';

export interface Actor {
  userId: string;
  organizationId: string;
  roles: Role[];
  /** Set when the actor has the TRAINER role. */
  trainerId?: string | null;
  /** Set when the actor has the CLIENT role. */
  clientId?: string | null;
}

/** Facts about the target resource that the policy needs. Gathered by the application layer. */
export interface ResourceContext {
  organizationId: string;
  /** Client the resource belongs to (if any). */
  clientId?: string | null;
  /** True when the client is assigned to the acting trainer. */
  assignedToActor?: boolean;
}

export type Decision =
  | { allowed: true; scope: Scope }
  | { allowed: false; reason: 'no_permission' | 'other_organization' | 'out_of_scope' };

/** Broadest scope the actor holds for a permission across all its roles. */
export function scopeFor(actor: Actor, permission: Permission): Scope | null {
  const rank: Record<Scope, number> = { own: 1, assigned: 2, org: 3 };
  let best: Scope | null = null;
  for (const role of actor.roles) {
    const s = ROLE_PERMISSIONS[role][permission];
    if (s && (!best || rank[s] > rank[best])) best = s;
  }
  return best;
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return scopeFor(actor, permission) !== null;
}

/**
 * Pure authorization decision. Deny by default: every branch that is not explicitly
 * allowed returns a denial.
 */
export function authorize(
  actor: Actor,
  permission: Permission,
  resource?: ResourceContext,
): Decision {
  const scope = scopeFor(actor, permission);
  if (!scope) return { allowed: false, reason: 'no_permission' };
  if (!resource) {
    // Collection-level action (e.g. list). Callers must still filter by scope.
    return { allowed: true, scope };
  }
  if (resource.organizationId !== actor.organizationId) {
    return { allowed: false, reason: 'other_organization' };
  }
  switch (scope) {
    case 'org':
      return { allowed: true, scope };
    case 'assigned':
      if (resource.clientId == null) return { allowed: true, scope };
      return resource.assignedToActor === true
        ? { allowed: true, scope }
        : { allowed: false, reason: 'out_of_scope' };
    case 'own':
      return resource.clientId != null && actor.clientId != null && resource.clientId === actor.clientId
        ? { allowed: true, scope }
        : { allowed: false, reason: 'out_of_scope' };
  }
}
