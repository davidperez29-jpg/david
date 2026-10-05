import { schema } from '@tp/db';
import { addDays, isoWeekday, localDate } from '@tp/domain';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clientMonitoring,
  completeSession,
  createPlanFromTemplate,
  getMonitoringRules,
  getPlan,
  getPlayerSession,
  grantConsent,
  listAlerts,
  listPlanTemplates,
  monitorAllClients,
  monitoringOverview,
  publishSessions,
  refreshClientAlerts,
  setClientRuleOverride,
  setPlanStatus,
  syncMutations,
  updateAlertStatus,
  updateMonitoringRules,
  type PlanDetail,
  type RequestContext,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
const today = localDate(new Date());
const thisMonday = addDays(today, 1 - isoWeekday(today));
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));

/** Active plan of 12 weeks × 3 days that started 8 weeks ago; the 8 past weeks are published. */
async function pastPlan(by: RequestContext, clientId: string) {
  const tpl = (await listPlanTemplates(by)).find((t) => t.slug === 'hipertrofia-3d')!;
  const { id } = await createPlanFromTemplate(by, clientId, {
    templateId: tpl.id,
    startDate: addDays(thisMonday, -56),
    weekdays: [1, 3, 5],
  });
  await setPlanStatus(by, id, { status: 'active' });
  const weeks = weeksOf(await getPlan(by, id));
  for (const w of weeks.slice(0, 8))
    await publishSessions(by, { scope: 'week', id: w.id, published: true });
  return weeks.slice(0, 8).flatMap((w) => w.sessions);
}

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
});

