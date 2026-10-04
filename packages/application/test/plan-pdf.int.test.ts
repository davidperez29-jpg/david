import { schema } from '@tp/db';
import { localDate } from '@tp/domain';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPlanFromTemplate,
  downloadPlanPdf,
  getPlan,
  getSession,
  listPlanTemplates,
  planPrintInput,
  publishSessions,
  setPlanStatus,
  updateSession,
  updateSessionExercise,
  type PlanDetail,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let planId: string;
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  planId = (
    await createPlanFromTemplate(o.admin, o.clientA, {
      templateId: tpl.id,
      startDate: localDate(new Date()),
      weekdays: [1, 3, 5],
    })
  ).id;
  const p = await getPlan(o.admin, planId);
  const first = weeksOf(p)[0]!.sessions[0]!;
  await updateSession(o.admin, first.id, {
    expectedVersion: (await getSession(o.admin, first.id)).version,
    notesForTrainer: 'Vigilar la rodilla izquierda',
    notesForClient: 'Llega con tiempo para calentar',
  });
  const s = await getSession(o.admin, first.id);
  const ex = s.blocks.flatMap((b) => b.exercises)[0]!;
  await updateSessionExercise(o.admin, ex.id, {
    expectedVersion: ex.version,
    coachNotes: 'Corregir la profundidad',
    notesForClient: 'Baja controlando',
  });
});

describe('plan PDF: team version and client version', () => {
  it('team version: every week and session, technical prescription and internal notes', async () => {
    const i = await planPrintInput(o.admin, planId, 'staff');
    const p = await getPlan(o.admin, planId);
    expect(i.weeks).toHaveLength(weeksOf(p).length);
    expect(i.weeks[0]!.sessions).toHaveLength(3);
    const text = JSON.stringify(i);
    expect(text).toMatch(/Vigilar la rodilla izquierda/);
    expect(text).toMatch(/Corregir la profundidad/);
    expect(text).toMatch(/\d+×\d+/);
    const f = await downloadPlanPdf(o.admin, planId, null);
    expect(f.fileName).toMatch(/\.equipo\.pdf$/);
    expect(f.body.subarray(0, 5).toString()).toBe('%PDF-');
    // The trainer can also print the client's version.
    const c = await planPrintInput(o.admin, planId, 'client');
    expect(JSON.stringify(c)).not.toMatch(/Vigilar la rodilla|Corregir la profundidad/);
    expect(JSON.stringify(c)).toMatch(/Baja controlando/);
    await expect(downloadPlanPdf(o.admin, planId, 'otra')).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('the client: only their active plan, only published sessions, plain language, no internal notes', async () => {
    // A draft plan is not the client's to download.
    await expect(downloadPlanPdf(o.clientUser, planId, null)).rejects.toMatchObject({
      code: 'not_found',
    });
    await setPlanStatus(o.admin, planId, { status: 'active' });
    const week1 = weeksOf(await getPlan(o.admin, planId))[0]!;
    await publishSessions(o.admin, { scope: 'week', id: week1.id, published: true });

    const i = await planPrintInput(o.clientUser, planId, 'client');
    expect(i.weeks[0]!.sessions).toHaveLength(3);
    expect(i.weeks.slice(1).every((w) => w.sessions.length === 0)).toBe(true);
    const text = JSON.stringify(i);
    expect(text).not.toMatch(/Vigilar la rodilla|Corregir la profundidad/);
    expect(text).toMatch(/Llega con tiempo para calentar/);
    expect(text).toMatch(/series de/);
    // Even asking for the team version, a client gets theirs.
    const f = await downloadPlanPdf(o.clientUser, planId, 'staff');
    expect(f.fileName).not.toMatch(/\.equipo\.pdf$/);
    const audits = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, planId), eq(schema.auditLogs.action, 'export')));
    expect(audits.map((a) => (a.changes as { version: string }).version).sort()).toEqual([
      'client',
      'staff',
    ]);
  });

  it('outsiders get not_found', async () => {
    for (const actor of [o.trainer2, other.admin])
      await expect(downloadPlanPdf(actor, planId, null)).rejects.toMatchObject({
        code: 'not_found',
      });
  });
});
