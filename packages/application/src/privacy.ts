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
  getTableName,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { AppContext, RequestContext } from './context';
import type { FileOut } from './reports';
import { log } from './observability';
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
  // Device data (Phase 15). Connections are not exported: they only hold encrypted tokens.
  ['mediciones_de_dispositivos', s.externalMeasurements],
  // Restructure phases 4–7 and the decision engine (added in the phase 10 RGPD review).
  ['series_prescritas', s.exerciseSets],
  ['grupos', s.clientGroupMembers],
  ['rasgos_anotados', s.clientTraitFlags],
  ['reglas_de_aviso_desactivadas', s.clientRuleOverrides],
  ['cambios_del_entrenador', s.manualOverrides],
  ['lesiones', s.injuries],
  ['fases_de_lesion', s.injuryPhaseHistory],
  ['sintomas_de_lesion', s.injurySymptoms],
  ['avisos_de_lesion', s.injuryAlerts],
  ['criterios_de_lesion_comprobados', s.injuryCriterionChecks],
  ['decisiones_de_vuelta_al_deporte', s.rtpDecisions],
];

/**
 * Tables with a `client_id` that the subject export leaves out, and why. A test checks that
 * every such table is either exported or listed here, so a new table cannot be forgotten.
 */
export const SUBJECT_EXPORT_EXCLUDED: Record<string, string> = {
  clients: 'Exported as «cliente»',
  audit_logs: 'Exported as «registro_de_actividad» (roles, not staff identities)',
  phases: 'Plan structure; its content is in «planes», «sesiones» and «ejercicios_prescritos»',
  mesocycles: 'Plan structure (as above)',
  microcycles: 'Plan structure (as above)',
  session_blocks: 'Plan structure (as above)',
  plan_revisions: 'Internal snapshots of the plan, already exported',
  decision_runs: 'Engine input and output; the resulting proposals are «propuestas_del_motor»',
  trainer_client_assignments: 'Internal staff organization',
  invitations: 'Account invitation tokens',
  integration_connections: 'Only encrypted access tokens',
  files: 'Storage metadata; the files go with a full access request',
};
export const SUBJECT_EXPORT_TABLES = SECTIONS.map(([, t]) => getTableName(t));
const HIDDEN = new Set(['organizationId', 'clientId', 'snapshot', 'codeHash']);

/**
 * Decrypts *Enc columns (renamed without the suffix) and drops internal columns. A legacy
 * *Plain column (not yet moved by `encryptInjuryText`) fills the same name only when its
 * encrypted twin is empty.
 */
function clean(keys: AppContext['keys'], row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (HIDDEN.has(k)) continue;
    if (k.endsWith('Enc')) {
      out[k.slice(0, -3)] = typeof v === 'string' ? safeOpen(keys, v) : null;
      continue;
    }
    if (k.endsWith('Plain')) continue;
    out[k] = v;
  }
  for (const [k, v] of Object.entries(row))
    if (k.endsWith('Plain') && v != null && row[`${k.slice(0, -5)}Enc`] == null)
      out[k.slice(0, -5)] = v;
  return out;
}
function safeOpen(keys: AppContext['keys'], v: string): string | null {
  try {
    return openSecret(keys, v);
  } catch {
    return null;
  }
}

type SectionReader = (table: PgTable, clientId: string) => Promise<Record<string, unknown>[]>;