describe('adherence (acceptance §16.2)', () => {
  it('24 planned / 21 done = 87.5 %', async () => {
    const sessions = await pastPlan(o.admin, o.clientA);
    expect(sessions).toHaveLength(24);
    for (const [i, s] of sessions.entries()) {
      if (i < 19)
        await completeSession(o.admin, s.id, {
          status: 'completed',
          sessionRpe: 6,
          durationMin: 60,
        });
      else if (i < 21)
        await completeSession(o.admin, s.id, { status: 'partial', reasonCode: 'work' });
      else await completeSession(o.admin, s.id, { status: 'missed', reasonCode: 'illness' });
    }
    const m = await clientMonitoring(o.admin, o.clientA);
    expect(m.adherence84).toMatchObject({
      planned: 24,
      done: 21,
      completed: 19,
      partial: 2,
      missed: 3,
    });
    expect(m.adherence84.percent).toBe(87.5);
    // Internal load: 6 × 60 = 360 AU per completed session.
    expect(m.recent.find((r) => r.status === 'completed')?.load).toBe(360);
    expect(m.weeks.length).toBe(8);
    // The client sees their own numbers, never the trainer's alerts.
    const own = await clientMonitoring(o.clientUser, o.clientA);
    expect(own.adherence84.percent).toBe(87.5);
    expect(own.alerts).toEqual([]);
    await expect(clientMonitoring(other.admin, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(listAlerts(o.clientUser)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('alerts', () => {
  let sessions: { id: string; scheduledDate: string | null }[];

  it('are raised after events, deduplicated and only for the assigned trainers', async () => {
    sessions = await pastPlan(o.trainer2, o.clientB);
    // Only the first 10 sessions are recorded: the rest are past and without a record.
    for (const s of sessions.slice(0, 10))
      await completeSession(o.trainer2, s.id, {
        status: 'completed',
        sessionRpe: 6,
        durationMin: 50,
      });
    await refreshClientAlerts(o.trainer2, o.clientB);
    const live = await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' });
    const keys = live.map((a) => a.type);
    expect(keys).toContain('adherence_low');
    expect(keys).toContain('missed_in_a_row');
    expect(live.find((a) => a.type === 'adherence_low')!.severity).toBe('red');
    // Running it again does not duplicate.
    await refreshClientAlerts(o.trainer2, o.clientB);
    expect(await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' })).toHaveLength(
      live.length,
    );
    // The admin-trainer is not assigned to client B but, as ADMIN, sees the organization.
    expect((await listAlerts(o.admin, { clientId: o.clientB, status: 'live' })).length).toBe(
      live.length,
    );
    expect(await listAlerts(other.admin)).toHaveLength(0);
    const ov = await monitoringOverview(o.trainer2);
    expect(ov.alerts.red).toBeGreaterThanOrEqual(1);
  });

  it('pain: only with consent; red with referral and a notification to the trainer', async () => {
    const s = sessions[10]!;
    const r = await completeSession(o.trainer2, s.id, {
      status: 'completed',
      sessionRpe: 7,
      durationMin: 50,
      pain: { intensity: 8, bodyRegion: 'Rodilla' },
    });
    expect(r.painStored).toBe(false);
    expect(
      (await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' })).some(
        (a) => a.type === 'pain',
      ),
    ).toBe(false);
    await grantConsent(o.trainer2, o.clientB, { purpose: 'health_data', method: 'paper' });
    await completeSession(o.trainer2, s.id, {
      status: 'completed',
      sessionRpe: 7,
      durationMin: 50,
      pain: { intensity: 8, bodyRegion: 'Rodilla' },
    });
    const pain = (await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' })).find(
      (a) => a.type === 'pain',
    )!;
    expect(pain.severity).toBe('red');
    expect(pain.message).toContain('Requiere valoración por profesional sanitario');
    const notes = await testDb()
      .db.select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, o.trainer2.actor.userId),
          eq(schema.notifications.type, 'alert_red'),
        ),
      );
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('a resolved alert is not raised again; disabling a rule for a client resolves it', async () => {
    const live = await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' });
    const missed = live.find((a) => a.type === 'missed_in_a_row')!;
    await updateAlertStatus(o.trainer2, missed.id, {
      status: 'resolved',
      note: 'Hablado con el cliente',
    });
    await refreshClientAlerts(o.trainer2, o.clientB);
    expect(
      (await listAlerts(o.trainer2, { clientId: o.clientB, status: 'live' })).some(
        (a) => a.type === 'missed_in_a_row',
      ),
    ).toBe(false);

    await setClientRuleOverride(o.trainer2, o.clientB, {
      ruleKey: 'adherence_low',
      enabled: false,
      reason: 'Lesión fuera del entrenamiento: pausa acordada',
    });
    const after = await listAlerts(o.trainer2, { clientId: o.clientB });
    const adh = after.filter((a) => a.type === 'adherence_low');
    expect(adh.every((a) => a.status === 'resolved')).toBe(true);
    expect(adh[0]!.resolutionNote).toMatch(/automáticamente/);
    await expect(
      setClientRuleOverride(o.clientUser, o.clientA, { ruleKey: 'pain', enabled: false }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('the daily job evaluates every client with an active plan', async () => {
    const r = await monitorAllClients({ db: testDb().db, now: () => new Date() });
    expect(r.clients).toBeGreaterThanOrEqual(2);
  });
});

describe('rule configuration', () => {
  it('ADMIN only, validated, versioned and applied', async () => {
    const rules = await getMonitoringRules(o.trainer2);
    expect(rules.rules.map((r) => r.key)).toContain('pain');
    await expect(
      updateMonitoringRules(o.trainer2, {
        rules: [{ key: 'adherence_low', enabled: true, parameters: { yellowBelow: 90 } }],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      updateMonitoringRules(o.admin, {
        rules: [
          { key: 'adherence_low', enabled: true, parameters: { yellowBelow: 50, redBelow: 70 } },
        ],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    // Client A: 8 sessions done of the 11–12 in the last 28 days (the count depends on the
    // weekday of the run): 66,7–72,7 % → yellow with the defaults.
    await refreshClientAlerts(o.admin, o.clientA);
    const adh = async () =>
      (await listAlerts(o.admin, { clientId: o.clientA, status: 'live' })).find(
        (x) => x.type === 'adherence_low',
      );
    expect((await adh())?.severity).toBe('yellow');
    const [, pct, done, planned] = /Adherencia del ([\d,]+) % .*\((\d+) de (\d+) sesiones\)/.exec(
      (await adh())!.message,
    )!;
    expect(Number(done)).toBe(8);
    expect([11, 12]).toContain(Number(planned));
    expect(pct).toBe(
      (Math.round((Number(done) / Number(planned)) * 1000) / 10).toLocaleString('es-ES'),
    );
    const v = await updateMonitoringRules(o.admin, {
      rules: [
        { key: 'adherence_low', enabled: true, parameters: { yellowBelow: 90, redBelow: 75 } },
      ],
      notes: 'Más exigentes con la constancia',
    });
    expect(v.version).toBe(1);
    const after = await getMonitoringRules(o.admin);
    expect(after.version).toBe(1);
    expect(
      after.rules
        .find((r) => r.key === 'adherence_low')!
        .parameters.find((p) => p.key === 'redBelow')!.value,
    ).toBe(75);
    // Same alert, escalated in place (66,7–72,7 % is below the new 75 %).
    await refreshClientAlerts(o.admin, o.clientA);
    expect((await adh())?.severity).toBe('red');
    expect(
      (await listAlerts(o.admin, { clientId: o.clientA, status: 'live' })).filter(
        (x) => x.type === 'adherence_low',
      ),
    ).toHaveLength(1);
    // Another organization keeps the defaults.
    expect((await getMonitoringRules(other.admin)).version).toBeNull();
  });
});

describe('exercise feedback', () => {
  it('is idempotent through the offline queue and stores pain only with consent', async () => {
    const tpl = (await listPlanTemplates(other.admin)).find((t) => t.slug === 'salud-2d')!;
    const { id } = await createPlanFromTemplate(other.admin, other.clientA, {
      templateId: tpl.id,
      startDate: thisMonday,
      weekdays: [2, 4],
    });
    await setPlanStatus(other.admin, id, { status: 'active' });
    await publishSessions(other.admin, { scope: 'plan', id, published: true });
    const first = weeksOf(await getPlan(other.admin, id))[0]!.sessions[0]!;
    const p = await getPlayerSession(other.clientUser, first.id);
    const se = p.blocks.flatMap((b) => b.exercises)[0]!;
    const m = {
      type: 'exercise_feedback' as const,
      clientMutationId: 'fb_0000000001',
      sessionExerciseId: se.id,
      difficulty: 7,
      pain: 5,
    };
    const r1 = await syncMutations(other.clientUser, { mutations: [m] });
    expect(r1.results[0]!.status).toBe('applied');
    await syncMutations(other.clientUser, { mutations: [m] });
    const rows = await testDb()
      .db.select()
      .from(schema.exerciseFeedback)
      .where(eq(schema.exerciseFeedback.sessionExerciseId, se.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.difficulty).toBe(7);
    expect(rows[0]!.pain).toBeNull();
  });
});
