/**
 * Data-subject rights and retention (Phase 13, RGPD arts. 12–21; MASTER_SPECIFICATION §14.4).
 *
 * - Access/portability: a structured JSON with every record of the client the actor may read
 *   (the client sees their own data; ADMIN, everything), decrypted, audited as an export.
 * - Requests: the client files them in the app with a one-month due date; ADMIN resolves them.
 * - Erasure: ADMIN-only with double confirmation. Personal data are deleted or replaced in place
 *   (anonymization): free text and health data are removed, the account is closed, files are
 *   deleted, the audit trail of the client is redacted (who/when stays). Training data stay as
 *   anonymous aggregates linked to a pseudonymous id.
 * - Retention: archived clients are anonymized automatically once the period the controller set
 *   expires (no default: [REQUIERE VALIDACIÓN LEGAL]); expired security records are purged.
 */
import { openSecret, encrypt, openSecretWithKey } from '@tp/auth';
import {
  eraseClientSchema,
  privacyRequestSchema,
  privacySettingsSchema,
  resolvePrivacyRequestSchema,
} from '@tp/contracts';
import { schema, type Database } from '@tp/db';
import {
  anonymizedClientFields,
  DomainError,
  localDate,
  privacyDueOn,
  retentionExpired,
} from '@tp/domain';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { AppContext, RequestContext } from './context';
import type { FileOut } from './reports';
import { secured } from './rls';
import { parse } from './validation';

const s = schema;

// ── Access and portability ────────────────────────────────────────────────────

/** Sections of the subject export: every table that holds records of the client. */
const SECTIONS: [string, PgTable][] = [
  ['perfil_de_entrenamiento', s.clientTrainingProfiles],
  ['disponibilidad', s.clientAvailability],
  ['material', s.clientEquipment],
  ['objetivos', s.clientGoals],
  ['historial', s.clientHistoryEntries],
  ['declaraciones_de_salud', s.healthDeclarations],
  ['cribados', s.screeningResponses],
  ['consentimientos', s.consents],
  ['evaluaciones', s.assessments],
  ['resultados_de_evaluacion', s.assessmentResults],
  ['metricas_derivadas', s.derivedMetrics],
  ['planes', s.trainingPlans],
  ['sesiones', s.sessions],
  ['ejercicios_prescritos', s.sessionExercises],
  ['asistencia', s.attendance],
  ['series_registradas', s.setLogs],
  ['valoraciones_de_sesion', s.feedback],
  ['valoraciones_de_ejercicio', s.exerciseFeedback],
  ['bienestar', s.readiness],
  ['molestias', s.painLogs],
  ['sustituciones', s.exerciseSubstitutions],
  ['tolerancias', s.exerciseTolerances],
  ['alertas', s.alerts],
  ['propuestas_del_motor', s.recommendations],
  ['informes', s.reports],
  ['solicitudes_de_privacidad', s.privacyRequests],
];
const HIDDEN = new Set(['organizationId', 'clientId', 'snapshot', 'codeHash']);

/** Decrypts *Enc columns (renamed without the suffix) and drops internal columns. */
function clean(keys: AppContext['keys'], row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (HIDDEN.has(k)) continue;
    if (k.endsWith('Enc')) {
      out[k.slice(0, -3)] = typeof v === 'string' ? safeOpen(keys, v) : null;
      continue;
    }
    out[k] = v;
  }
  return out;
}
function safeOpen(keys: AppContext['keys'], v: string): string | null {
  try {
    return openSecret(keys, v);
  } catch {
    return null;
  }
}

