/**
 * Team at scale (Phase 15, H7 "multi-entrenador avanzado"): ADMIN sees the workload of each trainer
 * and moves clients between trainers (holidays, departures, rebalancing) in one audited step.
 */
import { transferClientsSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import { DomainError } from '@tp/domain';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const s = schema;

async function trainerWorkload_(ctx: RequestContext) {
  requirePermission(ctx, 'clients:assign', { organizationId: ctx.actor.organizationId });
  const active = sql`a.trainer_id = ${s.trainers.id} AND a.ended_at IS NULL`;
  const rows = await ctx.db
    .select({
      trainerId: s.trainers.id,
      name: sql<string>`${s.trainers.firstName} || ' ' || ${s.trainers.lastName}`,
      active: s.trainers.active,
      clients: sql<number>`(SELECT count(*)::int FROM trainer_client_assignments a WHERE ${active})`,
      primary: sql<number>`(SELECT count(*)::int FROM trainer_client_assignments a WHERE ${active} AND a.role = 'primary')`,
      activePlans: sql<number>`(SELECT count(*)::int FROM training_plans p JOIN trainer_client_assignments a ON a.client_id = p.client_id WHERE ${active} AND p.status = 'active' AND p.kind = 'CLIENT_PLAN')`,
      redAlerts: sql<number>`(SELECT count(*)::int FROM alerts al JOIN trainer_client_assignments a ON a.client_id = al.client_id WHERE ${active} AND al.status <> 'resolved' AND al.severity = 'red')`,
      yellowAlerts: sql<number>`(SELECT count(*)::int FROM alerts al JOIN trainer_client_assignments a ON a.client_id = al.client_id WHERE ${active} AND al.status <> 'resolved' AND al.severity = 'yellow')`,
    })
    .from(s.trainers)
    .where(eq(s.trainers.organizationId, ctx.actor.organizationId))
    .orderBy(s.trainers.lastName, s.trainers.firstName);
  return rows;
}

async function transferClients_(ctx: RequestContext, input: unknown) {
  const d = parse(transferClientsSchema, input);
  requirePermission(ctx, 'clients:assign', { organizationId: ctx.actor.organizationId });
  const ts = await ctx.db
    .select({ id: s.trainers.id, active: s.trainers.active })
    .from(s.trainers)
    .where(
      and(
        eq(s.trainers.organizationId, ctx.actor.organizationId),
        inArray(s.trainers.id, [d.fromTrainerId, d.toTrainerId]),
      ),
    );
  if (ts.length !== 2) throw new DomainError('not_found', 'Entrenador no encontrado.');
  if (!ts.find((t) => t.id === d.toTrainerId)!.active)
    throw new DomainError('validation', 'El entrenador de destino no está activo.', {
      toTrainerId: ['inactive'],
    });
  const tca = s.trainerClientAssignments;
  return ctx.db.transaction(async (tx) => {
    const moving = await tx
      .select()
      .from(tca)
      .where(
        and(
          eq(tca.trainerId, d.fromTrainerId),
          isNull(tca.endedAt),
          d.clientIds ? inArray(tca.clientId, d.clientIds) : undefined,
        ),
      );
    if (d.clientIds && moving.length !== d.clientIds.length)
      throw new DomainError('validation', 'Algún cliente no está asignado a ese entrenador.', {
        clientIds: ['not_assigned'],
      });
    const existing = new Map(
      (
        await tx
          .select()
          .from(tca)
          .where(
            and(
              eq(tca.trainerId, d.toTrainerId),
              isNull(tca.endedAt),
              moving.length
                ? inArray(
                    tca.clientId,
                    moving.map((m) => m.clientId),
                  )
                : sql`false`,
            ),
          )
      ).map((a) => [a.clientId, a]),
    );
    let alreadyAssigned = 0;
    for (const a of moving) {
      await tx.update(tca).set({ endedAt: ctx.now() }).where(eq(tca.id, a.id));
      const there = existing.get(a.clientId);
      if (there) {
        alreadyAssigned++;
        if (a.role === 'primary' && there.role !== 'primary')
          await tx.update(tca).set({ role: 'primary' }).where(eq(tca.id, there.id));
      } else
        await tx.insert(tca).values({
          organizationId: ctx.actor.organizationId,
          trainerId: d.toTrainerId,
          clientId: a.clientId,
          role: a.role,
          createdBy: ctx.actor.userId,
        });
      await writeAudit(tx, ctx, {
        action: 'assign',
        entityType: 'trainer_client_assignment',
        entityId: a.id,
        clientId: a.clientId,
        changes: [{ field: 'trainerId', before: d.fromTrainerId, after: d.toTrainerId }],
      });
    }
    return { moved: moving.length, alreadyAssigned };
  });
}

export const trainerWorkload = secured(trainerWorkload_);
export const transferClients = secured(transferClients_);
