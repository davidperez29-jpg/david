import { bindActor, schema } from '@tp/db';
import { addDays, localDate } from '@tp/domain';
import { eq, inArray, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  autoCloseSessions,
  completeSession,
  createPlanFromTemplate,
  getPlan,
  getPlayerSession,
  grantConsent,
  listPlanTemplates,
  logSet,
  publishSessions,
  saveExerciseFeedback,
  setPlanStatus,
  type PlanDetail,
  type RequestContext,
} from '../src';
import { buildOrg, testDb } from './fixtures';

/** Restructure phase 8: fichaje automático, «¿Cómo fue?», molestias and RLS «solo publicadas». */
type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let ids: string[];
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
const mid = () => `m_${Math.random().toString(36).slice(2, 12)}`;
const today = localDate(new Date());
const { sessions, attendance, exerciseFeedback, feedback } = schema;

class Rollback extends Error {}
async function rawAs<T>(
  ctx: RequestContext,
  fn: (tx: typeof testDb extends () => { db: infer D } ? D : never) => Promise<T>,
) {
  let out: T | undefined;
  await testDb()
    .db.transaction(async (tx) => {
      await bindActor(tx, ctx.actor);
      out = await fn(tx as never);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
  return out as T;
}

beforeAll(async () => {
  o = await buildOrg();
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  const r = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: addDays(today, -14),
    weekdays: [1, 3, 5],
  });
  await setPlanStatus(o.admin, r.id, { status: 'active' });
  const p = await getPlan(o.admin, r.id);
  const weeks = weeksOf(p);
  // Publish the first two weeks only; week 3 stays unpublished.
  for (const w of weeks.slice(0, 2))
    await publishSessions(o.admin, { scope: 'week', id: w.id, published: true });
  ids = weeks.flatMap((w) => w.sessions.map((s) => s.id));
});

