import { schema } from '@tp/db';
import { addDays, isoWeekday, localDate } from '@tp/domain';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addBlock,
  addSessionExercise,
  createAssessment,
  createPlan,
  createPlanFromTemplate,
  createPlanRevision,
  deleteBlock,
  deleteSessionExercise,
  duplicatePlan,
  duplicateSession,
  duplicateWeek,
  getPlan,
  getPlanTemplate,
  getSession,
  listAssessmentTests,
  listCatalog,
  listClientPlans,
  listPlanRevisions,
  listPlanTemplates,
  moveSessionExercise,
  recordAssessmentResult,
  rescheduleSession,
  saveAsTemplate,
  setClientEquipment,
  setPlanStatus,
  updateMicrocycle,
  updateSessionExercise,
  type PlanDetail,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;

const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
});

describe('plan templates', () => {
  it('lists the global matrix and previews a template with its methods', async () => {
    const ts = await listPlanTemplates(o.trainer2);
    expect(ts.length).toBeGreaterThanOrEqual(17);
    const h3 = ts.find((t) => t.slug === 'hipertrofia-3d')!;
    const d = await getPlanTemplate(o.trainer2, h3.id);
    expect(d.totalWeeks).toBe(12);
    expect(d.sessions).toHaveLength(3);
    expect(d.methods.map((m) => m.slug)).toContain('hipertrofia');
    expect(d.sessions[0]!.blocks.flatMap((b) => b.exercises).some((e) => /RIR/.test(e.short))).toBe(
      true,
    );
  });
});