async function exportSubjectData_(ctx: RequestContext, clientId: string): Promise<FileOut> {
  await authorizeClient(ctx, 'privacy:export_subject', clientId);
  const [c] = await ctx.db.select().from(s.clients).where(eq(s.clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  const data: Record<string, unknown> = {};
  for (const [name, table] of SECTIONS) {
    const cols = getTableColumns(table) as Record<string, unknown>;
    if (!('clientId' in cols)) continue;
    const rows = await ctx.db
      .select()
      .from(table)
      .where(eq((table as unknown as { clientId: Parameters<typeof eq>[0] }).clientId, clientId));
    data[name] = (rows as Record<string, unknown>[]).map((r) => clean(ctx.keys, r));
  }
  // Who did what with the client's data (roles, not staff identities), when visible to the actor.
  const trail = await ctx.db
    .select({
      when: s.auditLogs.occurredAt,
      action: s.auditLogs.action,
      entity: s.auditLogs.entityType,
      roles: s.auditLogs.actorRoles,
    })
    .from(s.auditLogs)
    .where(eq(s.auditLogs.clientId, clientId))
    .orderBy(asc(s.auditLogs.occurredAt));
  const doc = {
    formato: 'exportacion-interesado/1',
    generado: ctx.now().toISOString(),
    nota:
      'Copia de tus datos personales (RGPD arts. 15 y 20). Los datos de salud solo existen si diste tu consentimiento. ' +
      'Si echas en falta algo, solicita el acceso completo desde la app.',
    cliente: clean(ctx.keys, { ...c, userId: undefined }),
    ...data,
    registro_de_actividad: trail,
  };
  const today = localDate(ctx.now());
  // Self-service access is recorded as a completed request (accountability, art. 5.2).
  if (ctx.actor.clientId === clientId)
    await ctx.db.insert(s.privacyRequests).values({
      organizationId: c.organizationId,
      clientId,
      type: 'portability',
      status: 'completed',
      dueOn: today,
      requestedBy: ctx.actor.userId,
      resolvedAt: ctx.now(),
      response: 'Descarga directa desde la app.',
    });
  await writeAudit(ctx.db, ctx, {
    action: 'export',
    entityType: 'subject_data',
    entityId: clientId,
    clientId,
    changes: { sections: Object.keys(data).length },
  });
  return {
    fileName: `mis-datos-${today}.json`,
    contentType: 'application/json; charset=utf-8',
    body: Buffer.from(JSON.stringify(doc, null, 2), 'utf8'),
  };
}

// ── Requests ──────────────────────────────────────────────────────────────────

async function createPrivacyRequest_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(privacyRequestSchema, input);
  await authorizeClient(ctx, 'privacy:request', clientId);
  const [dup] = await ctx.db
    .select({ id: s.privacyRequests.id })
    .from(s.privacyRequests)
    .where(
      and(
        eq(s.privacyRequests.clientId, clientId),
        eq(s.privacyRequests.type, d.type),
        eq(s.privacyRequests.status, 'pending'),
      ),
    );
  if (dup) throw new DomainError('conflict', 'Ya hay una solicitud de este tipo en curso.');
  const [c] = await ctx.db
    .select({ org: s.clients.organizationId })
    .from(s.clients)
    .where(eq(s.clients.id, clientId));
  const [r] = await ctx.db
    .insert(s.privacyRequests)
    .values({
      organizationId: c!.org,
      clientId,
      type: d.type,
      details: d.details ?? null,
      dueOn: privacyDueOn(localDate(ctx.now())),
      requestedBy: ctx.actor.userId,
    })
    .returning({ id: s.privacyRequests.id, dueOn: s.privacyRequests.dueOn });
  await writeAudit(ctx.db, ctx, {
    action: 'privacy_request',
    entityType: 'privacy_request',
    entityId: r!.id,
    clientId,
    changes: { type: d.type },
  });
  return r!;
}

async function listClientPrivacyRequests_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'privacy:request', clientId);
  return ctx.db
    .select()
    .from(s.privacyRequests)
    .where(eq(s.privacyRequests.clientId, clientId))
    .orderBy(desc(s.privacyRequests.createdAt));
}

async function cancelPrivacyRequest_(ctx: RequestContext, id: string) {
  const [r] = await ctx.db.select().from(s.privacyRequests).where(eq(s.privacyRequests.id, id));
  if (!r) throw new DomainError('not_found', 'Solicitud no encontrada.');
  await authorizeClient(ctx, 'privacy:request', r.clientId);
  if (r.status !== 'pending') throw new DomainError('conflict', 'La solicitud ya está resuelta.');
  await ctx.db
    .update(s.privacyRequests)
    .set({ status: 'cancelled', resolvedAt: ctx.now(), resolvedBy: ctx.actor.userId })
    .where(eq(s.privacyRequests.id, id));
}

/** ADMIN inbox: pending first, by due date, with the client's name. */
async function listPrivacyRequests_(ctx: RequestContext) {
  requirePermission(ctx, 'privacy:manage');
  const rows = await ctx.db
    .select({
      r: s.privacyRequests,
      firstName: s.clients.firstName,
      lastName: s.clients.lastName,
      anonymizedAt: s.clients.anonymizedAt,
    })
    .from(s.privacyRequests)
    .innerJoin(s.clients, eq(s.clients.id, s.privacyRequests.clientId))
    .orderBy(sql`${s.privacyRequests.status} <> 'pending'`, asc(s.privacyRequests.dueOn))
    .limit(200);
  const today = localDate(ctx.now());
  return rows.map(({ r, firstName, lastName, anonymizedAt }) => ({
    ...r,
    client: `${firstName} ${lastName}`,
    anonymized: anonymizedAt != null,
    overdue: r.status === 'pending' && r.dueOn < today,
  }));
}

