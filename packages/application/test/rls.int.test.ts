import { bindActor, INHERIT_SCOPE, RLS_POLICIES, schema, type Executor } from '@tp/db';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { RequestContext } from '../src';
import { buildOrg, testDb } from './fixtures';

/**
 * Row Level Security, tested with raw SQL that deliberately bypasses the application layer:
 * if a use case forgot an authorization check, these are the guarantees that remain.
 */
type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
});

class Rollback extends Error {}
/** Runs `fn` bound to an actor and always rolls back. */
async function asActor<T>(
  ctx: RequestContext | null,
  fn: (tx: Executor) => Promise<T>,
): Promise<T> {
  let out: T | undefined;
  await testDb()
    .db.transaction(async (tx) => {
      if (ctx) await bindActor(tx, ctx.actor);
      else await tx.execute(sql`SELECT set_config('role', 'app_runtime', true)`);
      out = await fn(tx);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
  return out as T;
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
const pgError = (e: unknown) =>
  String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message);

describe('RLS coverage', () => {
  it('every table in public is mapped and has RLS enabled unless global read-only', async () => {
    const rows = (await testDb().db.execute(
      sql`SELECT c.relname AS name, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    )) as unknown as { name: string; rls: boolean }[];
    const unmapped = rows.filter((r) => !RLS_POLICIES[r.name]).map((r) => r.name);
    expect(unmapped).toEqual([]);
    const missing = rows
      .filter((r) => RLS_POLICIES[r.name]!.kind !== 'global_readonly' && !r.rls)
      .map((r) => r.name);
    expect(missing).toEqual([]);
    expect(rows.length).toBeGreaterThan(85);
  });

  it('an unbound runtime session sees nothing (deny by default)', async () => {
    const n = await asActor(null, async (tx) => tx.select().from(schema.clients));
    expect(n).toHaveLength(0);
  });

  it('system-only tables are not readable by the runtime role', async () => {
    await expect(
      asActor(o.admin, (tx) => tx.select().from(schema.loginAttempts)),
    ).rejects.toSatisfy((e) => /permission denied/.test(pgError(e)));
  });
});

describe('RLS isolation with raw SQL', () => {
  it('trainer only sees assigned clients and their child rows', async () => {
    const rows = await asActor(o.trainer2, (tx) =>
      tx.select({ id: schema.clients.id }).from(schema.clients),
    );
    expect(ids(rows)).toEqual([o.clientB]);
    const goals = await asActor(o.trainer2, (tx) =>
      tx
        .select()
        .from(schema.clientGoals)
        .where(sql`client_id = ${o.clientA}`),
    );
    expect(goals).toHaveLength(0);
  });

  it('client only sees themselves', async () => {
    const rows = await asActor(o.clientUser, (tx) =>
      tx.select({ id: schema.clients.id }).from(schema.clients),
    );
    expect(ids(rows)).toEqual([o.clientA]);
    const users = await asActor(o.clientUser, (tx) =>
      tx.select({ id: schema.users.id }).from(schema.users),
    );
    expect(ids(users)).toEqual([o.clientUser.actor.userId]);
  });

  it('admin never sees another organization', async () => {
    const rows = await asActor(other.admin, (tx) =>
      tx.select({ id: schema.clients.id }).from(schema.clients),
    );
    expect(ids(rows)).not.toContain(o.clientA);
    const audit = await asActor(other.admin, (tx) =>
      tx
        .select()
        .from(schema.auditLogs)
        .where(sql`client_id = ${o.clientA}`),
    );
    expect(audit).toHaveLength(0);
  });

  it('client cannot write staff-only data even with direct SQL', async () => {
    await expect(
      asActor(o.clientUser, (tx) =>
        tx.insert(schema.healthDeclarations).values({ clientId: o.clientA, type: 'injury' }),
      ),
    ).rejects.toSatisfy((e) => /row-level security/.test(pgError(e)));
    await expect(
      asActor(o.clientUser, (tx) =>
        tx.insert(schema.trainingPlans).values({
          organizationId: o.org.organizationId,
          clientId: o.clientA,
          kind: 'CLIENT_PLAN',
          name: 'x',
          durationMonths: 3,
        }),
      ),
    ).rejects.toSatisfy((e) => /row-level security/.test(pgError(e)));
  });

  it('staff cannot write into another organization', async () => {
    await expect(
      asActor(other.admin, (tx) =>
        tx
          .update(schema.clients)
          .set({ firstName: 'hacked' })
          .where(sql`id = ${o.clientA}`)
          .returning(),
      ),
    ).resolves.toHaveLength(0);
    await expect(
      asActor(other.admin, (tx) =>
        tx.insert(schema.goals).values({
          organizationId: o.org.organizationId,
          slug: 'x',
          name: 'x',
          family: 'general',
        }),
      ),
    ).rejects.toSatisfy((e) => /row-level security/.test(pgError(e)));
  });

  it('global catalogue rows are readable but not writable by organizations', async () => {
    const g = await asActor(o.trainer2, (tx) => tx.select().from(schema.goals));
    expect(g.length).toBeGreaterThanOrEqual(17);
    const changed = await asActor(o.admin, (tx) =>
      tx
        .update(schema.goals)
        .set({ name: 'x' })
        .where(sql`organization_id IS NULL`)
        .returning(),
    );
    expect(changed).toHaveLength(0);
  });

  it('audit trail: runtime role cannot update or delete, and cannot forge another actor', async () => {
    await expect(
      asActor(o.admin, (tx) => tx.execute(sql`UPDATE audit_logs SET action = 'x'`)),
    ).rejects.toSatisfy((e) => /permission denied/.test(pgError(e)));
    await expect(
      asActor(o.admin, (tx) =>
        tx.insert(schema.auditLogs).values({
          organizationId: o.org.organizationId,
          actorUserId: o.trainer2.actor.userId,
          action: 'x',
          entityType: 'y',
        }),
      ),
    ).rejects.toSatisfy((e) => /row-level security/.test(pgError(e)));
  });
});

describe('scope integrity triggers', () => {
  it('children inherit organization and client from their parent', async () => {
    const out = await asActor(o.admin, async (tx) => {
      const [plan] = await tx
        .insert(schema.trainingPlans)
        .values({
          organizationId: o.org.organizationId,
          clientId: o.clientA,
          kind: 'CLIENT_PLAN',
          name: 'P',
          durationMonths: 3,
        })
        .returning();
      // Lie about client and organization: the trigger overwrites them from the parent.
      const [phase] = await tx
        .insert(schema.phases)
        .values({
          organizationId: o.org.organizationId,
          clientId: null,
          planId: plan!.id,
          position: 1,
          name: 'F1',
          startWeek: 1,
          endWeek: 4,
        })
        .returning();
      return { plan: plan!, phase: phase! };
    });
    expect(out.phase.clientId).toBe(o.clientA);
    expect(out.phase.organizationId).toBe(o.org.organizationId);
  });

  it('a row cannot pair a client with another organization', async () => {
    await expect(
      testDb().db.insert(schema.assessments).values({
        organizationId: other.org.organizationId,
        clientId: o.clientA,
        assessedOn: '2026-10-01',
      }),
    ).rejects.toSatisfy((e) => /does not belong to organization/.test(pgError(e)));
  });

  it('templates (client_id NULL) are invisible to clients', async () => {
    await testDb().db.insert(schema.trainingPlans).values({
      organizationId: o.org.organizationId,
      clientId: null,
      kind: 'TEMPLATE',
      name: 'T',
      durationMonths: 3,
    });
    const forClient = await asActor(o.clientUser, (tx) => tx.select().from(schema.trainingPlans));
    expect(forClient.filter((p) => p.kind === 'TEMPLATE')).toHaveLength(0);
    const forTrainer = await asActor(o.trainer2, (tx) => tx.select().from(schema.trainingPlans));
    expect(forTrainer.some((p) => p.kind === 'TEMPLATE')).toBe(true);
  });

  it('every inherit-scope child is mapped to an existing parent', () => {
    for (const [, [parent]] of Object.entries(INHERIT_SCOPE))
      expect(RLS_POLICIES[parent]).toBeDefined();
  });
});

describe('catalogue seeding', () => {
  it('is idempotent', async () => {
    const { seedCatalog } = await import('@tp/db');
    const count = async () =>
      (
        (await testDb().db.execute(
          sql`SELECT (SELECT count(*) FROM movement_patterns) + (SELECT count(*) FROM prescription_variables) + (SELECT count(*) FROM goals) AS n`,
        )) as unknown as { n: string }[]
      )[0]!.n;
    const before = await count();
    await seedCatalog(testDb().db);
    expect(await count()).toBe(before);
  });
});
