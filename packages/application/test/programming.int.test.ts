import { schema } from '@tp/db';
import { addDays, isoWeekday, localDate } from '@tp/domain';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  acceptAdjustments,
  acceptPlanProposal,
  completeSession,
  createPlanFromTemplate,
  decideAdjustment,
  discardPlanProposal,
  evaluateAdjustments,
  generatePlanProposal,
  getPlan,
  getPlayerSession,
  grantConsent,
  listAdjustments,
  listClientPlans,
  listPlanProposals,
  listPlanRevisions,
  listPlanTemplates,
  logSet,
  publishSessions,
  recordScreening,
  refreshAdjustments,
  revertAdjustment,
  runDecision,
  saveExerciseFeedback,
  setAutoApply,
  setPlanStatus,
  type RequestContext,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let planId: string;
let squatId: string;
const today = localDate(new Date());
const thisMonday = addDays(today, 1 - isoWeekday(today));
const db = () => testDb().db;
const mid = () => `m${randomUUID().replace(/-/g, '')}`;

/** Everything the trainer prescribed in the active plan (to prove nothing changes on its own). */
async function planSnapshot(id: string) {
  const r = await db().execute(sql`
    SELECT se.id, se.exercise_id, se.sets, se.load_kg, se.rir_min, se.rir_max
    FROM session_exercises se
    JOIN session_blocks b ON b.id = se.block_id
    JOIN sessions s ON s.id = b.session_id
    JOIN microcycles mi ON mi.id = s.microcycle_id
    JOIN mesocycles me ON me.id = mi.mesocycle_id
    JOIN phases ph ON ph.id = me.phase_id
    WHERE ph.plan_id = ${id} ORDER BY se.id`);
  return JSON.stringify(r);
}

/** Sessions of the plan that contain the exercise, with their date. */
async function sessionsWith(exerciseId: string) {
  const plan = await getPlan(o.admin, planId);
  const all = plan.phases.flatMap((p) =>
    p.mesocycles.flatMap((m) => m.weeks.flatMap((w) => w.sessions)),
  );
  const out: { id: string; date: string; seId: string }[] = [];
  for (const s of all) {
    const rows = await db()
      .select({ id: schema.sessionExercises.id })
      .from(schema.sessionExercises)
      .innerJoin(schema.sessionBlocks, eq(schema.sessionBlocks.id, schema.sessionExercises.blockId))
      .where(
        and(
          eq(schema.sessionBlocks.sessionId, s.id),
          eq(schema.sessionExercises.exerciseId, exerciseId),
        ),
      );
    if (rows[0] && s.scheduledDate) out.push({ id: s.id, date: s.scheduledDate, seId: rows[0].id });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

async function logTop(by: RequestContext, session: { id: string; seId: string }, reps = 8) {
  const p = await getPlayerSession(by, session.id);
  for (const setIndex of [1, 2, 3])
    await logSet(by, {
      clientMutationId: mid(),
      sessionId: session.id,
      sessionExerciseId: session.seId,
      exerciseId: squatId,
      setIndex,
      loadKg: 80,
      reps,
      rir: 2,
      downloadedAt: p.downloadedAt,
    });
  // Closing the session is the event that triggers monitoring and the adjustments evaluation.
  await completeSession(by, session.id, { status: 'completed', sessionRpe: 7, durationMin: 60 });
}

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  ({ id: planId } = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: addDays(thisMonday, -14),
    weekdays: [1, 3, 5],
  }));
  await setPlanStatus(o.admin, planId, { status: 'active' });
  await publishSessions(o.admin, { scope: 'plan', id: planId, published: true });
  // Test setup: the first exercise of the plan is prescribed as 6–8 reps @ RIR 1–3 with 80 kg.
  const [first] = await db().execute<{ exercise_id: string }>(sql`
    SELECT se.exercise_id FROM session_exercises se
    JOIN session_blocks b ON b.id = se.block_id JOIN sessions s ON s.id = b.session_id
    JOIN microcycles mi ON mi.id = s.microcycle_id JOIN mesocycles me ON me.id = mi.mesocycle_id
    JOIN phases ph ON ph.id = me.phase_id
    WHERE ph.plan_id = ${planId} AND b.type IN ('main_strength', 'hypertrophy')
    ORDER BY s.scheduled_date, b.position, se.position LIMIT 1`);
  squatId = (first as { exercise_id: string }).exercise_id;
  await db().execute(sql`
    UPDATE session_exercises SET load_kg = 80, load_pct_1rm = NULL, reps_min = 6, reps_max = 8,
      rir_min = 1, rir_max = 3, sets = 4
    WHERE exercise_id = ${squatId} AND block_id IN (
      SELECT b.id FROM session_blocks b JOIN sessions s ON s.id = b.session_id
      JOIN microcycles mi ON mi.id = s.microcycle_id JOIN mesocycles me ON me.id = mi.mesocycle_id
      JOIN phases ph ON ph.id = me.phase_id WHERE ph.plan_id = ${planId})`);
});

