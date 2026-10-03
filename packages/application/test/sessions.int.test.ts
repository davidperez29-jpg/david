import { schema } from '@tp/db';
import { localDate, PAIN_MESSAGE } from '@tp/domain';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clientAgenda,
  clientSessionReview,
  completeSession,
  createPlanFromTemplate,
  decideSubstitution,
  getPlan,
  getPlayerSession,
  grantConsent,
  listPlanTemplates,
  logSet,
  publishSessions,
  requestSubstitution,
  resolveSetLogReview,
  reviewInbox,
  saveReadiness,
  setPlanStatus,
  syncMutations,
  updateSessionExercise,
  getSession,
  type PlanDetail,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let planId: string;
let firstSessionId: string;
let secondSessionId: string;

const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
const mid = () => `m_${Math.random().toString(36).slice(2, 12)}`;

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  const today = localDate(new Date());
  const r = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: today,
    weekdays: [1, 3, 5],
  });
  planId = r.id;
  const p = await getPlan(o.admin, planId);
  const sessions = weeksOf(p).flatMap((w) => w.sessions);
  firstSessionId = sessions[0]!.id;
  secondSessionId = sessions[1]!.id;
});

describe('publishing', () => {
  it('requires an active plan, and the client only sees published sessions', async () => {
    await expect(
      publishSessions(o.admin, { scope: 'plan', id: planId, published: true }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await setPlanStatus(o.admin, planId, { status: 'active' });
    // Nothing published yet: the client does not see the session.
    await expect(getPlayerSession(o.clientUser, firstSessionId)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect((await clientAgenda(o.clientUser, o.clientA)).sessions).toHaveLength(0);

    const p = await getPlan(o.admin, planId);
    const week1 = weeksOf(p)[0]!;
    const r = await publishSessions(o.admin, { scope: 'week', id: week1.id, published: true });
    expect(r.count).toBe(3);
    const agenda = await clientAgenda(o.clientUser, o.clientA);
    expect(agenda.sessions.length).toBe(3);
    expect(agenda.next?.id).toBe(firstSessionId);
    // Staff of another organization / an unassigned trainer: not found.
    await expect(getPlayerSession(other.admin, firstSessionId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(getPlayerSession(o.trainer2, firstSessionId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      publishSessions(o.clientUser, { scope: 'session', id: firstSessionId, published: false }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('gives the player client texts, preload and no trainer notes', async () => {
    const s = await getPlayerSession(o.clientUser, firstSessionId);
    const ex = s.blocks.flatMap((b) => b.exercises);
    expect(ex.length).toBeGreaterThan(0);
    expect(ex[0]!.clientText.length).toBeGreaterThan(5);
    expect(ex.every((e) => e.coachNotes === null)).toBe(true);
    expect(s.notesForTrainer).toBeNull();
    expect(s.completion.completedSets).toBe(0);
  });
});

describe('logging and offline sync', () => {
  it('logs idempotently by client mutation id', async () => {
    const s = await getPlayerSession(o.clientUser, firstSessionId);
    const e = s.blocks.flatMap((b) => b.exercises)[0]!;
    const id = mid();
    const input = {
      clientMutationId: id,
      sessionId: s.id,
      sessionExerciseId: e.id,
      exerciseId: e.exerciseId,
      setIndex: 1,
      loadKg: 40,
      reps: 10,
      rir: 2,
      downloadedAt: s.downloadedAt,
    };
    const a = await logSet(o.clientUser, input);
    expect(a.status).toBe('applied');
    const b = await logSet(o.clientUser, input);
    expect(b).toMatchObject({ status: 'duplicate', id: a.id });
    await expect(
      logSet(o.clientUser, { ...input, clientMutationId: mid(), rir: 2, rpe: 8 }),
    ).rejects.toMatchObject({ code: 'validation' });
    const rows = await testDb()
      .db.select()
      .from(schema.setLogs)
      .where(eq(schema.setLogs.clientMutationId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.loggedByRole).toBe('client');
  });

  it('replays an offline queue without duplicates and flags conflicts', async () => {
    const s = await getPlayerSession(o.clientUser, firstSessionId);
    const exs = s.blocks.flatMap((b) => b.exercises);
    const e = exs[1] ?? exs[0]!;
    const queue = [1, 2, 3].map((i) => ({
      type: 'set' as const,
      clientMutationId: mid(),
      sessionId: s.id,
      sessionExerciseId: e.id,
      exerciseId: e.exerciseId,
      setIndex: i,
      loadKg: 20,
      reps: 12,
      rir: 2,
      downloadedAt: s.downloadedAt,
    }));
    // While offline, the trainer edits that exercise: logs are kept but flagged for review.
    const full = await getSession(o.admin, s.id);
    const se = full.blocks.flatMap((b) => b.exercises).find((x) => x.id === e.id)!;
    await new Promise((r) => setTimeout(r, 20));
    await updateSessionExercise(o.admin, e.id, {
      expectedVersion: se.version,
      notesForClient: 'Controla la bajada.',
    });
    const r1 = await syncMutations(o.clientUser, {
      mutations: [
        ...queue,
        {
          type: 'set',
          clientMutationId: mid(),
          sessionId: s.id,
          exerciseId: e.exerciseId,
          setIndex: 99,
        },
      ],
    });
    expect(r1.results.map((r) => r.status)).toEqual(['flagged', 'flagged', 'flagged', 'rejected']);
    const r2 = await syncMutations(o.clientUser, { mutations: queue });
    expect(r2.results.every((r) => r.status === 'duplicate')).toBe(true);
    const rows = await testDb()
      .db.select()
      .from(schema.setLogs)
      .where(and(eq(schema.setLogs.sessionId, s.id), eq(schema.setLogs.sessionExerciseId, e.id)));
    expect(rows.filter((r) => r.reps === 12)).toHaveLength(3);
    expect(rows.every((r) => !r.reps || r.reps !== 12 || r.needsReview)).toBe(true);

    // The trainer reviews one flagged log.
    const review = await clientSessionReview(o.admin, o.clientA);
    expect(review.find((x) => x.id === s.id)?.flaggedLogs).toBe(3);
    await resolveSetLogReview(o.admin, rows.find((r) => r.needsReview)!.id, { note: 'OK' });
    const review2 = await clientSessionReview(o.admin, o.clientA);
    expect(review2.find((x) => x.id === s.id)?.flaggedLogs).toBe(2);
  });

  it('room mode: the trainer logs on behalf of the client', async () => {
    const s = await getPlayerSession(o.admin, secondSessionId);
    expect(s.published).toBe(true);
    const e = s.blocks.flatMap((b) => b.exercises)[0]!;
    const r = await logSet(o.admin, {
      clientMutationId: mid(),
      sessionId: s.id,
      sessionExerciseId: e.id,
      exerciseId: e.exerciseId,
      setIndex: 1,
      reps: 8,
      loadKg: 30,
    });
    const [row] = await testDb()
      .db.select()
      .from(schema.setLogs)
      .where(eq(schema.setLogs.id, r.id));
    expect(row!.loggedByRole).toBe('trainer');
    // Correcting the same set updates it instead of duplicating it.
    const again = await logSet(o.admin, {
      clientMutationId: mid(),
      sessionId: s.id,
      sessionExerciseId: e.id,
      exerciseId: e.exerciseId,
      setIndex: 1,
      reps: 9,
      loadKg: 30,
    });
    expect(again.id).toBe(r.id);
  });
});

describe('live substitution', () => {
  it('applies a pre-approved alternative and sends anything else to the trainer', async () => {
    const full = await getSession(o.admin, firstSessionId);
    const se = full.blocks.flatMap((b) => b.exercises)[0]!;
    const other2 = full.blocks
      .flatMap((b) => b.exercises)
      .find((x) => x.exerciseId !== se.exerciseId)!;
    const alt = other2.exerciseId;
    await updateSessionExercise(o.admin, se.id, {
      expectedVersion: se.version,
      alternativeExerciseIds: [alt],
    });
    await expect(
      updateSessionExercise(o.admin, se.id, {
        expectedVersion: se.version + 1,
        alternativeExerciseIds: [se.exerciseId],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    const p = await getPlayerSession(o.clientUser, firstSessionId);
    expect(p.blocks.flatMap((b) => b.exercises)[0]!.alternatives.map((a) => a.id)).toEqual([alt]);

    const ok = await requestSubstitution(o.clientUser, {
      clientMutationId: mid(),
      sessionExerciseId: se.id,
      reason: 'missing_equipment',
      chosenExerciseId: alt,
    });
    expect(ok.status).toBe('approved');

    const notifBefore = await testDb()
      .db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, o.admin.actor.userId));
    const pain = await requestSubstitution(o.clientUser, {
      clientMutationId: mid(),
      sessionExerciseId: se.id,
      reason: 'pain',
      chosenExerciseId: null,
    });
    expect(pain.status).toBe('pending');
    expect(pain.message).toBe(PAIN_MESSAGE);
    const notifAfter = await testDb()
      .db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, o.admin.actor.userId));
    expect(notifAfter.length).toBe(notifBefore.length + 1);
    // Trainer 2 is not assigned to client A: not notified.
    const t2 = await testDb()
      .db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, o.trainer2.actor.userId));
    expect(t2).toHaveLength(0);

    const inbox = await reviewInbox(o.admin);
    const pending = inbox.substitutions.find((x) => x.id === pain.id)!;
    expect(pending.reason).toBe('pain');
    expect(
      (await reviewInbox(other.admin)).substitutions.find((x) => x.id === pain.id),
    ).toBeUndefined();
    await decideSubstitution(o.admin, pain.id, { approve: true, chosenExerciseId: alt });
    expect(
      (await reviewInbox(o.admin)).substitutions.find((x) => x.id === pain.id),
    ).toBeUndefined();
  });

  it('the client cannot call the notify function for another client', async () => {
    const db = testDb().db;
    await expect(
      db.transaction(async (tx) => {
        const { bindActor } = await import('@tp/db');
        await bindActor(tx, o.clientUser.actor);
        await tx.execute(
          (await import('drizzle-orm'))
            .sql`select notify_client_trainers(${o.clientB}::uuid, 'x', 'x', 'x', 'x')`,
        );
      }),
    ).rejects.toThrow();
  });
});

describe('completion, feedback and readiness', () => {
  it('requires a reason when partial and stores pain only with health consent', async () => {
    await expect(completeSession(o.clientUser, firstSessionId, {})).rejects.toMatchObject({
      code: 'validation',
    });
    const r = await completeSession(o.clientUser, firstSessionId, {
      reasonCode: 'fatigue',
      sessionRpe: 7,
      fatigue: 6,
      pain: { intensity: 5, bodyRegion: 'rodilla' },
    });
    expect(r.status).toBe('partial');
    expect(r.painStored).toBe(false);
    expect(r.message).toBe(PAIN_MESSAGE);
    let [fb] = await testDb()
      .db.select()
      .from(schema.feedback)
      .where(eq(schema.feedback.sessionId, firstSessionId));
    expect(Number(fb!.sessionRpe)).toBe(7);
    expect(fb!.pain).toBeNull();

    await grantConsent(o.clientUser, o.clientA, { purpose: 'health_data', method: 'in_app' });
    const r2 = await completeSession(o.clientUser, firstSessionId, {
      reasonCode: 'fatigue',
      sessionRpe: 7,
      pain: { intensity: 5, bodyRegion: 'rodilla' },
    });
    expect(r2.painStored).toBe(true);
    // Replaying the completion does not duplicate pain logs.
    await completeSession(o.clientUser, firstSessionId, {
      reasonCode: 'fatigue',
      pain: { intensity: 5, bodyRegion: 'rodilla' },
    });
    const pains = await testDb()
      .db.select()
      .from(schema.painLogs)
      .where(eq(schema.painLogs.sessionId, firstSessionId));
    expect(pains).toHaveLength(1);
    [fb] = await testDb()
      .db.select()
      .from(schema.feedback)
      .where(eq(schema.feedback.sessionId, firstSessionId));
    expect(fb!.pain).toBe(5);
    const agenda = await clientAgenda(o.clientUser, o.clientA);
    expect(agenda.sessions.find((x) => x.id === firstSessionId)?.attendance).toBe('partial');
    expect(agenda.next?.id).not.toBe(firstSessionId);
  });

  it('saves daily readiness once per day', async () => {
    const day = localDate(new Date());
    await saveReadiness(o.clientUser, o.clientA, { recordedOn: day, energy: 7, sleepHours: 7.5 });
    await saveReadiness(o.clientUser, o.clientA, { recordedOn: day, energy: 8 });
    const rows = await testDb()
      .db.select()
      .from(schema.readiness)
      .where(eq(schema.readiness.clientId, o.clientA));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.energy).toBe(8);
    await expect(
      saveReadiness(o.clientUser, o.clientB, { recordedOn: day, energy: 5 }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
