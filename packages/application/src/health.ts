import { encrypt, openSecret } from '@tp/auth';
import {
  clearHealthDeclarationSchema,
  healthDeclarationSchema,
  screeningSchema,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  DomainError,
  hasActiveConsent,
  needsReferral,
  REFERRAL_TEXT,
  type ConsentPurpose,
} from '@tp/domain';
import { and, desc, eq } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { parse } from './validation';
import { secured } from './rls';

const { healthDeclarations, screeningResponses, consents } = schema;

export interface ReferralStatus {
  required: boolean;
  text: string | null;
}

/**
 * Safety banner state: a declaration flagged for professional assessment that has not been
 * cleared, or a most recent screening with result `refer`.
 */
export async function referralStatus(db: Executor, clientId: string): Promise<ReferralStatus> {
  const decl = await db
    .select({
      declaredStatus: healthDeclarations.declaredStatus,
      requiresProfessionalAssessment: healthDeclarations.requiresProfessionalAssessment,
      clearedAt: healthDeclarations.clearedAt,
    })
    .from(healthDeclarations)
    .where(eq(healthDeclarations.clientId, clientId));
  const [lastScreening] = await db
    .select({ result: screeningResponses.result })
    .from(screeningResponses)
    .where(eq(screeningResponses.clientId, clientId))
    .orderBy(desc(screeningResponses.completedOn), desc(screeningResponses.createdAt))
    .limit(1);
  const required = needsReferral(decl) || lastScreening?.result === 'refer';
  return { required, text: required ? REFERRAL_TEXT : null };
}

async function requireHealthConsent(db: Executor, clientId: string): Promise<void> {
  const rows = await db.select().from(consents).where(eq(consents.clientId, clientId));
  const ok = hasActiveConsent(
    rows.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
  if (!ok) {
    throw new DomainError(
      'conflict',
      'Falta el consentimiento explícito para el tratamiento de datos de salud (art. 9 RGPD).',
      { consent: ['health_data_required'] },
    );
  }
}

/** Reading health data is audited as a sensitive view (§14.6). */
async function listHealthDeclarations_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'health:read', clientId);
  const rows = await ctx.db
    .select()
    .from(healthDeclarations)
    .where(eq(healthDeclarations.clientId, clientId))
    .orderBy(desc(healthDeclarations.declaredOn));
  const screenings = await ctx.db
    .select()
    .from(screeningResponses)
    .where(eq(screeningResponses.clientId, clientId))
    .orderBy(desc(screeningResponses.completedOn));
  await writeAudit(ctx.db, ctx, {
    action: 'view_sensitive',
    entityType: 'health_declarations',
    entityId: clientId,
    clientId,
  });
  return {
    declarations: rows.map((r) => ({
      id: r.id,
      type: r.type,
      bodyRegion: r.bodyRegion,
      declaredOn: r.declaredOn,
      declaredStatus: r.declaredStatus,
      requiresProfessionalAssessment: r.requiresProfessionalAssessment,
      clearedAt: r.clearedAt,
      clearanceNote: r.clearanceNote,
      description: r.descriptionEnc ? openSecret(ctx.keys, r.descriptionEnc) : null,
    })),
    screenings: screenings.map((s) => ({
      id: s.id,
      questionnaire: s.questionnaire,
      questionnaireVersion: s.questionnaireVersion,
      result: s.result,
      completedOn: s.completedOn,
    })),
    referral: await referralStatus(ctx.db, clientId),
  };
}

function staffOnly(ctx: RequestContext, resource: Awaited<ReturnType<typeof authorizeClient>>) {
  if (requirePermission(ctx, 'health:write', resource) === 'own') {
    throw new DomainError('forbidden', 'Solo tu entrenador puede registrar esta información.');
  }
}

async function addHealthDeclaration_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(healthDeclarationSchema, input);
  const resource = await authorizeClient(ctx, 'health:write', clientId);
  staffOnly(ctx, resource);
  await requireHealthConsent(ctx.db, clientId);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(healthDeclarations)
      .values({
        clientId,
        type: d.type,
        bodyRegion: d.bodyRegion ?? null,
        declaredOn: d.declaredOn,
        declaredStatus: d.declaredStatus,
        requiresProfessionalAssessment: d.requiresProfessionalAssessment,
        descriptionEnc: d.description ? encrypt(ctx.keys.encryptionKey, d.description) : null,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: healthDeclarations.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'health_declaration',
      entityId: row!.id,
      clientId,
      // Free text is not copied into the audit trail.
      changes: {
        type: d.type,
        bodyRegion: d.bodyRegion ?? null,
        requiresProfessionalAssessment: d.requiresProfessionalAssessment,
      },
    });
    return { id: row!.id };
  });
}

/** Records that a health professional has assessed the issue (the system never decides this). */
async function clearHealthDeclaration_(
  ctx: RequestContext,
  clientId: string,
  declarationId: string,
  input: unknown,
): Promise<void> {
  const { note } = parse(clearHealthDeclarationSchema, input);
  const resource = await authorizeClient(ctx, 'health:write', clientId);
  staffOnly(ctx, resource);
  await ctx.db.transaction(async (tx) => {
    const updated = await tx
      .update(healthDeclarations)
      .set({
        clearedAt: ctx.now(),
        clearedBy: ctx.actor.userId,
        clearanceNote: note,
        updatedBy: ctx.actor.userId,
      })
      .where(
        and(eq(healthDeclarations.id, declarationId), eq(healthDeclarations.clientId, clientId)),
      )
      .returning({ id: healthDeclarations.id });
    if (!updated.length) throw new DomainError('not_found', 'Declaración no encontrada.');
    await writeAudit(tx, ctx, {
      action: 'clear',
      entityType: 'health_declaration',
      entityId: declarationId,
      clientId,
      reason: note,
    });
  });
}

async function recordScreening_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const s = parse(screeningSchema, input);
  const resource = await authorizeClient(ctx, 'health:write', clientId);
  staffOnly(ctx, resource);
  await requireHealthConsent(ctx.db, clientId);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(screeningResponses)
      .values({
        clientId,
        questionnaire: s.questionnaire,
        questionnaireVersion: s.questionnaireVersion ?? null,
        result: s.result,
        completedOn: s.completedOn,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: screeningResponses.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'screening',
      entityId: row!.id,
      clientId,
      changes: { questionnaire: s.questionnaire, result: s.result },
    });
    return { id: row!.id };
  });
}

// Use cases run under Row Level Security (see rls.ts).
export const listHealthDeclarations = secured(listHealthDeclarations_);
export const addHealthDeclaration = secured(addHealthDeclaration_);
export const clearHealthDeclaration = secured(clearHealthDeclaration_);
export const recordScreening = secured(recordScreening_);
