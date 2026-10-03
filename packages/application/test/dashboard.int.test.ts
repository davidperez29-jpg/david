import { addDays, isoWeekday, localDate } from '@tp/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  calendarEvents,
  clientDashboard,
  clientSummary,
  completeSession,
  createAssessment,
  createPlanFromTemplate,
  getPlan,
  listAssessmentTests,
  listPlanTemplates,
  publishSessions,
  setPlanStatus,
  setProgressMetrics,
  trainerDashboard,
  type PlanDetail,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
const today = localDate(new Date());
const monday = addDays(today, 1 - isoWeekday(today));
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
let planId: string;
let pastSessions: { id: string; scheduledDate: string | null }[];

beforeAll(async () => {
  o = await buildOrg();
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  const r = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: addDays(monday, -14),
    weekdays: [1, 3, 5],
  });
  planId = r.id;
  await setPlanStatus(o.admin, planId, { status: 'active' });
  await publishSessions(o.admin, { scope: 'plan', id: planId, published: true });
  const all = weeksOf(await getPlan(o.admin, planId)).flatMap((w) => w.sessions);
  pastSessions = all.filter((s) => s.scheduledDate! < today);
  for (const s of pastSessions.slice(-3))
    await completeSession(o.admin, s.id, {
      status: 'completed',
      sessionRpe: 6,
      durationMin: 60,
      comment: 'Muy bien, el peso muerto más fácil',
    });
  const sq = (await listAssessmentTests(o.admin)).find((t) => t.slug === 'cmj_height')!;
  await createAssessment(o.admin, o.clientA, { assessedOn: addDays(today, 3), testIds: [sq.id] });
});

describe('global calendar', () => {
  it('sessions and assessments of accessible clients; phases and rest weeks for one client', async () => {
    const from = addDays(monday, -14);
    const to = addDays(monday, 34);
    const all = await calendarEvents(o.admin, { from, to });
    expect(all.sessions.filter((s) => s.clientId === o.clientA).length).toBeGreaterThanOrEqual(18);
    expect(all.assessments.some((a) => a.clientId === o.clientA && a.status === 'planned')).toBe(
      true,
    );
    expect(all.spans).toEqual([]);
    const one = await calendarEvents(o.admin, { from, to, clientId: o.clientA });
    expect(one.spans.some((s) => s.kind === 'phase')).toBe(true);
    // Trainer 2 is not assigned to client A: RLS hides them; filtering by them is not found.
    const t2 = await calendarEvents(o.trainer2, { from, to });
    expect(t2.sessions.some((s) => s.clientId === o.clientA)).toBe(false);
    await expect(
      calendarEvents(o.trainer2, { from, to, clientId: o.clientA }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(calendarEvents(o.admin, { from, to: addDays(from, 90) })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(calendarEvents(o.clientUser, { from, to })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('trainer dashboard and client summary', () => {
  it('pending assessments and recent feedback; summary with plan week, adherence and next session', async () => {
    const d = await trainerDashboard(o.admin);
    expect(d.pendingAssessments.some((a) => a.clientId === o.clientA && !a.overdue)).toBe(true);
    expect(d.recentFeedback[0]!.comment).toContain('peso muerto');
    const s = await clientSummary(o.admin, o.clientA);
    expect(s.plan?.current?.weekIndex).toBe(3);
    expect(s.plan?.current?.totalWeeks).toBe(12);
    expect(s.adherence28.planned).toBe(pastSessions.length);
    expect(s.next).not.toBeNull();
    await expect(clientSummary(o.clientUser, o.clientA)).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(clientSummary(o.trainer2, o.clientA)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('client dashboard', () => {
  it('next session with preview, streak, milestones and visible metrics chosen by the trainer', async () => {
    const d = await clientDashboard(o.clientUser, o.clientA);
    expect(d.next?.preview.length).toBeGreaterThan(0);
    expect(d.next?.preview[0]!.short.length).toBeGreaterThan(0);
    expect(d.streak).toBe(3);
    expect(d.milestones.map((m) => m.text)).toContain('¡Primera sesión completada!');
    expect(d.milestones.map((m) => m.text)).toContain('Racha de 3 sesiones seguidas');
    expect(d.nextAssessment?.date).toBe(addDays(today, 3));
    expect(d.visibleTestIds).toEqual([]);

    const tests = await listAssessmentTests(o.admin);
    const cmj = tests.find((t) => t.slug === 'cmj_height')!;
    await setProgressMetrics(o.admin, o.clientA, { testIds: [cmj.id] });
    expect((await clientDashboard(o.clientUser, o.clientA)).visibleTestIds).toEqual([cmj.id]);
    await expect(
      setProgressMetrics(o.admin, o.clientA, { testIds: tests.slice(0, 6).map((t) => t.id) }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(setProgressMetrics(o.trainer2, o.clientA, { testIds: [] })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      setProgressMetrics(o.clientUser, o.clientA, { testIds: [] }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(clientDashboard(o.clientUser, o.clientB)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
