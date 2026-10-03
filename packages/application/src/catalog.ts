import { schema } from '@tp/db';
import { asc, eq, isNull, or } from 'drizzle-orm';
import { requirePermission } from './authz';
import type { RequestContext } from './context';

const { goals, sports, equipment } = schema;

/** Global catalogue + organization-owned entries. */
export async function listCatalog(ctx: RequestContext) {
  requirePermission(ctx, 'catalog:read');
  const org = ctx.actor.organizationId;
  const [g, s, e] = await Promise.all([
    ctx.db
      .select({
        id: goals.id,
        slug: goals.slug,
        name: goals.name,
        family: goals.family,
        description: goals.description,
      })
      .from(goals)
      .where(or(isNull(goals.organizationId), eq(goals.organizationId, org)))
      .orderBy(asc(goals.sortOrder)),
    ctx.db
      .select({ id: sports.id, slug: sports.slug, name: sports.name, family: sports.family })
      .from(sports)
      .where(or(isNull(sports.organizationId), eq(sports.organizationId, org)))
      .orderBy(asc(sports.name)),
    ctx.db
      .select({
        id: equipment.id,
        slug: equipment.slug,
        name: equipment.name,
        category: equipment.category,
      })
      .from(equipment)
      .where(or(isNull(equipment.organizationId), eq(equipment.organizationId, org)))
      .orderBy(asc(equipment.category), asc(equipment.name)),
  ]);
  return { goals: g, sports: s, equipment: e };
}