async function resolvePrivacyRequest_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(resolvePrivacyRequestSchema, input);
  requirePermission(ctx, 'privacy:manage');
  const [r] = await ctx.db.select().from(s.privacyRequests).where(eq(s.privacyRequests.id, id));
  if (!r) throw new DomainError('not_found', 'Solicitud no encontrada.');
  if (r.status !== 'pending') throw new DomainError('conflict', 'La solicitud ya está resuelta.');
  if (r.type === 'erasure' && d.status === 'completed') {
    const [c] = await ctx.db
      .select({ a: s.clients.anonymizedAt })
      .from(s.clients)
      .where(eq(s.clients.id, r.clientId));
    if (!c?.a)
      throw new DomainError(
        'conflict',
        'Ejecuta antes la supresión del cliente (ficha → Privacidad) o rechaza la solicitud explicando el motivo.',
      );
  }
  await ctx.db
    .update(s.privacyRequests)
    .set({
      status: d.status,
      response: d.response,
      resolvedAt: ctx.now(),
      resolvedBy: ctx.actor.userId,
    })
    .where(eq(s.privacyRequests.id, id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'privacy_request',
    entityId: id,
    clientId: r.clientId,
    changes: [{ field: 'status', before: 'pending', after: d.status }],
  });
}

// ── Erasure (anonymization in place) ──────────────────────────────────────────

/**
 * Anonymizes a client: shared by the ADMIN erasure and the retention job (system, no actor).
 * `db` is the caller's (RLS-bound for ADMIN, root for system code).
 */
