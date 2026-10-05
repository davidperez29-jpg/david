import { addDays, isoWeekday, localDate } from '@tp/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addHealthDeclaration,
  completeSession,
  createPlanFromTemplate,
  getPlan,
  grantConsent,
  listPlanTemplates,
  publishSessions,
  setPlanStatus,
  trainerHome,
  type PlanDetail,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
const today = localDate(new Date());
const monday = addDays(today, 1 - isoWeekday(today));
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
let sessions: { id: string; scheduledDate: string | null }[];

beforeAll(async () => {
  o = await buildOrg();
  // Client A (admin's): plan started two weeks ago, the last three past sessions done.
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  const plan = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: addDays(monday, -14),
    weekdays: [1, 3, 5],
  });
  await setPlanStatus(o.admin, plan.id, { status: 'active' });
  await publishSessions(o.admin, { scope: 'plan', id: plan.id, published: true });
  sessions = weeksOf(await getPlan(o.admin, plan.id)).flatMap((w) => w.sessions);
  for (const s of sessions.filter((x) => x.scheduledDate! < today).slice(-3))
    await completeSession(o.admin, s.id, { status: 'completed', sessionRpe: 6, durationMin: 60 });
  // Client B (trainer 2's): a declaration that needs a health professional's assessment.
  await grantConsent(o.trainer2, o.clientB, { purpose: 'health_data', method: 'paper' });
  await addHealthDeclaration(o.trainer2, o.clientB, {
    type: 'injury',
    bodyRegion: 'rodilla',
    requiresProfessionalAssessment: true,
    declaredStatus: 'active',
  });
});

describe('trainer home', () => {
  it('one row per accessible client: adherence, next session, status and its reason', async () => {
    const h = await trainerHome(o.admin, { limit: 100 });
    expect(h.today).toBe(today);
    const a = h.clients.items.find((c) => c.id === o.clientA)!;
    const b = h.clients.items.find((c) => c.id === o.clientB)!;
    const past = sessions.filter((s) => s.scheduledDate! < today);
    expect(a.adherence28.planned).toBe(past.length);
    expect(a.adherence28.done).toBe(3);
    expect(a.next!.date >= today).toBe(true);
    expect(sessions.map((s) => s.id)).toContain(a.next!.id);
    expect(b.status).toBe('review');
    expect(b.attention).toContainEqual(
      expect.objectContaining({
        reason: 'referral',
        text: 'Requiere valoración por profesional sanitario',
      }),
    );
    expect(b.next).toBeNull();
    expect(b.adherence28.percent).toBeNull();
    // Rows that need a review come first.
    const rank = { review: 0, look: 1, ok: 2 } as const;
    const ranks = h.clients.items.map((c) => rank[c.status]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    // Today's sessions: client A trains on Monday, Wednesday and Friday.
    const trainsToday = sessions.some((s) => s.scheduledDate === today);
    expect(h.todaySessions.some((s) => s.clientId === o.clientA)).toBe(trainsToday);
  });

  it('a trainer only sees their own clients; a client cannot open it', async () => {
    const h = await trainerHome(o.trainer2, {});
    expect(h.clients.items.map((c) => c.id)).toEqual([o.clientB]);
    expect(h.todaySessions.every((s) => s.clientId === o.clientB)).toBe(true);
    await expect(trainerHome(o.clientUser, {})).rejects.toMatchObject({ code: 'forbidden' });
  });
});