describe('RLS «solo publicadas» (phase 8)', () => {
  it('the client cannot read an unpublished session, its blocks or exercises, even with raw SQL', async () => {
    const rows = await testDb()
      .db.select({ id: sessions.id, published: sessions.published })
      .from(sessions)
      .where(inArray(sessions.id, ids));
    const unpublished = rows.filter((r) => !r.published).map((r) => r.id);
    const published = rows.filter((r) => r.published).map((r) => r.id);
    expect(unpublished.length).toBeGreaterThan(0);
    const seen = await rawAs(o.clientUser, async (tx) => {
      const s = await tx.execute(
        sql`SELECT id FROM sessions WHERE id IN (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
      const b = await tx.execute(
        sql`SELECT count(*)::int AS n FROM session_blocks WHERE session_id IN (${sql.join(
          unpublished.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
      const e = await tx.execute(
        sql`SELECT count(*)::int AS n FROM session_exercises se JOIN session_blocks sb ON sb.id = se.block_id WHERE sb.session_id IN (${sql.join(
          unpublished.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
      return {
        sessions:
          (s as unknown as { rows?: { id: string }[] }).rows ?? (s as unknown as { id: string }[]),
        blocks: ((b as unknown as { rows?: { n: number }[] }).rows ??
          (b as unknown as { n: number }[]))[0]!.n,
        exercises: ((e as unknown as { rows?: { n: number }[] }).rows ??
          (e as unknown as { n: number }[]))[0]!.n,
      };
    });
    expect(seen.sessions.map((r) => r.id).sort()).toEqual(published.sort());
    expect(seen.blocks).toBe(0);
    expect(seen.exercises).toBe(0);
    // Staff still read every session of the plan.
    const staff = await rawAs(o.admin, (tx) =>
      tx.execute(
        sql`SELECT count(*)::int AS n FROM sessions WHERE id IN (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      ),
    );
    expect(
      ((staff as unknown as { rows?: { n: number }[] }).rows ??
        (staff as unknown as { n: number }[]))[0]!.n,
    ).toBe(ids.length);
  });
});

describe('fichaje automático (phase 8)', () => {
  it('the first logged set marks the session «iniciada»; closing replaces it', async () => {
    const s = await getPlayerSession(o.clientUser, ids[0]!);
    expect(s.tracking).toBe('Planificada');
    const ex = s.blocks[0]!.exercises[0]!;
    await logSet(o.clientUser, {
      clientMutationId: mid(),
      sessionId: s.id,
      sessionExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      setIndex: 1,
      reps: 8,
      loadKg: 40,
      completed: true,
    });
    expect((await getPlayerSession(o.clientUser, s.id)).tracking).toBe('Iniciada');
    await completeSession(o.clientUser, s.id, {
      status: 'partial',
      reasonCode: 'fatigue',
      feel: 'hard',
    });
    const after = await getPlayerSession(o.clientUser, s.id);
    expect(after.tracking).toBe('Incompleta');
    expect(after.feedback?.feel).toBe('hard');
  });

  it('the daily job: past started → incompleta, past without record → no realizada; idempotent', async () => {
    const past = (
      await testDb()
        .db.select({ id: sessions.id, date: sessions.scheduledDate, published: sessions.published })
        .from(sessions)
        .where(inArray(sessions.id, ids))
    ).filter((r) => r.published && r.date! < today);
    expect(past.length).toBeGreaterThan(2);
    // A session started (set logged) on an earlier day and never closed.
    const started = past.find((r) => r.id !== ids[0])!;
    const s = await getPlayerSession(o.clientUser, started.id);
    const ex = s.blocks[0]!.exercises[0]!;
    await logSet(o.clientUser, {
      clientMutationId: mid(),
      sessionId: s.id,
      sessionExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      setIndex: 1,
      reps: 8,
      completed: true,
    });
    await testDb()
      .db.update(attendance)
      .set({ performedDate: started.date })
      .where(eq(attendance.sessionId, started.id));

    const app = { db: testDb().db, now: () => new Date() };
    await autoCloseSessions(app);
    const rows = await testDb()
      .db.select()
      .from(attendance)
      .where(
        inArray(
          attendance.sessionId,
          past.map((p) => p.id),
        ),
      );
    const by = new Map(rows.map((r) => [r.sessionId, r]));
    expect(by.get(started.id)).toMatchObject({ status: 'partial', automatic: true });
    expect(by.get(ids[0]!)).toMatchObject({ status: 'partial', automatic: false }); // closed by the client
    const others = past.filter((p) => p.id !== started.id && p.id !== ids[0]);
    for (const p of others)
      expect(by.get(p.id), p.date!).toMatchObject({
        status: 'missed',
        automatic: true,
        recordedBy: null,
      });
    // Today, the future and unpublished sessions are not touched.
    const untouched = await testDb()
      .db.select({ id: attendance.id })
      .from(attendance)
      .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
      .where(
        sql`${sessions.id} IN (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )}) AND (${sessions.scheduledDate} >= ${today} OR NOT ${sessions.published})`,
      );
    expect(untouched).toHaveLength(0);
    // Running twice changes nothing.
    expect(await autoCloseSessions(app)).toEqual({ missed: 0, partial: 0 });
    // The client can still close an automatically missed session themselves.
    const missed = others[0]!;
    await completeSession(o.clientUser, missed.id, { status: 'missed', reasonCode: 'work' });
    const [m] = await testDb()
      .db.select()
      .from(attendance)
      .where(eq(attendance.sessionId, missed.id));
    expect(m).toMatchObject({ status: 'missed', automatic: false, reasonCode: 'work' });
  });
});

describe('«¿Cómo fue?» and «¿Molestias?» per exercise (phase 8)', () => {
  it('stores the feel always and the discomfort only with health-data consent', async () => {
    const s = await getPlayerSession(o.clientUser, ids[1]!);
    const ex = s.blocks[0]!.exercises[0]!;
    expect(ex.muscles.length).toBeGreaterThan(0); // silhouette data
    await saveExerciseFeedback(o.clientUser, {
      sessionExerciseId: ex.id,
      feel: 'normal',
      discomfort: 'some',
    });
    let [fb] = await testDb()
      .db.select()
      .from(exerciseFeedback)
      .where(eq(exerciseFeedback.sessionExerciseId, ex.id));
    expect(fb).toMatchObject({ feel: 'normal', discomfort: null });
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    await saveExerciseFeedback(o.clientUser, {
      sessionExerciseId: ex.id,
      feel: 'very_hard',
      discomfort: 'a_lot',
    });
    [fb] = await testDb()
      .db.select()
      .from(exerciseFeedback)
      .where(eq(exerciseFeedback.sessionExerciseId, ex.id));
    expect(fb).toMatchObject({ feel: 'very_hard', discomfort: 'a_lot' });
    const view = await getPlayerSession(o.clientUser, ids[1]!);
    expect(view.blocks[0]!.exercises[0]!.feedback).toEqual({
      feel: 'very_hard',
      discomfort: 'a_lot',
    });
    const [sf] = await testDb().db.select().from(feedback).where(eq(feedback.sessionId, ids[0]!));
    expect(sf!.feel).toBe('hard');
  });
});