async function exportSubjectData_(
  ctx: RequestContext,
  clientId: string,
  read: SectionReader,
): Promise<FileOut> {
  await authorizeClient(ctx, 'privacy:export_subject', clientId);
  const [c] = await ctx.db.select().from(s.clients).where(eq(s.clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  const data: Record<string, unknown> = {};
  for (const [name, table] of SECTIONS) {
    const cols = getTableColumns(table) as Record<string, unknown>;
    if (!('clientId' in cols)) continue;
    data[name] = (await read(table, clientId)).map((r) => clean(ctx.keys, r));
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

  // Health data and free text about the person. Deleting the injury cases removes their phases,
  // symptoms, alerts, criterion checks and return-to-sport decisions (ON DELETE CASCADE).
  for (const t of [
    s.injuries,
    s.decisionRuns,
    s.clientTraitFlags,
    s.healthDeclarations,
    s.screeningResponses,
    s.painLogs,
    s.exerciseTolerances,
    s.clientHistoryEntries,
    s.alerts,
    s.reports,
    s.invitations,
    // Device data and the tokens of the client's connections (Phase 15).
    s.externalMeasurements,
    s.integrationConnections,
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
  await db.update(s.manualOverrides).set({ reason: null }).where(byClient(s.manualOverrides));
  await db
    .update(s.clientRuleOverrides)
    .set({ reason: null })
    .where(byClient(s.clientRuleOverrides));
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
  // Kept in the logs (outside the database): re-applied after restoring a backup (OPERATIONS.md).
  log('info', 'subject_erased', { clientId, trigger: 'request' });
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
        log('info', 'subject_erased', { clientId: c.id, trigger: 'retention' });
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

type Col = AnyPgColumn;
const enc = (table: PgTable, key: string): [PgTable, Col, Col, string] => {
  const cols = getTableColumns(table) as Record<string, Col>;
  return [table, cols.id!, cols[key]!, key];
};

/**
 * Every AES-256-GCM encrypted column. A test checks that each `*_enc` column of the schema is
 * here: one left out would become unreadable when the old key is retired after a rotation (the
 * injury columns were missing until restructure phase 11).
 */
export const ENCRYPTED_COLUMNS = [
  enc(s.clients, 'phoneEnc'),
  enc(s.healthDeclarations, 'descriptionEnc'),
  enc(s.users, 'totpSecretEnc'),
  enc(s.painLogs, 'commentEnc'),
  enc(s.integrationConnections, 'credentialsEnc'),
  enc(s.injuries, 'diagnosisEnc'),
  enc(s.injuries, 'mechanismEnc'),
  enc(s.injuries, 'professionalEnc'),
  enc(s.injuries, 'restrictionsEnc'),
  enc(s.injuries, 'notesEnc'),
  enc(s.injurySymptoms, 'noteEnc'),
  enc(s.injuryPhaseHistory, 'noteEnc'),
  enc(s.injuryAlerts, 'reviewNoteEnc'),
  enc(s.injuryCriterionChecks, 'noteEnc'),
  enc(s.rtpDecisions, 'rationaleEnc'),
];

/** Legacy plaintext columns of the injury module and the encrypted column that replaces each. */
const INJURY_PLAINTEXT: [PgTable, string][] = [
  [s.injuries, 'mechanism'],
  [s.injuries, 'professional'],
  [s.injuries, 'restrictions'],
  [s.injuries, 'notes'],
  [s.injuryPhaseHistory, 'note'],
  [s.injuryAlerts, 'reviewNote'],
  [s.injuryCriterionChecks, 'note'],
  [s.rtpDecisions, 'rationale'],
];

/**
 * Moves the injury free text written before restructure phase 11 into its encrypted column and
 * empties the plaintext one (system script, idempotent; run on every start after the
 * migrations, deploy/start.sh). An encrypted value already present is kept.
 */
export async function encryptInjuryText(app: Pick<AppContext, 'keys'> & { db: Database }) {
  let moved = 0;
  for (const [table, base] of INJURY_PLAINTEXT) {
    const cols = getTableColumns(table) as Record<string, Col>;
    const plain = cols[`${base}Plain`]!;
    const encrypted = cols[`${base}Enc`]!;
    const rows = (await app.db
      .select({ id: cols.id!, plain, encrypted })
      .from(table)
      .where(isNotNull(plain))) as { id: string; plain: string; encrypted: string | null }[];
    for (const r of rows) {
      await app.db
        .update(table)
        .set({
          [`${base}Enc`]: r.encrypted ?? encrypt(app.keys.encryptionKey, r.plain),
          [`${base}Plain`]: null,
        } as never)
        .where(eq(cols.id!, r.id));
      moved++;
    }
  }
  return { moved };
}

/** Re-encrypts every encrypted column with the current key (after APP_ENCRYPTION_KEY changes). */
export async function rotateEncryptedColumns(app: Pick<AppContext, 'keys'> & { db: Database }) {
  let rotated = 0;
  let unreadable = 0;
  for (const [table, idCol, col, key] of ENCRYPTED_COLUMNS) {
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

/**
 * The subject export (arts. 15 and 20). Authorization runs first, in the actor-bound transaction.
 * The sections are then read with the system connection: the person's own records include
 * staff-only ones (injury cases, alerts, engine proposals) that row security hides from the
 * client app but that the right of access covers (phase 10 RGPD review).
 */
export const exportSubjectData = (ctx: RequestContext, clientId: string) =>
  secured(exportSubjectData_)(
    ctx,
    clientId,
    async (table, id) =>
      (await ctx.db
        .select()
        .from(table)
        .where(
          eq((table as unknown as { clientId: Parameters<typeof eq>[0] }).clientId, id),
        )) as Record<string, unknown>[],
  );
export const createPrivacyRequest = secured(createPrivacyRequest_);
export const listClientPrivacyRequests = secured(listClientPrivacyRequests_);
export const cancelPrivacyRequest = secured(cancelPrivacyRequest_);
export const listPrivacyRequests = secured(listPrivacyRequests_);
export const resolvePrivacyRequest = secured(resolvePrivacyRequest_);
export const eraseClient = secured(eraseClient_);
export const getPrivacySettings = secured(getPrivacySettings_);
export const updatePrivacySettings = secured(updatePrivacySettings_);
