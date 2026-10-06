import { currentTotp, encrypt, keyRingFromBase64, openSecret, totpAt } from '@tp/auth';
import { schema } from '@tp/db';
import { addDays, localDate } from '@tp/domain';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, getTableName, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addHealthDeclaration,
  applyRetention,
  budgetFor,
  consumeApiBudget,
  beginTotpEnrollment,
  cancelPrivacyRequest,
  changePassword,
  confirmTotpEnrollment,
  createPrivacyRequest,
  eraseClient,
  exportSubjectData,
  getClient,
  getSecurityStatus,
  grantConsent,
  listInjuryCatalog,
  openInjury,
  recordInjurySymptom,
  ENCRYPTED_COLUMNS,
  SUBJECT_EXPORT_EXCLUDED,
  SUBJECT_EXPORT_TABLES,
  listClientPrivacyRequests,
  listPrivacyRequests,
  login,
  MemoryStorage,
  regenerateRecoveryCodes,
  resolvePrivacyRequest,
  resolveSession,
  revokeMySession,
  rotateEncryptedColumns,
  updateClient,
  updatePrivacySettings,
  verifySecondFactor,
} from '../src';
import { appContext, buildOrg, PASSWORD, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
const db = () => testDb().db;
const today = localDate(new Date());

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  const c = await getClient(o.admin, o.clientA);
  await updateClient(o.admin, o.clientA, { phone: '+34 600 111 222', expectedVersion: c.version });
  await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
  await addHealthDeclaration(o.admin, o.clientA, {
    type: 'injury',
    bodyRegion: 'rodilla derecha',
    declaredStatus: 'active',
    description: 'Molestia al bajar escaleras',
  });
  // An injury case (staff-only health data, restructure phase 7) with a symptom that raises an alert.
  const acl = (await listInjuryCatalog(o.admin)).conditions.find((x) => x.slug === 'acl')!;
  const inj = await openInjury(o.admin, o.clientA, {
    conditionId: acl.id,
    protocolId: acl.protocols[0]!.id,
    side: 'right',
    occurredOn: '2026-05-01',
    diagnosis: 'Informe recibido: rotura parcial',
  });
  await recordInjurySymptom(o.admin, o.clientA, inj.id, {
    recordedOn: '2026-05-10',
    pain: 8,
    note: 'Dolor nocturno',
  });
});

describe('access and portability (RGPD arts. 15, 20)', () => {
  it('the client downloads their data as JSON (decrypted, without internal ids), audited and recorded', async () => {
    const f = await exportSubjectData(o.clientUser, o.clientA);
    expect(f.contentType).toMatch(/application\/json/);
    expect(f.fileName).toBe(`mis-datos-${today}.json`);
    const doc = JSON.parse(f.body.toString('utf8'));
    expect(doc.formato).toBe('exportacion-interesado/1');
    expect(doc.cliente).toMatchObject({ firstName: 'Ana', phone: '+34 600 111 222' });
    expect(doc.cliente.organizationId).toBeUndefined();
    expect(doc.declaraciones_de_salud[0]).toMatchObject({
      description: 'Molestia al bajar escaleras',
    });
    expect(doc.consentimientos.length).toBeGreaterThan(0);
    // Staff-only records are the person's data too (art. 15): row security hides them from the
    // client app, not from their own export.
    expect(doc.lesiones[0]).toMatchObject({ diagnosis: 'Informe recibido: rotura parcial' });
    expect(doc.sintomas_de_lesion[0]).toMatchObject({ pain: 8, note: 'Dolor nocturno' });
    expect(doc.avisos_de_lesion.length).toBeGreaterThan(0);
    expect(doc.fases_de_lesion.length).toBeGreaterThan(0);
    expect(Array.isArray(doc.registro_de_actividad)).toBe(true);
    const reqs = await listClientPrivacyRequests(o.clientUser, o.clientA);
    expect(reqs[0]).toMatchObject({ type: 'portability', status: 'completed' });
    const audits = await db()
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityType, 'subject_data'),
          eq(schema.auditLogs.clientId, o.clientA),
        ),
      );
    expect(audits[0]!.action).toBe('export');
  });

  it('covers every table that holds records of a client (or says why not)', async () => {
    const rows = await db().execute<{ table_name: string }>(
      sql`select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'client_id' order by 1`,
    );
    const covered = new Set([...SUBJECT_EXPORT_TABLES, ...Object.keys(SUBJECT_EXPORT_EXCLUDED)]);
    const missing = [...rows].map((r) => r.table_name).filter((t) => !covered.has(t));
    expect(missing).toEqual([]);
  });

  it('nobody else exports it: trainers (§14.2), other clients, other organizations', async () => {
    await expect(exportSubjectData(o.trainer2, o.clientA)).rejects.toMatchObject({
      code: expect.stringMatching(/^(forbidden|not_found)$/),
    });
    await expect(exportSubjectData(o.clientUser, o.clientB)).rejects.toMatchObject({
      code: expect.stringMatching(/^(forbidden|not_found)$/),
    });
    await expect(exportSubjectData(other.admin, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    // ADMIN of the organization can (e.g. to answer an access request).
    expect((await exportSubjectData(o.admin, o.clientA)).body.length).toBeGreaterThan(100);
  });
});

