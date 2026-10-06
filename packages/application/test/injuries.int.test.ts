import { schema } from '@tp/db';
import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceInjuryPhase,
  checkInjuryCriterion,
  closeInjury,
  encryptInjuryText,
  generateClientReport,
  getClientReport,
  createAssessment,
  getInjury,
  grantConsent,
  injuryComparison,
  listAssessmentTests,
  listClientInjuries,
  listInjuryCatalog,
  openInjury,
  recordAssessmentResult,
  recordInjurySymptom,
  recordRtpDecision,
  requestInjuryDecision,
  reviewInjuryAlert,
  type AssessmentTestSummary,
} from '../src';
import { appContext, buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let tests: AssessmentTestSummary[];
let catalog: Awaited<ReturnType<typeof listInjuryCatalog>>;
let injuryId: string;
const t = (slug: string) => tests.find((x) => x.slug === slug)!;
const acl = () => catalog.conditions.find((c) => c.slug === 'acl')!;

async function measure(date: string, left: number, right: number, extra = false) {
  const ids = [t('knee_extensor_isometric').id, ...(extra ? [t('cmj_height').id] : [])];
  const a = await createAssessment(o.admin, o.clientA, { assessedOn: date, testIds: ids });
  for (const [side, v] of [
    ['left', left],
    ['right', right],
  ] as const)
    await recordAssessmentResult(o.admin, a.id, {
      testId: t('knee_extensor_isometric').id,
      side,
      attempts: [v],
    });
  if (extra)
    await recordAssessmentResult(o.admin, a.id, { testId: t('cmj_height').id, attempts: [30] });
  return a.id;
}

beforeAll(async () => {
  o = await buildOrg();
  [tests, catalog] = await Promise.all([listAssessmentTests(o.admin), listInjuryCatalog(o.admin)]);
});

describe('injury module (restructure phase 7)', () => {
  it('lists the catalogue: six conditions, each with a protocol', () => {
    expect(catalog.conditions.length).toBeGreaterThanOrEqual(6);
    expect(acl().protocols.length).toBe(1);
    expect(acl().regionLabel).toBe('Rodilla');
  });

  it('requires the explicit health-data consent to open a case', async () => {
    await expect(
      openInjury(o.admin, o.clientA, { conditionId: acl().id, occurredOn: '2026-05-01' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('opens a case on the first phase; the diagnosis is stored encrypted', async () => {
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    // Baseline before the injury (the comparison uses it).
    await measure('2026-04-20', 500, 510, true);
    const r = await openInjury(o.admin, o.clientA, {
      conditionId: acl().id,
      protocolId: acl().protocols[0]!.id,
      side: 'right',
      occurredOn: '2026-05-01',
      diagnosis: 'Información del traumatólogo: plastia HTH',
      professional: 'Traumatología',
    });
    injuryId = r.id;
    const [raw] = await testDb()
      .db.select({ d: schema.injuries.diagnosisEnc })
      .from(schema.injuries)
      .where(eq(schema.injuries.id, injuryId));
    expect(raw!.d).not.toContain('plastia');
    const c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.diagnosis).toContain('plastia');
    expect(c.phase!.number).toBe(1);
    expect(c.status).toBe('in_progress');
    expect(c.canAdvance.allowed).toBe(false);
    expect(c.history).toHaveLength(1);
  });

  it('advances only when the mandatory criteria are met and the trainer presses it', async () => {
    let c = await getInjury(o.admin, o.clientA, injuryId);
    const progression = c.phase!.criteria.filter((k) => k.role === 'progression' && k.mandatory);
    await checkInjuryCriterion(o.admin, o.clientA, injuryId, {
      criterionId: progression[0]!.id,
      met: true,
    });
    c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.status).toBe('partial');
    await expect(
      advanceInjuryPhase(o.admin, o.clientA, injuryId, { fromPhaseId: c.phase!.id }),
    ).rejects.toMatchObject({ code: 'conflict' });
    for (const k of progression.slice(1))
      await checkInjuryCriterion(o.admin, o.clientA, injuryId, { criterionId: k.id, met: true });
    c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.canAdvance).toEqual({ allowed: true, reasons: [] });
    // Never moved by itself: still phase 1 until [Avanzar de fase].
    expect(c.phase!.number).toBe(1);
  });

  it('a safety alert blocks advancing until a person reviews it', async () => {
    const s = await recordInjurySymptom(o.admin, o.clientA, injuryId, {
      recordedOn: '2026-06-01',
      pain: 7,
      note: 'Molestia tras la sesión',
    });
    expect(s.alerts.map((a) => a.kind)).toContain('pain_high');
    let c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.canAdvance.allowed).toBe(false);
    expect(c.canAdvance.reasons.join(' ')).toMatch(/Revisar antes de progresar/);
    await expect(
      advanceInjuryPhase(o.admin, o.clientA, injuryId, { fromPhaseId: c.phase!.id }),
    ).rejects.toMatchObject({ code: 'conflict' });
    for (const a of c.alerts)
      await reviewInjuryAlert(o.admin, o.clientA, injuryId, a.id, {
        note: 'Valorado con fisioterapia: carga reducida dos días.',
      });
    c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.canAdvance.allowed).toBe(true);
    const next = await advanceInjuryPhase(o.admin, o.clientA, injuryId, {
      fromPhaseId: c.phase!.id,
    });
    expect(next.number).toBe(2);
    // A stale page cannot advance twice.
    await expect(
      advanceInjuryPhase(o.admin, o.clientA, injuryId, { fromPhaseId: c.phase!.id }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('evaluates automatic LSI criteria from assessments after the injury (injured side)', async () => {
    await measure('2026-06-15', 500, 300); // right (injured) 60 %
    let c = await getInjury(o.admin, o.clientA, injuryId);
    const lsi = c.phase!.criteria.find((k) => k.auto?.metric === 'lsi')!;
    expect(lsi.state).toMatchObject({ met: false, value: 60, source: 'auto' });
    await measure('2026-07-01', 500, 400); // 80 %
    c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.phase!.criteria.find((k) => k.id === lsi.id)!.state).toMatchObject({
      met: true,
      value: 80,
    });
  });

  it('the comparison shows only the protocol variables, with baseline and phases', async () => {
    // Measured today: it falls in phase 2 (advanced today).
    await measure(new Date().toISOString().slice(0, 10), 500, 400);
    const cmp = await injuryComparison(o.admin, o.clientA, injuryId, {});
    expect(cmp.rows.map((r) => r.slug)).toEqual(['knee_extensor_isometric']);
    expect(cmp.columns[0]).toMatchObject({ label: 'Antes de la lesión', date: '2026-04-20' });
    expect(cmp.columns.at(-1)!.phase).toBe('Fuerza básica y control');
    const row = cmp.rows[0]!;
    expect(row.lsiB).toBe(80);
    expect(row.b).toBe(400); // the injured side
  });

  it('the return-to-sport decision is human, named and free of «apto»', async () => {
    await expect(requestInjuryDecision(o.admin, o.clientA, injuryId)).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(
      recordRtpDecision(o.admin, o.clientA, injuryId, {
        stage: 'return_to_sport',
        outcome: 'authorized',
        decidedByName: 'Dra. Ejemplo',
        decidedByRole: 'Medicina deportiva',
        decidedOn: '2026-07-02',
        rationale: 'Está apto para competir',
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await recordRtpDecision(o.admin, o.clientA, injuryId, {
      stage: 'return_to_participation',
      outcome: 'not_yet',
      decidedByName: 'Dra. Ejemplo',
      decidedByRole: 'Medicina deportiva',
      decidedOn: '2026-07-02',
      rationale: 'Continuar con la fase de fuerza.',
    });
    const c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.decisions[0]!.outcomeLabel).toBe('Todavía no');
    expect(c.checklist.find((i) => i.item === 'team_assessment')!.status).toBe('pending');
    expect(JSON.stringify(c)).not.toMatch(/\bapt[oa]\b/iu);
  });

  it('is staff-only health data: other trainers and the client app cannot read it', async () => {
    await expect(listClientInjuries(o.trainer2, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(getInjury(o.clientUser, o.clientA, injuryId)).rejects.toMatchObject({
      code: 'not_found',
    });
    const list = await listClientInjuries(o.admin, o.clientA);
    expect(list.items[0]).toMatchObject({ status: 'partial', phaseNumber: 2 });
    const audits = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, injuryId));
    expect(audits.some((a) => a.action === 'view_sensitive')).toBe(true);
  });

  it('the RTP report freezes the case: phase, criteria, protocol variables, decisions', async () => {
    const r = await generateClientReport(o.admin, o.clientA, { kind: 'rtp' });
    const rep = (await getClientReport(o.admin, r.id)).report;
    expect(rep.sections.map((x) => x.key)).toContain('criterios');
    const text = JSON.stringify(rep);
    expect(text).toContain('Ligamento cruzado anterior');
    expect(text).toContain('Fuerza básica y control');
    expect(text).toContain('80 %');
    expect(text).toContain('Vuelta a la participación: todavía no');
    expect(text).toContain('Listo para valoración');
    expect(text).not.toMatch(/\bapt[oa]\b/iu);
    expect(text).not.toContain('plastia'); // the diagnosis received stays out of the report
  });

  it('closes the case', async () => {
    await closeInjury(o.admin, o.clientA, injuryId, {});
    const c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.status).toBe('closed');
    expect(c.statusLabel).toBe('Cerrado');
    await expect(
      recordInjurySymptom(o.admin, o.clientA, injuryId, { recordedOn: '2026-08-01', pain: 1 }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('free text encrypted at rest (restructure phase 11, DPIA R-11)', () => {
  it('stores no injury free text in clear; the case still reads it', async () => {
    const db = testDb().db;
    const raw = JSON.stringify(
      await Promise.all(
        [
          schema.injuries,
          schema.injuryPhaseHistory,
          schema.injuryAlerts,
          schema.injuryCriterionChecks,
          schema.rtpDecisions,
          schema.injurySymptoms,
        ].map((t) => db.select().from(t).where(eq(t.clientId, o.clientA))),
      ),
    );
    for (const text of ['plastia', 'Traumatología', 'fisioterapia', 'fase de fuerza'])
      expect(raw).not.toContain(text);
    const c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.professional).toBe('Traumatología');
    expect(c.alerts.some((a) => a.reviewNote?.includes('fisioterapia'))).toBe(true);
    expect(c.decisions.some((d) => d.rationale === 'Continuar con la fase de fuerza.')).toBe(true);
  });

  it('moves text written before encryption into the encrypted columns (idempotent)', async () => {
    const db = testDb().db;
    // A case as it was stored before phase 11: plaintext columns, no encrypted value.
    await db.execute(sql`update injuries
      set mechanism = 'Caída en el entrenamiento', mechanism_enc = null,
          notes = 'Nota antigua', notes_enc = null
      where id = ${injuryId}`);
    await db.execute(sql`update rtp_decisions set rationale = 'Motivo antiguo', rationale_enc = null
      where injury_id = ${injuryId}`);
    // Readable before the move (fallback to the legacy column).
    let c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.mechanism).toBe('Caída en el entrenamiento');
    const app = appContext();
    expect((await encryptInjuryText(app)).moved).toBeGreaterThanOrEqual(3);
    const [row] = await db.select().from(schema.injuries).where(eq(schema.injuries.id, injuryId));
    expect(row!.mechanismPlain).toBeNull();
    expect(row!.notesPlain).toBeNull();
    expect(row!.mechanismEnc).not.toContain('Caída');
    c = await getInjury(o.admin, o.clientA, injuryId);
    expect(c.mechanism).toBe('Caída en el entrenamiento');
    expect(c.notes).toBe('Nota antigua');
    expect(c.decisions.every((d) => d.rationale === 'Motivo antiguo')).toBe(true);
    const [left] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.injuries)
      .where(eq(schema.injuries.id, injuryId));
    expect(left!.n).toBe(1);
    // Nothing left to move for this case.
    const again = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from injuries where id = ${injuryId}
            and (mechanism is not null or notes is not null)`,
    );
    expect([...again][0]!.n).toBe(0);
  });
});