describe('hard rule: no automatic process changes an active plan (§12.2)', () => {
  it('logging, evaluation, the daily job and plan proposals leave the active plan untouched', async () => {
    const before = await planSnapshot(planId);
    const past = (await sessionsWith(squatId)).filter((s) => s.date < today);
    expect(past.length).toBeGreaterThanOrEqual(1);
    expect(past.length).toBeGreaterThanOrEqual(2);
    await logTop(o.admin, past[0]!); // also triggers the evaluation after commit
    await refreshAdjustments(o.admin, o.clientA);
    await evaluateAdjustments({ db: db(), now: () => new Date() }, o.clientA);
    await generatePlanProposal(o.admin, o.clientA, {
      templateId: (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!.id,
      startDate: addDays(thisMonday, 7),
      weekdays: [1, 3, 5],
    });
    await runDecision(o.admin, o.clientA);
    expect(await planSnapshot(planId)).toBe(before);

    const { items } = await listAdjustments(o.admin, o.clientA);
    const load = items.filter((i) => i.kind === 'load_progression');
    // One pending proposal, not one per evaluation; re-running the decision engine keeps it.
    expect(load).toHaveLength(1);
    expect(load[0]).toMatchObject({ status: 'proposed', type: 'progression' });
    expect(load[0]!.params.toKg!).toBeGreaterThan(80);
    expect(load[0]!.targets.every((t) => t.date >= today)).toBe(true);
    expect(load[0]!.explanation.data.join(' ')).toMatch(/Última sesión/);
  });
});

describe('the trainer decides (§12.2, §13.9)', () => {
  it('accept applies only to future sessions, with a plan revision; undo restores', async () => {
    const [p] = (await listAdjustments(o.admin, o.clientA)).items.filter(
      (i) => i.kind === 'load_progression' && i.status === 'proposed',
    );
    const revs = (await listPlanRevisions(o.admin, planId)).length;
    const r = await decideAdjustment(o.admin, p!.id, { action: 'accept' });
    expect(r.applied).toBe(p!.preview.length);
    const rows = await db()
      .select({
        id: schema.sessionExercises.id,
        load: schema.sessionExercises.loadKg,
        source: schema.sessionExercises.source,
      })
      .from(schema.sessionExercises)
      .where(
        inArray(
          schema.sessionExercises.id,
          p!.targets.map((t) => t.sessionExerciseId),
        ),
      );
    expect(
      rows.every((x) => Number(x.load) === p!.params.toKg && x.source === 'progression_rule'),
    ).toBe(true);
    // Past (performed) sessions keep what was prescribed.
    const past = (await sessionsWith(squatId)).filter((s) => s.date < today);
    const [kept] = await db()
      .select({ load: schema.sessionExercises.loadKg })
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.id, past[0]!.seId));
    expect(Number(kept!.load)).toBe(80);
    expect((await listPlanRevisions(o.admin, planId)).length).toBe(revs + 1);
    await expect(decideAdjustment(o.admin, p!.id, { action: 'reject' })).rejects.toMatchObject({
      code: 'conflict',
    });

    const u = await revertAdjustment(o.admin, p!.id, { reason: 'Prefiero esperar una semana' });
    expect(u.reverted).toBe(r.applied);
    const back = await db()
      .select({ load: schema.sessionExercises.loadKg })
      .from(schema.sessionExercises)
      .where(
        inArray(
          schema.sessionExercises.id,
          p!.targets.map((t) => t.sessionExerciseId),
        ),
      );
    expect(back.every((x) => Number(x.load) === 80)).toBe(true);
    expect(
      (await listAdjustments(o.admin, o.clientA)).items.find((i) => i.id === p!.id)!.status,
    ).toBe('reverted');
  });

  it('response signals → deload proposal; edit (audited override), reject, postpone and bulk', async () => {
    // Test setup: an open "sRPE high" alert from monitoring (Phase 8).
    await db().insert(schema.alerts).values({
      organizationId: o.org.organizationId,
      clientId: o.clientA,
      severity: 'yellow',
      type: 'srpe_high',
      ruleKey: 'srpe_high',
      alertKey: 'srpe_high',
      message: 'RPE alto',
    });
    await refreshAdjustments(o.admin, o.clientA);
    const deload = (await listAdjustments(o.admin, o.clientA)).items.find(
      (i) => i.kind === 'deload_week' && i.status === 'proposed',
    )!;
    expect(deload.title).toMatch(/descarga/);
    expect(deload.explanation.limitations.join(' ')).toMatch(/REQUIERE VERIFICACIÓN/);
    await expect(
      decideAdjustment(o.admin, deload.id, { action: 'accept_with_changes' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await decideAdjustment(o.admin, deload.id, { action: 'postpone' });
    const r = await decideAdjustment(o.admin, deload.id, {
      action: 'accept_with_changes',
      params: { setsDelta: -2 },
      reason: 'Semana de exámenes',
    });
    expect(r.applied).toBeGreaterThan(0);
    const ov = await db()
      .select()
      .from(schema.manualOverrides)
      .where(eq(schema.manualOverrides.recommendationId, deload.id));
    expect(ov).toEqual([
      expect.objectContaining({ field: 'setsDelta', proposedValue: -1, finalValue: -2 }),
    ]);
    const t = deload.targets.find((x) => x.sets === 4)!;
    const [row] = await db()
      .select({ sets: schema.sessionExercises.sets })
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.id, t.sessionExerciseId));
    expect(row!.sets).toBe(2);
  });

  it('auto-apply (off by default): routine load progressions applied by the system, audited, undoable', async () => {
    expect((await listAdjustments(o.admin, o.clientA)).autoApplyLoadProgressions).toBe(false);
    await setAutoApply(o.admin, o.clientA, { enabled: true });
    // A new performed session of the exercise (another key) → applied without confirmation.
    const past = (await sessionsWith(squatId)).filter((s) => s.date < today);
    await logTop(o.admin, past.at(-1)!);
    const auto = (await listAdjustments(o.admin, o.clientA)).items.find(
      (i) => i.kind === 'load_progression' && i.status === 'accepted',
    );
    expect(auto?.decisionReason).toMatch(/automáticamente/);
    expect(auto?.decidedBy).toBeNull();
    const [audit] = await db()
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityId, auto!.id),
          eq(schema.auditLogs.entityType, 'recommendation'),
        ),
      );
    expect(audit!.actorRoles).toEqual(['SYSTEM']);
    expect((await revertAdjustment(o.admin, auto!.id)).reverted).toBeGreaterThan(0);
    await setAutoApply(o.admin, o.clientA, { enabled: false });
  });
  it('pain on an exercise (with consent) → substitution with options; never a diagnosis', async () => {
    const past = (await sessionsWith(squatId)).filter((s) => s.date < today);
    await saveExerciseFeedback(o.admin, { sessionExerciseId: past.at(-1)!.seId, pain: 5 });
    const sub = (await listAdjustments(o.admin, o.clientA)).items.find(
      (i) => i.kind === 'substitution' && i.status === 'proposed',
    );
    expect(sub).toBeDefined();
    expect(sub!.options.length).toBeGreaterThan(0);
    expect(sub!.explanation.interpretation.join(' ')).toMatch(/No es un diagnóstico/);
    await expect(
      decideAdjustment(o.admin, sub!.id, {
        action: 'accept_with_changes',
        params: { toExerciseId: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    const r = await acceptAdjustments(o.admin, o.clientA, { ids: [sub!.id] });
    expect(r).toMatchObject({ failed: [] });
    expect(r.applied).toBeGreaterThan(0);
  });
});

describe('plan proposals (§12.2.5)', () => {
  it('generated as PROPOSAL, editable, never activated directly; accepted as a draft or discarded', async () => {
    const proposals = await listPlanProposals(o.admin, o.clientA);
    expect(proposals[0]).toMatchObject({ status: 'proposed' });
    expect(proposals[0]!.notes.join(' ')).toMatch(/Punto de partida: plantilla/);
    expect((await listClientPlans(o.admin, o.clientA)).map((p) => p.id)).not.toContain(
      proposals[0]!.id,
    );
    await expect(
      setPlanStatus(o.admin, proposals[0]!.id, { status: 'active' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await acceptPlanProposal(o.admin, proposals[0]!.id, { name: 'Bloque de otoño' });
    const plans = await listClientPlans(o.admin, o.clientA);
    expect(plans.find((p) => p.id === proposals[0]!.id)).toMatchObject({
      status: 'draft',
      name: 'Bloque de otoño',
    });
    await expect(acceptPlanProposal(o.admin, proposals[0]!.id, {})).rejects.toMatchObject({
      code: 'conflict',
    });

    const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
    const { id } = await generatePlanProposal(o.admin, o.clientA, {
      templateId: tpl.id,
      startDate: addDays(thisMonday, 14),
      weekdays: [1, 3, 5],
    });
    await discardPlanProposal(o.admin, id, { reason: 'Esperamos a la reevaluación' });
    expect((await listPlanProposals(o.admin, o.clientA)).find((p) => p.id === id)!.status).toBe(
      'archived',
    );
    await expect(
      generatePlanProposal(o.admin, o.clientA, {
        templateId: tpl.id,
        startDate: today,
        weekdays: [1, 3],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('a positive screening blocks a full plan proposal (referral, never a diagnosis)', async () => {
    await grantConsent(o.trainer2, o.clientB, { purpose: 'health_data', method: 'paper' });
    await recordScreening(o.trainer2, o.clientB, {
      questionnaire: 'PAR-Q+',
      questionnaireVersion: '2023',
      result: 'refer',
      completedOn: today,
    });
    await runDecision(o.trainer2, o.clientB);
    const tpl = (await listPlanTemplates(o.trainer2)).find((t) => t.slug === 'hipertrofia-3d')!;
    await expect(
      generatePlanProposal(o.trainer2, o.clientB, {
        templateId: tpl.id,
        startDate: today,
        weekdays: [1, 3, 5],
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringMatching(/profesional sanitario/),
    });
  });
});

describe('permissions and isolation', () => {
  it('clients, unassigned trainers and other organizations cannot see or decide', async () => {
    const pending = (await listAdjustments(o.admin, o.clientA)).items[0]!;
    for (const by of [o.clientUser, o.trainer2, other.admin])
      await expect(listAdjustments(by, o.clientA)).rejects.toMatchObject({
        code: expect.stringMatching(/^(forbidden|not_found)$/),
      });
    await expect(
      decideAdjustment(other.admin, pending.id, { action: 'reject' }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(setAutoApply(o.clientUser, o.clientA, { enabled: true })).rejects.toMatchObject({
      code: expect.stringMatching(/^(forbidden|not_found)$/),
    });
  });
});