describe('rights requests with the one-month deadline', () => {
  it('the client files requests; ADMIN resolves them; erasure cannot be closed before erasing', async () => {
    const r = await createPrivacyRequest(o.clientUser, o.clientA, {
      type: 'erasure',
      details: 'Me doy de baja.',
    });
    expect(r.dueOn).toBe(
      (() => {
        const [y, m, d] = today.split('-').map(Number) as [number, number, number];
        const ny = m === 12 ? y + 1 : y;
        const nm = m === 12 ? 1 : m + 1;
        const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
        return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
      })(),
    );
    await expect(
      createPrivacyRequest(o.clientUser, o.clientA, { type: 'erasure' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const rect = await createPrivacyRequest(o.clientUser, o.clientA, {
      type: 'rectification',
      details: 'Mi apellido está mal.',
    });
    await cancelPrivacyRequest(o.clientUser, rect.id);
    const inbox = await listPrivacyRequests(o.admin);
    expect(inbox[0]).toMatchObject({
      id: r.id,
      status: 'pending',
      overdue: false,
      type: 'erasure',
    });
    await expect(listPrivacyRequests(o.trainer2)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      resolvePrivacyRequest(o.admin, r.id, { status: 'completed', response: 'Hecho.' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('erasure (art. 17): anonymization in place with double confirmation', () => {
  it('only ADMIN, typing the full name; health data, account and identifiers go; training data stay', async () => {
    await expect(
      eraseClient(o.trainer2, o.clientA, { confirmation: 'x', reason: 'Solicitud' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      eraseClient(o.admin, o.clientA, {
        confirmation: 'Ana Alguien',
        reason: 'Solicitud del interesado',
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    const auditBefore = await db()
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.clientId, o.clientA));
    const r = await eraseClient(o.admin, o.clientA, {
      confirmation: `ana alpha ${o.tag}`,
      reason: 'Solicitud del interesado',
    });
    expect(r.redactedAuditEntries).toBeGreaterThan(0);

    const [c] = await db().select().from(schema.clients).where(eq(schema.clients.id, o.clientA));
    expect(c).toMatchObject({
      firstName: 'Cliente',
      email: null,
      phoneEnc: null,
      birthDate: '1995-01-01',
      status: 'archived',
    });
    expect(c!.anonymizedAt).not.toBeNull();
    expect(
      await db()
        .select()
        .from(schema.healthDeclarations)
        .where(eq(schema.healthDeclarations.clientId, o.clientA)),
    ).toEqual([]);
    // Injury cases go with everything under them (phases, symptoms, alerts, decisions).
    for (const t of [
      schema.injuries,
      schema.injurySymptoms,
      schema.injuryAlerts,
      schema.injuryPhaseHistory,
      schema.decisionRuns,
      schema.clientTraitFlags,
    ])
      expect(await db().select().from(t).where(eq(t.clientId, o.clientA))).toEqual([]);
    // The account is closed: no login, no sessions.
    await expect(
      login(appContext(), { email: `ana-${o.tag}@example.com`, password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    // Audit: same entries (who/when/what), values and reasons redacted; a new anonymize entry.
    const after = await db()
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.clientId, o.clientA));
    expect(after.length).toBe(auditBefore.length + 1);
    const redacted = after.filter((a) => a.action !== 'anonymize' && a.changes != null);
    expect(redacted.every((a) => JSON.stringify(a.changes).includes('suprimido'))).toBe(true);
    expect(JSON.stringify(after)).not.toMatch(/escaleras|600 111|Ana/);
    // The pending erasure request is closed by the erasure.
    const reqs = await listPrivacyRequests(o.admin);
    expect(reqs.find((x) => x.type === 'erasure')).toMatchObject({
      status: 'completed',
      anonymized: true,
    });
    await expect(
      eraseClient(o.admin, o.clientA, {
        confirmation: `${c!.firstName} ${c!.lastName}`,
        reason: 'otra vez',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('the audit trail stays append-only for everything else', async () => {
    const cause = async (q: Promise<unknown>) => {
      try {
        await q;
        return 'no error';
      } catch (e) {
        return String((e as { cause?: Error }).cause?.message ?? e);
      }
    };
    expect(
      await cause(
        db().execute(sql`UPDATE audit_logs SET action = 'x' WHERE client_id = ${o.clientA}`),
      ),
    ).toMatch(/append-only/);
    expect(
      await cause(db().execute(sql`DELETE FROM audit_logs WHERE client_id = ${o.clientA}`)),
    ).toMatch(/append-only/);
  });
});

describe('retention (controller decides; anonymization when it ends) and minimization', () => {
  it('no automatic anonymization until a period is set; then archived clients past it are anonymized', async () => {
    await db()
      .update(schema.clients)
      .set({ status: 'archived', archivedAt: new Date(Date.now() - 400 * 86_400_000) })
      .where(eq(schema.clients.id, o.clientB));
    const app = { db: db(), now: () => new Date(), storage: new MemoryStorage() };
    expect((await applyRetention(app)).anonymized).toBe(0);
    await expect(
      updatePrivacySettings(o.trainer2, { retentionMonths: 12, requireAdmin2fa: true }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await updatePrivacySettings(o.admin, { retentionMonths: 12, requireAdmin2fa: true });
    const r = await applyRetention(app);
    expect(r.anonymized).toBe(1);
    const [b] = await db().select().from(schema.clients).where(eq(schema.clients.id, o.clientB));
    expect(b!.anonymizedAt).not.toBeNull();
    expect((await applyRetention(app)).anonymized).toBe(0);
  });
});

describe('key rotation', () => {
  it('rotates every encrypted column of the schema (none left behind)', async () => {
    const rows = await db().execute<{ c: string }>(
      sql`select table_name || '.' || column_name as c from information_schema.columns
           where table_schema = 'public' and column_name like '%\\_enc' order by 1`,
    );
    const listed = ENCRYPTED_COLUMNS.map(([t, , col]) => `${getTableName(t)}.${col.name}`).sort();
    expect([...rows].map((r) => r.c)).toEqual(listed);
  });

  it('re-encrypts values written with the old key; afterwards the old key is not needed', async () => {
    const oldMaster = randomBytes(32).toString('base64');
    const newMaster = randomBytes(32).toString('base64');
    const fresh = await buildOrg();
    await db()
      .update(schema.clients)
      .set({ phoneEnc: encrypt(keyRingFromBase64(oldMaster).encryptionKey, '+34 699 000 000') })
      .where(eq(schema.clients.id, fresh.clientA));
    const ring = keyRingFromBase64(newMaster, oldMaster);
    const r = await rotateEncryptedColumns({ db: db(), keys: ring });
    expect(r.rotated).toBeGreaterThanOrEqual(1);
    const [c] = await db()
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, fresh.clientA));
    expect(openSecret(keyRingFromBase64(newMaster), c!.phoneEnc!)).toBe('+34 699 000 000');
    // A value no configured key opens is reported, never overwritten.
    await db()
      .update(schema.clients)
      .set({ phoneEnc: encrypt(randomBytes(32), 'x') })
      .where(eq(schema.clients.id, fresh.clientB));
    expect(
      (await rotateEncryptedColumns({ db: db(), keys: ring })).unreadable,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('authentication hardening', () => {
  it('2FA recovery codes: shown once, single use, regenerated only with a TOTP code', async () => {
    const fresh = await buildOrg();
    const { secret } = await beginTotpEnrollment(fresh.admin);
    const { recoveryCodes } = await confirmTotpEnrollment(fresh.admin, currentTotp(secret));
    expect(recoveryCodes).toHaveLength(10);
    const stored = await db()
      .select()
      .from(schema.userRecoveryCodes)
      .where(eq(schema.userRecoveryCodes.userId, fresh.admin.actor.userId));
    expect(stored.map((x) => x.codeHash)).not.toContain(recoveryCodes[0]);
    const ctx = appContext();
    const first = await login(ctx, { email: `admin-${fresh.tag}@example.com`, password: PASSWORD });
    await verifySecondFactor(ctx, first.token, recoveryCodes[0]!.toLowerCase());
    expect((await resolveSession(ctx, first.token)).status).toBe('authenticated');
    const second = await login(ctx, {
      email: `admin-${fresh.tag}@example.com`,
      password: PASSWORD,
    });
    await expect(verifySecondFactor(ctx, second.token, recoveryCodes[0]!)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect((await getSecurityStatus(fresh.admin)).recoveryCodesLeft).toBe(9);
    await expect(regenerateRecoveryCodes(fresh.admin, '000000')).rejects.toMatchObject({
      code: 'validation',
    });
    const later = Date.now() + 30_000;
    const again = await regenerateRecoveryCodes(
      { ...fresh.admin, now: () => new Date(later) },
      totpAt(secret, later),
    );
    expect(again.recoveryCodes).toHaveLength(10);
    expect((await getSecurityStatus(fresh.admin)).recoveryCodesLeft).toBe(10);
  });

  it('sessions: listed and closable from settings; ADMIN without 2FA is flagged', async () => {
    const fresh = await buildOrg();
    const ctx = appContext();
    const a = await login(ctx, { email: `admin-${fresh.tag}@example.com`, password: PASSWORD });
    const b = await login(ctx, { email: `admin-${fresh.tag}@example.com`, password: PASSWORD });
    const sa = await resolveSession(ctx, a.token);
    if (sa.status !== 'authenticated') throw new Error('no session');
    const st = await getSecurityStatus(fresh.admin, sa.sessionId);
    expect(st.twoFactorRequired).toBe(true);
    expect(st.sessions.length).toBeGreaterThanOrEqual(2);
    expect(st.sessions.filter((x) => x.current)).toHaveLength(1);
    const otherSession = st.sessions.find((x) => !x.current)!;
    await revokeMySession(fresh.admin, otherSession.id);
    expect((await resolveSession(ctx, b.token)).status).toBe('anonymous');
    await expect(revokeMySession(fresh.clientUser, sa.sessionId)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('breached passwords are refused when the k-anonymity check is configured', async () => {
    const fresh = await buildOrg();
    const leaked = 'tortilla-de-patatas-2026';
    const sha = createHash('sha1').update(leaked).digest('hex').toUpperCase();
    const ctx = { ...fresh.admin, pwnedPasswords: async () => `${sha.slice(5)}:12\r\n` };
    await expect(
      changePassword(ctx, { currentPassword: PASSWORD, newPassword: leaked }, 'x'),
    ).rejects.toMatchObject({ code: 'validation', details: { password: ['breached'] } });
    // Without network the check fails open (only the local policy applies).
    const offline = {
      ...fresh.admin,
      pwnedPasswords: async () => Promise.reject(new Error('offline')),
    };
    await changePassword(offline, { currentPassword: PASSWORD, newPassword: leaked }, 'x');
  });
});
void addDays;

describe('per-user API budgets (Phase 15)', () => {
  it('counts per user and minute, refuses beyond the limit and tells when to retry', async () => {
    const fresh = await buildOrg();
    process.env.API_LIMIT_HEAVY = '3';
    try {
      const at = new Date('2026-10-05T10:00:20Z');
      const app = { db: db(), now: () => at };
      const userId = fresh.admin.actor.userId;
      const results = [];
      for (let i = 0; i < 4; i++) results.push(await consumeApiBudget(app, userId, 'heavy'));
      expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
      expect(results[3]).toMatchObject({ limit: 3, remaining: 0, retryAfter: 40 });
      // Another user and another budget are independent; the next minute starts again.
      expect((await consumeApiBudget(app, fresh.trainer2.actor.userId, 'heavy')).allowed).toBe(
        true,
      );
      expect((await consumeApiBudget(app, userId, 'write')).allowed).toBe(true);
      const later = { db: db(), now: () => new Date('2026-10-05T10:01:01Z') };
      expect((await consumeApiBudget(later, userId, 'heavy')).allowed).toBe(true);
    } finally {
      delete process.env.API_LIMIT_HEAVY;
    }
  });

  it('classifies requests: exports, downloads and imports are heavy; GET reads; the rest writes', () => {
    expect(budgetFor('GET', '/api/v1/exports')).toBe('heavy');
    expect(budgetFor('GET', '/api/v1/clients/x/subject-data')).toBe('heavy');
    expect(budgetFor('POST', '/api/v1/imports')).toBe('heavy');
    expect(budgetFor('GET', '/api/v1/imports')).toBe('read');
    expect(budgetFor('GET', '/api/v1/clients')).toBe('read');
    expect(budgetFor('PATCH', '/api/v1/clients/x')).toBe('write');
  });
});