export async function anonymizeClient(
  app: Pick<AppContext, 'storage' | 'now'> & { db: Database },
  clientId: string,
): Promise<{ redactedAuditEntries: number; files: number }> {
  const db = app.db;
  const [c] = await db.select().from(s.clients).where(eq(s.clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  if (c.anonymizedAt) throw new DomainError('conflict', 'El cliente ya está anonimizado.');
  const now = app.now();
  const byClient = <T extends PgTable>(t: T) =>
    eq((t as unknown as { clientId: Parameters<typeof eq>[0] }).clientId, clientId);

  // Health data and free text about the person.
  for (const t of [
    s.healthDeclarations,
    s.screeningResponses,
    s.painLogs,
    s.exerciseTolerances,
    s.clientHistoryEntries,
    s.alerts,
    s.reports,
    s.invitations,
  ])
    await db.delete(t).where(byClient(t));
  await db
    .update(s.feedback)
    .set({ comment: null, pain: null, trainerNote: null })
    .where(byClient(s.feedback));
  await db
    .update(s.exerciseFeedback)
    .set({ comment: null, pain: null })
    .where(byClient(s.exerciseFeedback));
  await db.update(s.readiness).set({ comment: null }).where(byClient(s.readiness));
  await db.update(s.attendance).set({ reasonText: null }).where(byClient(s.attendance));
  await db
    .update(s.exerciseSubstitutions)
    .set({ comment: null })
    .where(byClient(s.exerciseSubstitutions));
  await db.update(s.clientGoals).set({ notes: null }).where(byClient(s.clientGoals));
  await db
    .update(s.clientTrainingProfiles)
    .set({ notes: null })
    .where(byClient(s.clientTrainingProfiles));
  await db
    .update(s.importRows)
    .set({ data: {} })
    .where(
      or(
        eq(s.importRows.createdEntityId, clientId),
        c.email ? sql`lower(${s.importRows.data}->>'email') = ${c.email.toLowerCase()}` : undefined,
      ),
    );

  // Files (photos): storage first, then the rows.
  const fs = await db.select().from(s.files).where(eq(s.files.clientId, clientId));
  for (const f of fs) await app.storage.delete(f.storageKey);
  if (fs.length) await db.delete(s.files).where(eq(s.files.clientId, clientId));

  // The account: closed, sessions and recovery codes gone, no way to log in again.
  if (c.userId) {
    await db.delete(s.authSessions).where(eq(s.authSessions.userId, c.userId));
    await db.delete(s.userRecoveryCodes).where(eq(s.userRecoveryCodes.userId, c.userId));
    await db
      .update(s.users)
      .set({
        email: `anonimo-${c.id}@invalid.local`,
        displayName: 'Cliente anónimo',
        passwordHash: null,
        totpSecretEnc: null,
        totpEnabledAt: null,
        status: 'disabled',
      })
      .where(eq(s.users.id, c.userId));
  }

  // The record itself: identifiers replaced; training data remain as anonymous aggregates.
  await db
    .update(s.clients)
    .set({
      ...anonymizedClientFields(c.id, c.birthDate),
      photoFileId: null,
      status: 'archived',
      archivedAt: c.archivedAt ?? now,
      anonymizedAt: now,
      version: c.version + 1,
    })
    .where(eq(s.clients.id, clientId));
  // Audit trail: values in diffs and reasons redacted (who/when/what kind of action stays).
  const [{ n } = { n: 0 }] = (await db.execute<{ n: number }>(
    sql`SELECT redact_client_audit(${clientId}) AS n`,
  )) as unknown as { n: number }[];
  return { redactedAuditEntries: Number(n), files: fs.length };
}

async function eraseClient_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(eraseClientSchema, input);
  requirePermission(ctx, 'privacy:erase_subject');
  await authorizeClient(ctx, 'privacy:erase_subject', clientId);
  const [c] = await ctx.db.select().from(s.clients).where(eq(s.clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  const full = `${c.firstName} ${c.lastName}`;
  if (d.confirmation.trim().toLowerCase() !== full.toLowerCase())
    throw new DomainError('validation', 'Escribe el nombre completo del cliente para confirmar.', {
      confirmation: ['mismatch'],
    });
  const r = await anonymizeClient(ctx, clientId);
  await ctx.db
    .update(s.privacyRequests)
    .set({
      status: 'completed',
      resolvedAt: ctx.now(),
      resolvedBy: ctx.actor.userId,
      response: 'Datos personales suprimidos (anonimización).',
    })
    .where(
      and(
        eq(s.privacyRequests.clientId, clientId),
        eq(s.privacyRequests.type, 'erasure'),
        eq(s.privacyRequests.status, 'pending'),
      ),
    );
  // New entry after the redaction: no personal data, only the reason category.
  await writeAudit(ctx.db, ctx, {
    action: 'anonymize',
    entityType: 'client',
    entityId: clientId,
    clientId,
    changes: { files: r.files, redactedAuditEntries: r.redactedAuditEntries },
    reason: d.reason,
  });
  return r;
}

// ── Organization settings and retention ───────────────────────────────────────

async function getPrivacySettings_(ctx: RequestContext) {
  requirePermission(ctx, 'privacy:manage');
  const [o] = await ctx.db
    .select({
      retentionMonths: s.organizations.retentionMonths,
      requireAdmin2fa: s.organizations.requireAdmin2fa,
    })
    .from(s.organizations)
    .where(eq(s.organizations.id, ctx.actor.organizationId));
  const [pending] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.clients)
    .where(and(isNotNull(s.clients.archivedAt), isNull(s.clients.anonymizedAt)));
  return { ...o!, archivedNotAnonymized: pending?.n ?? 0 };
}

async function updatePrivacySettings_(ctx: RequestContext, input: unknown) {
  const d = parse(privacySettingsSchema, input);
  requirePermission(ctx, 'privacy:manage');
  const before = await getPrivacySettings_(ctx);
  await ctx.db
    .update(s.organizations)
    .set({ retentionMonths: d.retentionMonths, requireAdmin2fa: d.requireAdmin2fa })
    .where(eq(s.organizations.id, ctx.actor.organizationId));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'organization',
    entityId: ctx.actor.organizationId,
    changes: [
      { field: 'retentionMonths', before: before.retentionMonths, after: d.retentionMonths },
      { field: 'requireAdmin2fa', before: before.requireAdmin2fa, after: d.requireAdmin2fa },
    ],
  });
}