describe('client plans', () => {
  let planId: string;

  it('creates a 12-week, 3-day plan from a template with dates, %1RM → kg and conflicts', async () => {
    // A measured 1RM in back squat lets %1RM become kilograms.
    const tests = await listAssessmentTests(o.admin);
    const sq = tests.find((t) => t.slug === 'one_rm_back_squat')!;
    const a = await createAssessment(o.admin, o.clientA, {
      assessedOn: '2026-09-01',
      testIds: [sq.id],
    });
    await recordAssessmentResult(o.admin, a.id, { testId: sq.id, attempts: [95, 100] });
    // The client only has dumbbells: barbell exercises are flagged, never silently swapped.
    const cat = await listCatalog(o.admin);
    await setClientEquipment(o.admin, o.clientA, {
      items: [
        { equipmentId: cat.equipment.find((e) => e.slug === 'dumbbells')!.id, location: 'gym' },
      ],
    });

    const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'fuerza-3d')!;
    await expect(
      createPlanFromTemplate(o.admin, o.clientA, {
        templateId: tpl.id,
        startDate: '2026-10-05',
        weekdays: [1, 3],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    const r = await createPlanFromTemplate(o.admin, o.clientA, {
      templateId: tpl.id,
      startDate: '2026-10-05',
      weekdays: [1, 3, 5],
    });
    planId = r.id;
    expect(r.weeks).toBe(12);
    expect(r.conflicts.some((c) => /material/.test(c.message))).toBe(true);

    const p = await getPlan(o.admin, planId);
    expect(p).toMatchObject({
      status: 'draft',
      startDate: '2026-10-05',
      endDate: '2026-12-27',
      durationMonths: 3,
    });
    const weeks = weeksOf(p);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]!.sessions.map((s) => s.scheduledDate)).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
    ]);
    expect(weeks.map((w) => w.weekType).slice(0, 4)).toEqual([
      'introduction',
      'progression',
      'progression',
      'deload',
    ]);
    expect(weeks[0]!.indicators.setsByMuscleGroup.quadriceps).toBeGreaterThan(0);

    const s1 = await getSession(o.admin, weeks[0]!.sessions[0]!.id);
    const squat = s1.blocks
      .flatMap((b) => b.exercises)
      .find((e) => e.loadBasisMetric === 'one_rm_back_squat')!;
    expect(squat.prescription.loadPct1rm).toBe(80);
    expect(squat.prescription.loadKg).toBe(80);
    expect(squat.coachNotes).toMatch(/80 % de 100 kg/);
    expect(squat.coachNotes).toMatch(/material/);
    expect(squat.clientText).toMatch(/series de 3–5 repeticiones/);
    // Linear %1RM progression in loading weeks; deload week removes a set.
    const s3 = await getSession(o.admin, weeks[2]!.sessions[0]!.id);
    const s4 = await getSession(o.admin, weeks[3]!.sessions[0]!.id);
    const sq3 = s3.blocks
      .flatMap((b) => b.exercises)
      .find((e) => e.loadBasisMetric === 'one_rm_back_squat')!;
    const sq4 = s4.blocks
      .flatMap((b) => b.exercises)
      .find((e) => e.loadBasisMetric === 'one_rm_back_squat')!;
    expect(sq3.prescription.loadPct1rm).toBe(85);
    expect(sq3.derived).toBe(true);
    expect(sq4.prescription.sets).toBe(squat.prescription.sets! - 1);
  });

  it('edits sessions: overrides are audited, invalid prescriptions are rejected', async () => {
    const p = await getPlan(o.admin, planId);
    const sid = weeksOf(p)[2]!.sessions[0]!.id;
    const s = await getSession(o.admin, sid);
    const derived = s.blocks.flatMap((b) => b.exercises).find((e) => e.derived)!;
    await updateSessionExercise(o.admin, derived.id, {
      expectedVersion: derived.version,
      prescription: { sets: 5 },
      overrideReason: 'Buena tolerancia',
    });
    const after = (await getSession(o.admin, sid)).blocks
      .flatMap((b) => b.exercises)
      .find((e) => e.id === derived.id)!;
    expect(after).toMatchObject({ source: 'manual', derived: false });
    expect(after.prescription.sets).toBe(5);
    const [audit] = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, derived.id));
    expect(audit!.reason).toMatch(/Override: Buena tolerancia/);

    // VBT on an exercise that does not support it, and RIR together with RPE, are rejected.
    const plank = s.blocks.flatMap((b) => b.exercises).find((e) => !e.exercise.supportsVbt)!;
    await expect(
      updateSessionExercise(o.admin, plank.id, {
        expectedVersion: plank.version,
        prescription: { velocityLossPct: 20 },
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      updateSessionExercise(o.admin, plank.id, {
        expectedVersion: plank.version,
        prescription: { rirMin: 2, rpeTarget: 8 },
      }),
    ).rejects.toMatchObject({ code: 'validation' });

    const b = await addBlock(o.admin, sid, { type: 'conditioning', label: 'Final' });
    const e1 = await addSessionExercise(o.admin, b.id, {
      exerciseId: plank.exercise.id,
      prescription: { sets: 2, durationS: 30 },
    });
    const e2 = await addSessionExercise(o.admin, b.id, {
      exerciseId: plank.exercise.id,
      prescription: { sets: 1, durationS: 60 },
    });
    await moveSessionExercise(o.admin, e2.id, { direction: 'up' });
    let block = (await getSession(o.admin, sid)).blocks.find((x) => x.id === b.id)!;
    expect(block.exercises.map((x) => x.id)).toEqual([e2.id, e1.id]);
    await deleteSessionExercise(o.admin, e2.id);
    block = (await getSession(o.admin, sid)).blocks.find((x) => x.id === b.id)!;
    expect(block.exercises.map((x) => [x.id, x.position])).toEqual([[e1.id, 1]]);
    await deleteBlock(o.admin, b.id);
    expect((await getSession(o.admin, sid)).blocks.some((x) => x.id === b.id)).toBe(false);
  });

  it('duplicates sessions, weeks and plans; saves an anonymized template', async () => {
    const p = await getPlan(o.admin, planId);
    const weeks = weeksOf(p);
    const copy = await duplicateSession(o.admin, weeks[0]!.sessions[0]!.id, {
      targetMicrocycleId: weeks[1]!.id,
    });
    const w2 = weeksOf(await getPlan(o.admin, planId))[1]!;
    expect(w2.sessions.find((s) => s.id === copy.id)!.scheduledDate).toBe('2026-10-12');
    const r = await duplicateWeek(o.admin, weeks[0]!.id, { targetMicrocycleId: weeks[4]!.id });
    expect(r.sessions).toBe(3);
    await updateMicrocycle(o.admin, weeks[4]!.id, { weekType: 'deload' });
    expect(weeksOf(await getPlan(o.admin, planId))[4]!.weekType).toBe('deload');

    const dup = await duplicatePlan(o.admin, planId, { name: 'Copia' });
    expect((await getPlan(o.admin, dup.id)).startDate).toBeNull();
    expect(await listClientPlans(o.admin, o.clientA)).toHaveLength(2);

    const t = await saveAsTemplate(o.admin, planId, { name: `Mi plantilla ${o.tag}` });
    const [row] = await testDb()
      .db.select()
      .from(schema.planTemplates)
      .where(eq(schema.planTemplates.id, t.id));
    expect(row!.organizationId).toBe(o.org.organizationId);
    const def = JSON.stringify(row!.definition);
    expect(def).not.toMatch(/loadKg/);
    expect(def).not.toMatch(/2026-/);
    expect(def).not.toContain(o.clientA);
    expect((await listPlanTemplates(other.admin)).some((x) => x.id === t.id)).toBe(false);
  });

  it('activation snapshots a revision; only one active plan; revisions record diffs', async () => {
    await setPlanStatus(o.admin, planId, { status: 'active' });
    let revs = await listPlanRevisions(o.admin, planId);
    expect(revs.map((x) => x.revision)).toEqual([1]);
    const [dup] = (await listClientPlans(o.admin, o.clientA)).filter((x) => x.id !== planId);
    await expect(setPlanStatus(o.admin, dup!.id, { status: 'active' })).rejects.toMatchObject({
      code: expect.stringMatching(/conflict|validation/),
    });
    const sid = weeksOf(await getPlan(o.admin, planId))[0]!.sessions[0]!.id;
    const ex = (await getSession(o.admin, sid)).blocks.flatMap((b) => b.exercises)[0]!;
    await updateSessionExercise(o.admin, ex.id, {
      expectedVersion: ex.version,
      prescription: { sets: 4 },
    });
    await createPlanRevision(o.admin, planId, { reason: 'Ajuste tras la primera semana' });
    revs = await listPlanRevisions(o.admin, planId);
    expect(revs[0]).toMatchObject({ revision: 2, reason: 'Ajuste tras la primera semana' });
    expect((revs[0]!.diff as { changed: number }).changed).toBeGreaterThanOrEqual(1);
  });

  it('creates a manual plan skeleton and validates the duration', async () => {
    await expect(
      createPlan(o.trainer2, o.clientB, {
        name: 'Demasiado largo',
        durationMonths: 3,
        weeks: 20,
        weekdays: [1],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      createPlan(o.trainer2, o.clientB, { name: 'x', durationMonths: 5, weekdays: [1] }),
    ).rejects.toMatchObject({ code: 'validation' });
    const m = await createPlan(o.trainer2, o.clientB, {
      name: 'Manual',
      durationMonths: 3,
      weeks: 12,
      weekdays: [2, 4, 6],
      startDate: '2026-10-06',
    });
    const p = await getPlan(o.trainer2, m.id);
    const weeks = weeksOf(p);
    expect(weeks).toHaveLength(12);
    expect(p.phases[0]!.mesocycles).toHaveLength(3);
    expect(weeks[0]!.sessions.map((s) => [s.dayLabel, s.scheduledDate])).toEqual([
      ['A', '2026-10-06'],
      ['B', '2026-10-08'],
      ['C', '2026-10-10'],
    ]);
  });

  it('locks completed and archived plans on the server; status changes and copies still work', async () => {
    const m = await createPlan(o.admin, o.clientB, {
      name: 'Bloqueo',
      durationMonths: 3,
      weeks: 12,
      weekdays: [1],
      startDate: '2026-10-05',
    });
    const week = weeksOf(await getPlan(o.admin, m.id))[0]!;
    const sid = week.sessions[0]!.id;
    for (const status of ['completed', 'archived'] as const) {
      await setPlanStatus(o.admin, m.id, { status });
      const locked = { code: 'conflict', details: { plan: ['locked'] } };
      await expect(
        addBlock(o.admin, sid, { type: 'conditioning', label: 'X' }),
      ).rejects.toMatchObject(locked);
      await expect(
        updateMicrocycle(o.admin, week.id, { weekType: 'deload' }),
      ).rejects.toMatchObject(locked);
      await expect(
        createPlanRevision(o.admin, m.id, { reason: 'No debería poder' }),
      ).rejects.toMatchObject(locked);
      // Reading, copying and saving as a template stay allowed.
      expect((await getSession(o.admin, sid)).id).toBe(sid);
      const copy = await duplicatePlan(o.admin, m.id, { name: `Copia ${status}` });
      expect((await getPlan(o.admin, copy.id)).status).toBe('draft');
    }
    // Reopening is a status change, allowed on a locked plan; then it can be edited again.
    await setPlanStatus(o.admin, m.id, { status: 'draft' });
    await addBlock(o.admin, sid, { type: 'conditioning', label: 'Reabierto' });
  });

  it('reschedules a session from the calendar: same week, another week, and every refusal', async () => {
    const today = localDate(new Date());
    const monday = addDays(today, 1 - isoWeekday(today));
    const m = await createPlan(o.admin, o.clientB, {
      name: 'Reprogramar',
      durationMonths: 3,
      weeks: 12,
      weekdays: [1, 3, 5],
      startDate: monday,
    });
    const weeks = weeksOf(await getPlan(o.admin, m.id));
    const s = weeks[1]!.sessions[0]!; // Monday of week 2: always in the future
    const v = (await getSession(o.admin, s.id)).version;
    // Same week: only the date changes.
    await rescheduleSession(o.admin, s.id, {
      expectedVersion: v,
      date: addDays(s.scheduledDate!, 1),
    });
    expect((await getSession(o.admin, s.id)).scheduledDate).toBe(addDays(s.scheduledDate!, 1));
    // Stale version.
    await expect(
      rescheduleSession(o.admin, s.id, { expectedVersion: v, date: addDays(s.scheduledDate!, 2) }),
    ).rejects.toMatchObject({ code: 'conflict' });
    // Another week: the session moves to that week.
    const target = addDays(weeks[2]!.startDate!, 3);
    const r = await rescheduleSession(o.admin, s.id, { expectedVersion: v + 1, date: target });
    expect(r.microcycleId).toBe(weeks[2]!.id);
    const after = weeksOf(await getPlan(o.admin, m.id));
    expect(after[2]!.sessions.some((x) => x.id === s.id && x.scheduledDate === target)).toBe(true);
    expect(after[1]!.sessions.some((x) => x.id === s.id)).toBe(false);
    const v3 = v + 2;
    // Past day and days outside the plan's weeks.
    await expect(
      rescheduleSession(o.admin, s.id, { expectedVersion: v3, date: addDays(today, -1) }),
    ).rejects.toMatchObject({ code: 'validation', details: { date: ['past'] } });
    await expect(
      rescheduleSession(o.admin, s.id, {
        expectedVersion: v3,
        date: addDays(weeks.at(-1)!.startDate!, 7),
      }),
    ).rejects.toMatchObject({ code: 'validation', details: { date: ['outside_plan'] } });
    // Out of scope.
    for (const by of [other.admin, o.clientUser])
      await expect(
        rescheduleSession(by, s.id, { expectedVersion: v3, date: target }),
      ).rejects.toMatchObject({ code: expect.stringMatching(/^(forbidden|not_found)$/) });
    // A session with a record (here, completed) cannot move.
    const done = weeks[3]!.sessions[0]!;
    await testDb().db.insert(schema.attendance).values({
      organizationId: o.org.organizationId,
      clientId: o.clientB,
      sessionId: done.id,
      status: 'completed',
      performedDate: today,
    });
    await expect(
      rescheduleSession(o.admin, done.id, {
        expectedVersion: (await getSession(o.admin, done.id)).version,
        date: addDays(done.scheduledDate!, 1),
      }),
    ).rejects.toMatchObject({ code: 'conflict', details: { session: ['recorded'] } });
    // Sets logged without attendance yet (the player is mid-session) are a record too.
    const logged = weeks[3]!.sessions[1]!;
    const [ex] = await testDb()
      .db.select({ id: schema.exercises.id })
      .from(schema.exercises)
      .limit(1);
    await testDb().db.insert(schema.setLogs).values({
      organizationId: o.org.organizationId,
      clientId: o.clientB,
      sessionId: logged.id,
      exerciseIdPerformed: ex!.id,
      setIndex: 1,
      loggedByRole: 'trainer',
      loggedBy: o.org.adminUserId,
    });
    await expect(
      rescheduleSession(o.admin, logged.id, {
        expectedVersion: (await getSession(o.admin, logged.id)).version,
        date: addDays(logged.scheduledDate!, 1),
      }),
    ).rejects.toMatchObject({ code: 'conflict', details: { session: ['recorded'] } });
    // An archived plan is locked.
    await setPlanStatus(o.admin, m.id, { status: 'archived' });
    await expect(
      rescheduleSession(o.admin, s.id, { expectedVersion: v3, date: addDays(target, 1) }),
    ).rejects.toMatchObject({ code: 'conflict', details: { plan: ['locked'] } });
  });

  it('enforces scope: other trainer, other organization, clients', async () => {
    await expect(getPlan(o.trainer2, planId)).rejects.toMatchObject({ code: 'not_found' });
    await expect(getPlan(other.admin, planId)).rejects.toMatchObject({ code: 'not_found' });
    await expect(getPlan(o.clientUser, planId)).rejects.toMatchObject({ code: 'not_found' });
    const sid = weeksOf(await getPlan(o.admin, planId))[0]!.sessions[0]!.id;
    await expect(getSession(o.trainer2, sid)).rejects.toMatchObject({ code: 'not_found' });
    await expect(listPlanTemplates(o.clientUser)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
