import { beforeAll, describe, expect, it } from 'vitest';
import {
  addHealthDeclaration,
  clearHealthDeclaration,
  getClient,
  grantConsent,
  listClientAudit,
  listConsents,
  listHealthDeclarations,
  recordScreening,
  revokeConsent,
} from '../src';
import { appContext, buildOrg, testDb } from './fixtures';
import { schema } from '@tp/db';
import { eq, sql } from 'drizzle-orm';

let o: Awaited<ReturnType<typeof buildOrg>>;
beforeAll(async () => {
  o = await buildOrg();
});

describe('health data & consent (RGPD art. 9)', () => {
  it('refuses to store health data without explicit consent', async () => {
    await expect(
      addHealthDeclaration(o.admin, o.clientA, { type: 'injury', bodyRegion: 'rodilla' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('staff cannot fake in-app consent; the client can give it in-app', async () => {
    await expect(
      grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'in_app' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      grantConsent(o.clientUser, o.clientA, { purpose: 'health_data', method: 'paper' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await grantConsent(o.clientUser, o.clientA, { purpose: 'health_data', method: 'in_app' });
    const c = await listConsents(o.admin, o.clientA);
    expect(c.status.find((s) => s.purpose === 'health_data')!.active).toBe(true);
  });

  it('stores declarations encrypted, flags referral and audits sensitive reads', async () => {
    const { id } = await addHealthDeclaration(o.admin, o.clientA, {
      type: 'injury',
      bodyRegion: 'rodilla derecha',
      declaredStatus: 'active',
      requiresProfessionalAssessment: true,
      description: 'Molestia al bajar escaleras',
    });
    const [raw] = await testDb()
      .db.select()
      .from(schema.healthDeclarations)
      .where(eq(schema.healthDeclarations.id, id));
    expect(raw!.descriptionEnc).not.toContain('escaleras');

    const detail = await getClient(o.admin, o.clientA);
    expect(detail.referral).toEqual({
      required: true,
      text: 'Requiere valoración por profesional sanitario.',
    });

    const h = await listHealthDeclarations(o.admin, o.clientA);
    expect(h.declarations[0]!.description).toBe('Molestia al bajar escaleras');
    const audit = await listClientAudit(o.admin, o.clientA);
    expect(audit.some((a) => a.action === 'view_sensitive')).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('escaleras');

    await clearHealthDeclaration(o.admin, o.clientA, id, {
      note: 'Alta de fisioterapia aportada por el cliente',
    });
    expect((await getClient(o.admin, o.clientA)).referral.required).toBe(false);
  });

  it('a screening with result "refer" raises the referral banner', async () => {
    await recordScreening(o.admin, o.clientA, {
      questionnaire: 'PAR-Q+',
      questionnaireVersion: '2023',
      result: 'refer',
      completedOn: '2026-10-01',
    });
    expect((await getClient(o.clientUser, o.clientA)).referral.required).toBe(true);
    await recordScreening(o.admin, o.clientA, {
      questionnaire: 'PAR-Q+',
      questionnaireVersion: '2023',
      result: 'clear',
      completedOn: '2026-10-02',
    });
    expect((await getClient(o.clientUser, o.clientA)).referral.required).toBe(false);
  });

  it('revoking health consent blocks new health records', async () => {
    await revokeConsent(o.clientUser, o.clientA, 'health_data');
    await expect(addHealthDeclaration(o.admin, o.clientA, { type: 'other' })).rejects.toMatchObject(
      { code: 'conflict' },
    );
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    await addHealthDeclaration(o.admin, o.clientA, { type: 'other' });
  });
});

describe('audit trail', () => {
  it('is append-only at database level', async () => {
    const db = appContext().db;
    const cause = (e: unknown) =>
      String((e as { cause?: { message?: string } }).cause?.message ?? e);
    expect(
      cause(await db.execute(sql`UPDATE audit_logs SET action = 'tampered'`).catch((e) => e)),
    ).toMatch(/append-only/);
    expect(cause(await db.execute(sql`DELETE FROM audit_logs`).catch((e) => e))).toMatch(
      /append-only/,
    );
  });
});

describe('referral list', () => {
  it('lists only clients in scope needing referral', async () => {
    const { listClientsNeedingReferral } = await import('../src');
    await recordScreening(o.admin, o.clientA, {
      questionnaire: 'PAR-Q+',
      result: 'refer',
      completedOn: '2026-10-03',
    });
    const forAdmin = await listClientsNeedingReferral(o.admin);
    expect(forAdmin.map((c) => c.id)).toContain(o.clientA);
    const forTrainer2 = await listClientsNeedingReferral(o.trainer2);
    expect(forTrainer2.map((c) => c.id)).not.toContain(o.clientA);
  });
});