/** Daily job (system): retention anonymization and purge of expired security records. */
export async function applyRetention(app: Pick<AppContext, 'storage' | 'now'> & { db: Database }) {
  const now = app.now();
  const orgs = await app.db
    .select({ id: s.organizations.id, months: s.organizations.retentionMonths })
    .from(s.organizations)
    .where(isNotNull(s.organizations.retentionMonths));
  let anonymized = 0;
  for (const o of orgs) {
    const due = await app.db
      .select({ id: s.clients.id, archivedAt: s.clients.archivedAt })
      .from(s.clients)
      .where(
        and(
          eq(s.clients.organizationId, o.id),
          isNotNull(s.clients.archivedAt),
          isNull(s.clients.anonymizedAt),
        ),
      );
    for (const c of due)
      if (retentionExpired(c.archivedAt, o.months, now)) {
        await anonymizeClient(app, c.id);
        await writeAudit(
          app.db,
          { ...app, requestId: undefined, ipHash: null } as never,
          {
            action: 'anonymize',
            entityType: 'client',
            entityId: c.id,
            clientId: c.id,
            reason: `Fin del plazo de conservación (${o.months} meses desde el archivo).`,
          },
          { userId: null, organizationId: o.id, roles: ['SYSTEM'] },
        );
        anonymized++;
      }
  }
  // Minimization: security records past their purpose.
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const sessions = await app.db
    .delete(s.authSessions)
    .where(
      or(
        lt(s.authSessions.absoluteExpiresAt, days(30)),
        and(isNotNull(s.authSessions.revokedAt), lt(s.authSessions.revokedAt, days(30))),
      ),
    )
    .returning({ id: s.authSessions.id });
  const attempts = await app.db
    .delete(s.loginAttempts)
    .where(lt(s.loginAttempts.occurredAt, days(90)))
    .returning({ id: s.loginAttempts.id });
  const resets = await app.db
    .delete(s.passwordResetTokens)
    .where(lt(s.passwordResetTokens.expiresAt, days(1)))
    .returning({ id: s.passwordResetTokens.id });
  const oldJobs = await app.db
    .select({ id: s.importJobs.id })
    .from(s.importJobs)
    .where(and(ne(s.importJobs.status, 'pending'), lt(s.importJobs.createdAt, days(30))));
  if (oldJobs.length)
    await app.db.delete(s.importRows).where(
      inArray(
        s.importRows.jobId,
        oldJobs.map((j) => j.id),
      ),
    );
  // API budget counters only matter for the current minute.
  const budgets = await app.db
    .delete(s.apiRateLimits)
    .where(lt(s.apiRateLimits.windowStart, days(1)))
    .returning({ b: s.apiRateLimits.bucket });
  return {
    anonymized,
    sessions: sessions.length,
    attempts: attempts.length,
    resets: resets.length,
    importJobs: oldJobs.length,
    apiBudgets: budgets.length,
  };
}

// ── Key rotation (system script) ──────────────────────────────────────────────

/** Re-encrypts every encrypted column with the current key (after APP_ENCRYPTION_KEY changes). */
export async function rotateEncryptedColumns(app: Pick<AppContext, 'keys'> & { db: Database }) {
  const targets = [
    [s.clients, s.clients.id, s.clients.phoneEnc, 'phoneEnc'],
    [
      s.healthDeclarations,
      s.healthDeclarations.id,
      s.healthDeclarations.descriptionEnc,
      'descriptionEnc',
    ],
    [s.users, s.users.id, s.users.totpSecretEnc, 'totpSecretEnc'],
    [s.painLogs, s.painLogs.id, s.painLogs.commentEnc, 'commentEnc'],
    [
      s.integrationConnections,
      s.integrationConnections.id,
      s.integrationConnections.credentialsEnc,
      'credentialsEnc',
    ],
  ] as const;
  let rotated = 0;
  let unreadable = 0;
  for (const [table, idCol, col, key] of targets) {
    const rows = (await app.db
      .select({ id: idCol, v: col })
      .from(table as PgTable)
      .where(isNotNull(col))) as { id: string; v: string }[];
    for (const r of rows) {
      let opened: { plaintext: string; current: boolean };
      try {
        opened = openSecretWithKey(app.keys, r.v);
      } catch {
        unreadable++;
        continue;
      }
      if (opened.current) continue;
      await app.db
        .update(table as PgTable)
        .set({ [key]: encrypt(app.keys.encryptionKey, opened.plaintext) } as never)
        .where(eq(idCol, r.id));
      rotated++;
    }
  }
  return { rotated, unreadable };
}

export const exportSubjectData = secured(exportSubjectData_);
export const createPrivacyRequest = secured(createPrivacyRequest_);
export const listClientPrivacyRequests = secured(listClientPrivacyRequests_);
export const cancelPrivacyRequest = secured(cancelPrivacyRequest_);
export const listPrivacyRequests = secured(listPrivacyRequests_);
export const resolvePrivacyRequest = secured(resolvePrivacyRequest_);
export const eraseClient = secured(eraseClient_);
export const getPrivacySettings = secured(getPrivacySettings_);
export const updatePrivacySettings = secured(updatePrivacySettings_);
