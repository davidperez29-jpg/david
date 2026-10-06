/**
 * Injury, readaptation and return to sport (restructure phase 7, docs/INJURY_MODULE.md).
 * LESIÓN → FASE → CRITERIOS → PROGRESIÓN → RETURN TO SPORT → RETURN TO PERFORMANCE.
 *
 * - [SALUD] Everything here is health data: staff only (never the client app), explicit consent
 *   to process health data (art. 9 RGPD) before writing, reads audited as `view_sensitive`, the
 *   diagnosis received and the symptom notes encrypted.
 * - The software never diagnoses, never says «apto» and never advances a phase by itself: the
 *   computed maximum is «Listo para valoración»; [Avanzar de fase] is pressed by the trainer and
 *   the return-to-sport decision is recorded with the name and role of who took it.
 * - Automatic criteria (a test's value or its LSI) are evaluated live from the latest assessment
 *   after the injury; when a phase is advanced, the state that allowed it is stored as checks.
 *   Without data an automatic criterion can be checked manually (e.g. measured elsewhere).
 * - An open safety alert blocks [Avanzar de fase] until it is reviewed with a note.
 */
import { encrypt, openSecret } from '@tp/auth';
import {
  advancePhaseSchema,
  closeInjurySchema,
  criterionCheckSchema,
  injuryComparisonQuerySchema,
  openInjurySchema,
  reviewAlertSchema,
  rtpDecisionSchema,
  symptomSchema,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  BODY_REGIONS,
  canAdvance,
  canSupport,
  CASE_STATUS_LABELS,
  caseStatus,
  CRITERION_EVIDENCE,
  CRITERION_ROLES,
  DomainError,
  evaluateCriterion,
  languageIssues,
  pickMeasurementError,
  READING_LABELS,
  readChange,
  RTP_OUTCOMES,
  RTP_STAGES,
  rtpChecklist,
  SIDES,
  symptomAlerts,
  type CriterionDef,
  type Direction,
  type Measurement,
  type PhaseState,
  type RtpItem,
} from '@tp/domain';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { citation, loadClientContext, reliabilityRows, toReliability } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { requireHealthConsent } from './health';
import { secured } from './rls';
import { parse } from './validation';

const {
  injuryConditions,
  injuryProtocols,
  injuryProtocolPhases,
  injuryProtocolCriteria,
  injuries,
  injuryPhaseHistory,
  injurySymptoms,
  injuryAlerts,
  injuryCriterionChecks,
  rtpDecisions,
  evidenceSources,
  assessments,
  assessmentResults,
  assessmentTests,
} = schema;

const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));
const today = (ctx: RequestContext) => ctx.now().toISOString().slice(0, 10);
const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));

/** Health data of the case: staff with the client in scope; the client app never reads it. */
async function staff(ctx: RequestContext, perm: 'health:read' | 'health:write', clientId: string) {
  const resource = await authorizeClient(ctx, perm, clientId);
  if (requirePermission(ctx, perm, resource) === 'own')
    throw new DomainError('not_found', 'Cliente no encontrado.');
  return resource;
}

/** Free text follows the report language rules (no «apto», «alta deportiva», diagnoses…). */
function checkLanguage(field: string, text: string | null | undefined) {
  if (!text) return;
  const issues = languageIssues(text).filter((i) => i.rule !== 'prevention');
  if (issues.length)
    throw new DomainError(
      'validation',
      `Revisa el texto: ${issues.map((i) => `«${i.phrase}»`).join(', ')}. ${issues[0]!.message}`,
      { [field]: issues.map((i) => `«${i.phrase}»: ${i.message}`) },
    );
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

async function sourcesOf(db: Executor, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({
      id: evidenceSources.id,
      authors: evidenceSources.authors,
      year: evidenceSources.year,
      title: evidenceSources.title,
      doi: evidenceSources.doi,
      pmid: evidenceSources.pmid,
      verificationStatus: evidenceSources.verificationStatus,
    })
    .from(evidenceSources)
    .where(inArray(evidenceSources.id, [...new Set(ids)]));
  // Phase 9: only a verified source is ever shown as support.
  return new Map(
    rows
      .filter((s) => canSupport(s.verificationStatus))
      .map((s) => [
        s.id,
        `${citation(s)}. ${s.title}${s.doi ? ` doi:${s.doi}` : ''}${s.pmid ? ` · PMID ${s.pmid}` : ''}`,
      ]),
  );
}

async function listInjuryCatalog_(ctx: RequestContext) {
  requirePermission(ctx, 'catalog:read');
  const [conditions, protocols] = await Promise.all([
    ctx.db
      .select({
        id: injuryConditions.id,
        slug: injuryConditions.slug,
        region: injuryConditions.region,
        name: injuryConditions.name,
        description: injuryConditions.description,
      })
      .from(injuryConditions)
      .where(
        and(
          visible(ctx, injuryConditions.organizationId),
          eq(injuryConditions.status, 'published'),
        ),
      )
      .orderBy(asc(injuryConditions.region), asc(injuryConditions.name)),
    ctx.db
      .select({
        id: injuryProtocols.id,
        conditionId: injuryProtocols.conditionId,
        name: injuryProtocols.name,
        protocolVersion: injuryProtocols.protocolVersion,
        phases: sql<number>`(SELECT count(*)::int FROM injury_protocol_phases p WHERE p.protocol_id = injury_protocols.id)`,
      })
      .from(injuryProtocols)
      .where(
        and(visible(ctx, injuryProtocols.organizationId), eq(injuryProtocols.status, 'published')),
      )
      .orderBy(asc(injuryProtocols.name), desc(injuryProtocols.protocolVersion)),
  ]);
  return {
    regions: Object.entries(BODY_REGIONS).map(([value, label]) => ({ value, label })),
    sides: Object.entries(SIDES).map(([value, label]) => ({ value, label })),
    conditions: conditions.map((c) => ({
      ...c,
      regionLabel: BODY_REGIONS[c.region as keyof typeof BODY_REGIONS] ?? c.region,
      protocols: protocols
        .filter((p) => p.conditionId === c.id)
        .map(({ conditionId: _c, ...p }) => p),
    })),
  };
}

async function protocolDetail(db: Executor, protocolId: string) {
  const [p] = await db.select().from(injuryProtocols).where(eq(injuryProtocols.id, protocolId));
  if (!p) throw new DomainError('not_found', 'Protocolo no encontrado.');
  const [phases, criteria] = await Promise.all([
    db
      .select()
      .from(injuryProtocolPhases)
      .where(eq(injuryProtocolPhases.protocolId, protocolId))
      .orderBy(asc(injuryProtocolPhases.position)),
    db
      .select()
      .from(injuryProtocolCriteria)
      .where(eq(injuryProtocolCriteria.protocolId, protocolId))
      .orderBy(asc(injuryProtocolCriteria.position)),
  ]);
  const sources = await sourcesOf(db, [...p.sourceIds, ...criteria.flatMap((c) => c.sourceIds)]);
  const cites = (ids: string[]) => ids.flatMap((id) => (sources.has(id) ? [sources.get(id)!] : []));
  return {
    id: p.id,
    conditionId: p.conditionId,
    name: p.name,
    protocolVersion: p.protocolVersion,
    description: p.description,
    painThreshold: p.painThreshold,
    painThresholdBasis: p.painThresholdBasis,
    limitations: p.limitations,
    sources: cites(p.sourceIds),
    sourceIds: p.sourceIds,
    phases: phases.map((ph, i) => ({
      id: ph.id,
      index: i,
      name: ph.name,
      goals: ph.goals,
      restrictions: ph.restrictions,
      exercises: ph.exercises,
      dosage: ph.dosage,
      recommendedTests: ph.recommendedTests,
      criteria: criteria
        .filter((c) => c.phaseId === ph.id)
        .map((c) => ({
          id: c.id,
          role: c.role,
          roleLabel: CRITERION_ROLES[c.role],
          text: c.text,
          mandatory: c.mandatory,
          auto:
            c.testSlug && c.metric && c.operator && c.threshold != null
              ? {
                  testSlug: c.testSlug,
                  metric: c.metric as 'value' | 'lsi',
                  operator: c.operator as '>=' | '<=',
                  threshold: Number(c.threshold),
                }
              : null,
          rtpItem: c.rtpItem as RtpItem | null,
          evidence: c.evidence,
          evidenceLabel: CRITERION_EVIDENCE[c.evidence],
          sources: cites(c.sourceIds),
          sourceIds: c.sourceIds,
          limitations: c.limitations,
        })),
    })),
  };
}
export type InjuryProtocolDetail = Awaited<ReturnType<typeof protocolDetail>>;

async function getInjuryProtocol_(ctx: RequestContext, protocolId: string) {
  requirePermission(ctx, 'catalog:read');
  return protocolDetail(ctx.db, protocolId);
}

// ── Case state ───────────────────────────────────────────────────────────────

async function loadInjury(db: Executor, clientId: string, injuryId: string) {
  const [row] = await db
    .select()
    .from(injuries)
    .where(and(eq(injuries.id, injuryId), eq(injuries.clientId, clientId)));
  if (!row) throw new DomainError('not_found', 'Lesión no encontrada.');
  return row;
}
type InjuryRow = Awaited<ReturnType<typeof loadInjury>>;

/** Latest valid measurement of each test after the injury (value, sides, assessment). */
async function latestMeasurements(
  db: Executor,
  clientId: string,
  since: string,
  slugs: string[],
): Promise<Map<string, Measurement & { assessmentId: string; assessedOn: string }>> {
  const out = new Map<string, Measurement & { assessmentId: string; assessedOn: string }>();
  if (!slugs.length) return out;
  const rows = await db
    .select({
      slug: assessmentTests.slug,
      better: assessmentTests.betterDirection,
      side: assessmentResults.side,
      value: assessmentResults.value,
      assessmentId: assessments.id,
      assessedOn: assessments.assessedOn,
    })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        inArray(assessmentTests.slug, slugs),
        eq(assessmentResults.valid, true),
        sql`${assessmentResults.value} IS NOT NULL`,
        sql`${assessments.status} <> 'cancelled'`,
        sql`${assessments.assessedOn} >= ${since}`,
      ),
    )
    .orderBy(desc(assessments.assessedOn), desc(assessments.createdAt));
  for (const r of rows) {
    let m = out.get(r.slug);
    if (!m) {
      m = { better: r.better, assessmentId: r.assessmentId, assessedOn: r.assessedOn };
      out.set(r.slug, m);
    }
    if (m.assessmentId !== r.assessmentId) continue;
    const v = Number(r.value);
    if (r.side === 'left') m.left = v;
    else if (r.side === 'right') m.right = v;
    else m.value = v;
  }
  return out;
}

interface CriterionState {
  id: string;
  met: boolean | null;
  value: number | null;
  source: 'auto' | 'manual' | null;
  assessmentId: string | null;
  checkedOn: string | null;
  note: string | null;
}

/** State of each criterion of a phase: live automatic value, else the latest manual check. */
async function criteriaState(
  db: Executor,
  injury: InjuryRow,
  criteria: InjuryProtocolDetail['phases'][number]['criteria'],
): Promise<Map<string, CriterionState>> {
  const ids = criteria.map((c) => c.id);
  const [checks, measures] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(injuryCriterionChecks)
          .where(
            and(
              eq(injuryCriterionChecks.injuryId, injury.id),
              inArray(injuryCriterionChecks.criterionId, ids),
            ),
          )
          .orderBy(desc(injuryCriterionChecks.checkedAt))
      : [],
    latestMeasurements(
      db,
      injury.clientId,
      injury.occurredOn,
      criteria.flatMap((c) => (c.auto ? [c.auto.testSlug] : [])),
    ),
  ]);
  const out = new Map<string, CriterionState>();
  for (const c of criteria) {
    const def: CriterionDef = {
      id: c.id,
      role: c.role,
      text: c.text,
      mandatory: c.mandatory,
      auto: c.auto,
    };
    const m = c.auto ? (measures.get(c.auto.testSlug) ?? null) : null;
    const auto = evaluateCriterion(def, m, injury.side);
    if (auto && m) {
      out.set(c.id, {
        id: c.id,
        met: auto.met,
        value: auto.value,
        source: 'auto',
        assessmentId: m.assessmentId,
        checkedOn: m.assessedOn,
        note: null,
      });
      continue;
    }
    const last = checks.find((k) => k.criterionId === c.id && k.source === 'manual');
    out.set(c.id, {
      id: c.id,
      met: last ? last.met : null,
      value: num(last?.value),
      source: last ? 'manual' : null,
      assessmentId: null,
      checkedOn: last ? last.checkedAt.toISOString().slice(0, 10) : null,
      note: last?.note ?? null,
    });
  }
  return out;
}

async function caseOf(ctx: RequestContext, injury: InjuryRow) {
  const protocol = injury.protocolId ? await protocolDetail(ctx.db, injury.protocolId) : null;
  const phase = protocol?.phases.find((p) => p.id === injury.currentPhaseId) ?? null;
  const [openAlerts, decisions] = await Promise.all([
    ctx.db
      .select({ id: injuryAlerts.id })
      .from(injuryAlerts)
      .where(and(eq(injuryAlerts.injuryId, injury.id), isNull(injuryAlerts.reviewedAt))),
    ctx.db
      .select({ outcome: rtpDecisions.outcome })
      .from(rtpDecisions)
      .where(eq(rtpDecisions.injuryId, injury.id)),
  ]);
  const states = phase ? await criteriaState(ctx.db, injury, phase.criteria) : new Map();
  const st = (id: string) => states.get(id) as CriterionState | undefined;
  const state: PhaseState = {
    phaseIndex: phase ? phase.index : null,
    phasesCount: protocol?.phases.length ?? 0,
    mandatory: (phase?.criteria ?? [])
      .filter((c) => c.mandatory && (c.role === 'progression' || c.role === 'success'))
      .map((c) => st(c.id)?.met ?? null),
    stopMet: (phase?.criteria ?? []).filter((c) => c.role === 'stop' && st(c.id)?.met === true)
      .length,
    openAlerts: openAlerts.length,
    decisionRequested: !!injury.decisionRequestedAt,
    closed: injury.status === 'closed',
  };
  return {
    protocol,
    phase,
    states,
    state,
    advance: canAdvance(state),
    status: caseStatus(state),
    decisionAuthorized: decisions.some((d) => d.outcome === 'authorized'),
  };
}

/** Criteria of the whole protocol with their latest state (for the return-to-play checklist). */
async function checklistOf(
  ctx: RequestContext,
  injury: InjuryRow,
  protocol: InjuryProtocolDetail | null,
  decisionAuthorized: boolean,
) {
  const tagged = (protocol?.phases ?? []).flatMap((p) => p.criteria.filter((c) => c.rtpItem));
  const states = await criteriaState(ctx.db, injury, tagged);
  return rtpChecklist(
    tagged.map((c) => ({ item: c.rtpItem, met: states.get(c.id)?.met ?? null })),
    decisionAuthorized,
  );
}

// ── Cases ────────────────────────────────────────────────────────────────────

async function listClientInjuries_(ctx: RequestContext, clientId: string) {
  await staff(ctx, 'health:read', clientId);
  const rows = await ctx.db
    .select({
      id: injuries.id,
      condition: injuryConditions.name,
      region: injuryConditions.region,
      side: injuries.side,
      occurredOn: injuries.occurredOn,
      status: injuries.status,
      protocolId: injuries.protocolId,
      phase: injuryProtocolPhases.name,
      phasePosition: injuryProtocolPhases.position,
      closedAt: injuries.closedAt,
    })
    .from(injuries)
    .innerJoin(injuryConditions, eq(injuryConditions.id, injuries.conditionId))
    .leftJoin(injuryProtocolPhases, eq(injuryProtocolPhases.id, injuries.currentPhaseId))
    .where(eq(injuries.clientId, clientId))
    .orderBy(asc(injuries.status), desc(injuries.occurredOn));
  await writeAudit(ctx.db, ctx, {
    action: 'view_sensitive',
    entityType: 'injuries',
    entityId: clientId,
    clientId,
  });
  const items = [];
  for (const r of rows) {
    const c = await caseOf(ctx, await loadInjury(ctx.db, clientId, r.id));
    items.push({
      id: r.id,
      condition: r.condition,
      regionLabel: BODY_REGIONS[r.region as keyof typeof BODY_REGIONS] ?? r.region,
      side: r.side,
      sideLabel: SIDES[r.side],
      occurredOn: r.occurredOn,
      phase: r.phase,
      phaseNumber: r.phasePosition == null ? null : (c.phase?.index ?? 0) + 1,
      phasesCount: c.protocol?.phases.length ?? 0,
      status: c.status,
      statusLabel: CASE_STATUS_LABELS[c.status],
      openAlerts: c.state.openAlerts,
    });
  }
  return { items };
}

/**
 * Whether the client has injury cases (to show the Readaptación tab). Only a count, no health
 * content: not audited as a sensitive view. Out of scope or the client app → 0.
 */
async function injuryCaseCount_(ctx: RequestContext, clientId: string) {
  const resource = await authorizeClient(ctx, 'health:read', clientId).catch(() => null);
  if (!resource || requirePermission(ctx, 'health:read', resource) === 'own')
    return { active: 0, total: 0 };
  const rows = await ctx.db
    .select({ status: injuries.status })
    .from(injuries)
    .where(eq(injuries.clientId, clientId));
  return { active: rows.filter((r) => r.status === 'active').length, total: rows.length };
}

async function getInjury_(ctx: RequestContext, clientId: string, injuryId: string) {
  await staff(ctx, 'health:read', clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  const c = await caseOf(ctx, injury);
  const [condition] = await ctx.db
    .select({ name: injuryConditions.name, region: injuryConditions.region })
    .from(injuryConditions)
    .where(eq(injuryConditions.id, injury.conditionId));
  const [history, symptoms, alerts, decisions, checklist] = await Promise.all([
    ctx.db
      .select({
        phaseId: injuryPhaseHistory.phaseId,
        startedOn: injuryPhaseHistory.startedOn,
        endedOn: injuryPhaseHistory.endedOn,
        note: injuryPhaseHistory.note,
      })
      .from(injuryPhaseHistory)
      .where(eq(injuryPhaseHistory.injuryId, injury.id))
      .orderBy(asc(injuryPhaseHistory.startedOn), asc(injuryPhaseHistory.createdAt)),
    ctx.db
      .select()
      .from(injurySymptoms)
      .where(eq(injurySymptoms.injuryId, injury.id))
      .orderBy(desc(injurySymptoms.recordedOn), desc(injurySymptoms.createdAt))
      .limit(30),
    ctx.db
      .select()
      .from(injuryAlerts)
      .where(eq(injuryAlerts.injuryId, injury.id))
      .orderBy(desc(injuryAlerts.createdAt))
      .limit(30),
    ctx.db
      .select()
      .from(rtpDecisions)
      .where(eq(rtpDecisions.injuryId, injury.id))
      .orderBy(desc(rtpDecisions.decidedOn), desc(rtpDecisions.createdAt)),
    checklistOf(ctx, injury, c.protocol, c.decisionAuthorized),
  ]);
  await writeAudit(ctx.db, ctx, {
    action: 'view_sensitive',
    entityType: 'injury',
    entityId: injury.id,
    clientId,
  });
  const phaseName = (id: string) => c.protocol?.phases.find((p) => p.id === id)?.name ?? '—';
  return {
    id: injury.id,
    clientId,
    condition: condition?.name ?? '—',
    regionLabel: condition
      ? (BODY_REGIONS[condition.region as keyof typeof BODY_REGIONS] ?? condition.region)
      : null,
    side: injury.side,
    sideLabel: SIDES[injury.side],
    occurredOn: injury.occurredOn,
    mechanism: injury.mechanism,
    diagnosis: injury.diagnosisEnc ? openSecret(ctx.keys, injury.diagnosisEnc) : null,
    professional: injury.professional,
    clinicalClearanceOn: injury.clinicalClearanceOn,
    restrictions: injury.restrictions,
    notes: injury.notes,
    phaseStartedOn: injury.phaseStartedOn,
    closedAt: injury.closedAt,
    version: injury.version,
    status: c.status,
    statusLabel: CASE_STATUS_LABELS[c.status],
    canAdvance: c.advance,
    decisionRequested: !!injury.decisionRequestedAt,
    protocol: c.protocol
      ? {
          id: c.protocol.id,
          name: c.protocol.name,
          protocolVersion: c.protocol.protocolVersion,
          painThreshold: c.protocol.painThreshold,
          painThresholdBasis: c.protocol.painThresholdBasis,
          limitations: c.protocol.limitations,
          sources: c.protocol.sources,
          sourceIds: c.protocol.sourceIds,
          phases: c.protocol.phases.map((p) => ({ id: p.id, name: p.name })),
        }
      : null,
    phase: c.phase
      ? {
          id: c.phase.id,
          number: c.phase.index + 1,
          name: c.phase.name,
          goals: c.phase.goals,
          restrictions: c.phase.restrictions,
          exercises: c.phase.exercises,
          dosage: c.phase.dosage,
          recommendedTests: c.phase.recommendedTests,
          criteria: c.phase.criteria.map((k) => ({ ...k, state: c.states.get(k.id) ?? null })),
        }
      : null,
    history: history.map((h) => ({ ...h, phase: phaseName(h.phaseId) })),
    symptoms: symptoms.map((s) => ({
      id: s.id,
      recordedOn: s.recordedOn,
      pain: s.pain,
      worseThanBefore: s.worseThanBefore,
      persistsNextDay: s.persistsNextDay,
      functionLoss: s.functionLoss,
      neurological: s.neurological,
      swelling: s.swelling,
      instability: s.instability,
      adverseReaction: s.adverseReaction,
      note: s.noteEnc ? openSecret(ctx.keys, s.noteEnc) : null,
    })),
    alerts: alerts.map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      message: a.message,
      createdAt: a.createdAt,
      reviewedAt: a.reviewedAt,
      reviewNote: a.reviewNote,
    })),
    checklist,
    decisions: decisions.map((d) => ({
      id: d.id,
      stage: d.stage,
      stageLabel: RTP_STAGES[d.stage],
      outcome: d.outcome,
      outcomeLabel: RTP_OUTCOMES[d.outcome],
      decidedByName: d.decidedByName,
      decidedByRole: d.decidedByRole,
      decidedOn: d.decidedOn,
      rationale: d.rationale,
    })),
    stages: Object.entries(RTP_STAGES).map(([value, label]) => ({ value, label })),
    outcomes: Object.entries(RTP_OUTCOMES).map(([value, label]) => ({ value, label })),
  };
}
export type InjuryDetail = Awaited<ReturnType<typeof getInjury_>>;

/** Opens a case. With a protocol, its first phase starts today (pressed by the trainer). */
async function openInjury_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(openInjurySchema, input);
  await staff(ctx, 'health:write', clientId);
  await requireHealthConsent(ctx.db, clientId);
  checkLanguage('notes', d.notes);
  const [cond] = await ctx.db
    .select({ id: injuryConditions.id })
    .from(injuryConditions)
    .where(
      and(eq(injuryConditions.id, d.conditionId), visible(ctx, injuryConditions.organizationId)),
    );
  if (!cond) throw new DomainError('validation', 'Lesión no encontrada en el catálogo.');
  let firstPhase: string | null = null;
  if (d.protocolId) {
    const p = await protocolDetail(ctx.db, d.protocolId);
    if (p.conditionId !== d.conditionId)
      throw new DomainError('validation', 'El protocolo no corresponde a esta lesión.', {
        protocolId: ['other_condition'],
      });
    firstPhase = p.phases[0]?.id ?? null;
  }
  const on = today(ctx);
  const [row] = await ctx.db
    .insert(injuries)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      conditionId: d.conditionId,
      protocolId: d.protocolId ?? null,
      side: d.side,
      occurredOn: d.occurredOn,
      mechanism: d.mechanism ?? null,
      diagnosisEnc: d.diagnosis ? encrypt(ctx.keys.encryptionKey, d.diagnosis) : null,
      professional: d.professional ?? null,
      clinicalClearanceOn: d.clinicalClearanceOn ?? null,
      restrictions: d.restrictions ?? null,
      notes: d.notes ?? null,
      currentPhaseId: firstPhase,
      phaseStartedOn: firstPhase ? on : null,
      createdBy: ctx.actor.userId,
    })
    .returning({ id: injuries.id });
  if (firstPhase)
    await ctx.db.insert(injuryPhaseHistory).values({
      organizationId: ctx.actor.organizationId,
      clientId,
      injuryId: row!.id,
      phaseId: firstPhase,
      startedOn: on,
      advancedBy: ctx.actor.userId,
    });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'injury',
    entityId: row!.id,
    clientId,
    // The diagnosis and free text are not copied into the audit trail.
    changes: { conditionId: d.conditionId, protocolId: d.protocolId ?? null, side: d.side },
  });
  return { id: row!.id };
}

/** Records symptoms and raises the safety alerts of the protocol's thresholds. */
async function recordSymptom_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  input: unknown,
) {
  const d = parse(symptomSchema, input);
  await staff(ctx, 'health:write', clientId);
  await requireHealthConsent(ctx.db, clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  if (injury.status === 'closed') throw new DomainError('conflict', 'El caso está cerrado.');
  const [prev] = await ctx.db
    .select()
    .from(injurySymptoms)
    .where(
      and(
        eq(injurySymptoms.injuryId, injury.id),
        sql`${injurySymptoms.recordedOn} <= ${d.recordedOn}`,
      ),
    )
    .orderBy(desc(injurySymptoms.recordedOn), desc(injurySymptoms.createdAt))
    .limit(1);
  let threshold = 5;
  if (injury.protocolId) {
    const [p] = await ctx.db
      .select({ t: injuryProtocols.painThreshold })
      .from(injuryProtocols)
      .where(eq(injuryProtocols.id, injury.protocolId));
    threshold = p?.t ?? 5;
  }
  const alerts = symptomAlerts(d, prev ?? null, threshold);
  const [row] = await ctx.db
    .insert(injurySymptoms)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      injuryId: injury.id,
      recordedOn: d.recordedOn,
      pain: d.pain,
      worseThanBefore: d.worseThanBefore,
      persistsNextDay: d.persistsNextDay,
      functionLoss: d.functionLoss,
      neurological: d.neurological,
      swelling: d.swelling,
      instability: d.instability,
      adverseReaction: d.adverseReaction,
      noteEnc: d.note ? encrypt(ctx.keys.encryptionKey, d.note) : null,
      recordedBy: ctx.actor.userId,
    })
    .returning({ id: injurySymptoms.id });
  if (alerts.length)
    await ctx.db.insert(injuryAlerts).values(
      alerts.map((a) => ({
        organizationId: ctx.actor.organizationId,
        clientId,
        injuryId: injury.id,
        symptomId: row!.id,
        kind: a.kind,
        severity: a.severity,
        message: a.message,
      })),
    );
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'injury_symptom',
    entityId: row!.id,
    clientId,
    changes: { injuryId: injury.id, pain: d.pain, alerts: alerts.map((a) => a.kind) },
  });
  return { id: row!.id, alerts };
}

/** A person reviews an alert (with a note); only then can the phase advance again. */
async function reviewInjuryAlert_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  alertId: string,
  input: unknown,
) {
  const d = parse(reviewAlertSchema, input);
  await staff(ctx, 'health:write', clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  const updated = await ctx.db
    .update(injuryAlerts)
    .set({ reviewedAt: ctx.now(), reviewedBy: ctx.actor.userId, reviewNote: d.note })
    .where(
      and(
        eq(injuryAlerts.id, alertId),
        eq(injuryAlerts.injuryId, injury.id),
        isNull(injuryAlerts.reviewedAt),
      ),
    )
    .returning({ id: injuryAlerts.id });
  if (!updated.length) throw new DomainError('not_found', 'Alerta no encontrada o ya revisada.');
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'injury_alert',
    entityId: alertId,
    clientId,
    changes: { reviewed: true },
  });
  return { id: alertId };
}

/** Manual check of a criterion of the current phase (qualitative, or measured elsewhere). */
async function checkInjuryCriterion_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  input: unknown,
) {
  const d = parse(criterionCheckSchema, input);
  await staff(ctx, 'health:write', clientId);
  await requireHealthConsent(ctx.db, clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  if (injury.status === 'closed') throw new DomainError('conflict', 'El caso está cerrado.');
  const [crit] = await ctx.db
    .select({ id: injuryProtocolCriteria.id, phaseId: injuryProtocolCriteria.phaseId })
    .from(injuryProtocolCriteria)
    .where(eq(injuryProtocolCriteria.id, d.criterionId));
  if (!crit || crit.phaseId !== injury.currentPhaseId)
    throw new DomainError('validation', 'El criterio no es de la fase actual.', {
      criterionId: ['not_current_phase'],
    });
  checkLanguage('note', d.note);
  const [row] = await ctx.db
    .insert(injuryCriterionChecks)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      injuryId: injury.id,
      criterionId: crit.id,
      met: d.met,
      source: 'manual',
      checkedBy: ctx.actor.userId,
      note: d.note ?? null,
    })
    .returning({ id: injuryCriterionChecks.id });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'injury_criterion_check',
    entityId: row!.id,
    clientId,
    changes: { criterionId: crit.id, met: d.met },
  });
  return { id: row!.id };
}

/**
 * [Avanzar de fase]: only when every mandatory criterion is met and no alert is open. The state
 * that allowed it (automatic values included) is stored as checks, for traceability.
 */
async function advanceInjuryPhase_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  input: unknown,
) {
  const d = parse(advancePhaseSchema, input);
  await staff(ctx, 'health:write', clientId);
  await requireHealthConsent(ctx.db, clientId);
  checkLanguage('note', d.note);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  if (injury.currentPhaseId !== d.fromPhaseId)
    throw new DomainError('conflict', 'La fase ha cambiado mientras tanto: recarga la página.');
  const c = await caseOf(ctx, injury);
  if (!c.advance.allowed)
    throw new DomainError('conflict', c.advance.reasons.join(' '), {
      phase: c.advance.reasons,
    });
  const next = c.protocol!.phases[c.phase!.index + 1]!;
  const on = today(ctx);
  const autos = [...c.states.values()].filter((s) => s.source === 'auto');
  if (autos.length)
    await ctx.db.insert(injuryCriterionChecks).values(
      autos.map((s) => ({
        organizationId: ctx.actor.organizationId,
        clientId,
        injuryId: injury.id,
        criterionId: s.id,
        met: s.met!,
        value: s.value == null ? null : String(s.value),
        source: 'auto',
        assessmentId: s.assessmentId,
        checkedBy: ctx.actor.userId,
      })),
    );
  await ctx.db
    .update(injuryPhaseHistory)
    .set({ endedOn: on, note: d.note ?? null })
    .where(and(eq(injuryPhaseHistory.injuryId, injury.id), isNull(injuryPhaseHistory.endedOn)));
  await ctx.db.insert(injuryPhaseHistory).values({
    organizationId: ctx.actor.organizationId,
    clientId,
    injuryId: injury.id,
    phaseId: next.id,
    startedOn: on,
    advancedBy: ctx.actor.userId,
  });
  await ctx.db
    .update(injuries)
    .set({
      currentPhaseId: next.id,
      phaseStartedOn: on,
      updatedAt: ctx.now(),
      updatedBy: ctx.actor.userId,
      version: sql`${injuries.version} + 1`,
    })
    .where(eq(injuries.id, injury.id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'injury',
    entityId: injury.id,
    clientId,
    changes: { phase: { from: c.phase!.id, to: next.id } },
  });
  return { phaseId: next.id, number: next.index + 1, name: next.name };
}

/** «Listo para valoración» → the trainer asks the responsible team for a decision. */
async function requestInjuryDecision_(ctx: RequestContext, clientId: string, injuryId: string) {
  await staff(ctx, 'health:write', clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  const c = await caseOf(ctx, injury);
  if (c.status !== 'ready_for_assessment')
    throw new DomainError(
      'conflict',
      'Solo puede pedirse la valoración cuando el caso está «Listo para valoración».',
    );
  await ctx.db
    .update(injuries)
    .set({ decisionRequestedAt: ctx.now(), updatedAt: ctx.now(), updatedBy: ctx.actor.userId })
    .where(eq(injuries.id, injury.id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'injury',
    entityId: injury.id,
    clientId,
    changes: { decisionRequested: true },
  });
  return { ok: true };
}

/** The human decision (stage, outcome, who and in which role). Never computed. */
async function recordRtpDecision_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  input: unknown,
) {
  const d = parse(rtpDecisionSchema, input);
  await staff(ctx, 'health:write', clientId);
  await requireHealthConsent(ctx.db, clientId);
  checkLanguage('rationale', d.rationale);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  if (injury.status === 'closed') throw new DomainError('conflict', 'El caso está cerrado.');
  const [row] = await ctx.db
    .insert(rtpDecisions)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      injuryId: injury.id,
      stage: d.stage,
      outcome: d.outcome,
      decidedByName: d.decidedByName,
      decidedByRole: d.decidedByRole,
      decidedOn: d.decidedOn,
      rationale: d.rationale ?? null,
      recordedBy: ctx.actor.userId,
    })
    .returning({ id: rtpDecisions.id });
  await ctx.db
    .update(injuries)
    .set({ decisionRequestedAt: null, updatedAt: ctx.now(), updatedBy: ctx.actor.userId })
    .where(eq(injuries.id, injury.id));
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'rtp_decision',
    entityId: row!.id,
    clientId,
    changes: { stage: d.stage, outcome: d.outcome, decidedByRole: d.decidedByRole },
  });
  return { id: row!.id };
}

async function closeInjury_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  input: unknown,
) {
  const d = parse(closeInjurySchema, input ?? {});
  await staff(ctx, 'health:write', clientId);
  checkLanguage('note', d.note);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  if (injury.status === 'closed') return { ok: true };
  await ctx.db
    .update(injuryPhaseHistory)
    .set({ endedOn: today(ctx), note: d.note ?? null })
    .where(and(eq(injuryPhaseHistory.injuryId, injury.id), isNull(injuryPhaseHistory.endedOn)));
  await ctx.db
    .update(injuries)
    .set({
      status: 'closed',
      closedAt: ctx.now(),
      decisionRequestedAt: null,
      updatedAt: ctx.now(),
      updatedBy: ctx.actor.userId,
      version: sql`${injuries.version} + 1`,
    })
    .where(eq(injuries.id, injury.id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'injury',
    entityId: injury.id,
    clientId,
    changes: { status: 'closed' },
  });
  return { ok: true };
}

// ── Readaptation comparison (§25–§26) ────────────────────────────────────────

/**
 * Only the protocol's variables (its phases' recommended tests and the tests of its criteria).
 * Columns: the latest assessment before the injury (baseline) and every one after it, each with
 * the phase it fell in. A vs B (default: baseline or first after, and the latest) with the reading
 * against the measurement error and the LSI of sided tests.
 */
async function injuryComparison_(
  ctx: RequestContext,
  clientId: string,
  injuryId: string,
  query: unknown,
) {
  const q = parse(injuryComparisonQuerySchema, query ?? {});
  await staff(ctx, 'health:read', clientId);
  const injury = await loadInjury(ctx.db, clientId, injuryId);
  const protocol = injury.protocolId ? await protocolDetail(ctx.db, injury.protocolId) : null;
  const slugs = [
    ...new Set(
      (protocol?.phases ?? []).flatMap((p) => [
        ...p.recommendedTests,
        ...p.criteria.flatMap((c) => (c.auto ? [c.auto.testSlug] : [])),
      ]),
    ),
  ];
  const empty = { tests: [], columns: [], a: null, b: null, rows: [] };
  if (!slugs.length) return { ...empty, notes: ['El protocolo no define tests.'] };
  const rows = await ctx.db
    .select({
      testId: assessmentTests.id,
      slug: assessmentTests.slug,
      name: assessmentTests.name,
      unit: assessmentTests.unit,
      better: assessmentTests.betterDirection,
      side: assessmentResults.side,
      value: assessmentResults.value,
      assessmentId: assessments.id,
      assessedOn: assessments.assessedOn,
    })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        inArray(assessmentTests.slug, slugs),
        eq(assessmentResults.valid, true),
        sql`${assessmentResults.value} IS NOT NULL`,
        sql`${assessments.status} <> 'cancelled'`,
      ),
    )
    .orderBy(asc(assessments.assessedOn), asc(assessments.createdAt));
  await writeAudit(ctx.db, ctx, {
    action: 'view_sensitive',
    entityType: 'injury',
    entityId: injury.id,
    clientId,
  });
  const dates = new Map<string, string>();
  for (const r of rows) dates.set(r.assessmentId, r.assessedOn);
  const before = [...dates].filter(([, d]) => d < injury.occurredOn).at(-1);
  const after = [...dates].filter(([, d]) => d >= injury.occurredOn);
  const history = await ctx.db
    .select({ phaseId: injuryPhaseHistory.phaseId, startedOn: injuryPhaseHistory.startedOn })
    .from(injuryPhaseHistory)
    .where(eq(injuryPhaseHistory.injuryId, injury.id))
    .orderBy(asc(injuryPhaseHistory.startedOn), asc(injuryPhaseHistory.createdAt));
  const phaseAt = (date: string) => {
    const h = history.filter((x) => x.startedOn <= date).at(-1);
    return h ? (protocol?.phases.find((p) => p.id === h.phaseId)?.name ?? null) : null;
  };
  const columns = [
    ...(before
      ? [{ id: before[0], date: before[1], label: 'Antes de la lesión', phase: null }]
      : []),
    ...after.map(([id, date]) => ({ id, date, label: date, phase: phaseAt(date) })),
  ];
  if (!columns.length)
    return { ...empty, notes: ['Sin evaluaciones con los tests del protocolo.'] };
  const pick = (id: string | undefined) => {
    if (!id) return null;
    const c = columns.find((x) => x.id === id);
    if (!c) throw new DomainError('not_found', 'Evaluación no encontrada.');
    return c;
  };
  const b = pick(q.b) ?? columns.at(-1)!;
  const a = q.a ? pick(q.a) : columns.length > 1 ? columns.find((x) => x.id !== b.id)! : null;

  const [cc, rels] = await Promise.all([
    loadClientContext(ctx, clientId, false),
    reliabilityRows(ctx.db, [...new Set(rows.map((r) => r.testId))]),
  ]);
  const involved = injury.side;
  const tests = new Map<
    string,
    {
      testId: string;
      name: string;
      unit: string;
      better: Direction;
      cells: Map<string, Measurement>;
    }
  >();
  for (const r of rows) {
    let t = tests.get(r.slug);
    if (!t) {
      t = { testId: r.testId, name: r.name, unit: r.unit, better: r.better, cells: new Map() };
      tests.set(r.slug, t);
    }
    let m = t.cells.get(r.assessmentId);
    if (!m) {
      m = { better: r.better };
      t.cells.set(r.assessmentId, m);
    }
    const v = Number(r.value);
    if (r.side === 'left') m.left = v;
    else if (r.side === 'right') m.right = v;
    else m.value = v;
  }
  // The involved side's value when sided (that is what readaptation follows), else the value.
  const valueOf = (m: Measurement | undefined) => {
    if (!m) return null;
    if (m.value != null) return m.value;
    if (involved === 'left' && m.left != null) return m.left;
    if (involved === 'right' && m.right != null) return m.right;
    const xs = [m.left, m.right].filter((x): x is number => x != null);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const lsiOf = (m: Measurement | undefined) => {
    if (!m || m.left == null || m.right == null) return null;
    const r = evaluateCriterion(
      {
        id: '',
        role: 'progression',
        text: '',
        mandatory: false,
        auto: { testSlug: '', metric: 'lsi', operator: '>=', threshold: 0 },
      },
      m,
      involved,
    );
    return r?.value ?? null;
  };
  const out = [...tests.entries()]
    .map(([slug, t]) => {
      const va = a ? valueOf(t.cells.get(a.id)) : null;
      const vb = valueOf(t.cells.get(b.id));
      const err =
        va != null
          ? pickMeasurementError(
              toReliability(
                rels.filter((x) => x.r.testId === t.testId),
                cc.subject,
              ),
              t.unit,
              va,
              null,
            )
          : null;
      const ch = readChange(va, vb, t.better, err);
      return {
        slug,
        name: t.name,
        unit: t.unit,
        better: t.better,
        cells: columns.map((col) => {
          const m = t.cells.get(col.id);
          return {
            assessmentId: col.id,
            value: valueOf(m),
            left: m?.left ?? null,
            right: m?.right ?? null,
            lsi: lsiOf(m),
          };
        }),
        a: va,
        b: vb,
        lsiB: lsiOf(t.cells.get(b.id)),
        reading: ch.reading,
        readingLabel: READING_LABELS[ch.reading],
        delta: ch.delta,
        deltaPercent: ch.deltaPercent,
        errorKnown: ch.errorKnown,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name, 'es'));
  const notes: string[] = [];
  if (!before) notes.push('No hay evaluación previa a la lesión: no hay línea base propia.');
  if (involved === 'both' || involved === 'none')
    notes.push(
      'Sin lado afectado definido: en los tests bilaterales se usa la media de los lados.',
    );
  return {
    tests: slugs,
    columns,
    a: a ? { id: a.id, date: a.date } : null,
    b: { id: b.id, date: b.date },
    rows: out,
    notes,
  };
}
export type InjuryComparison = Awaited<ReturnType<typeof injuryComparison_>>;

export const listInjuryCatalog = secured(listInjuryCatalog_);
export const getInjuryProtocol = secured(getInjuryProtocol_);
export const listClientInjuries = secured(listClientInjuries_);
export const getInjury = secured(getInjury_);
export const injuryCaseCount = secured(injuryCaseCount_);
export const openInjury = secured(openInjury_);
export const recordInjurySymptom = secured(recordSymptom_);
export const reviewInjuryAlert = secured(reviewInjuryAlert_);
export const checkInjuryCriterion = secured(checkInjuryCriterion_);
export const advanceInjuryPhase = secured(advanceInjuryPhase_);
export const requestInjuryDecision = secured(requestInjuryDecision_);
export const recordRtpDecision = secured(recordRtpDecision_);
export const closeInjury = secured(closeInjury_);
export const injuryComparison = secured(injuryComparison_);
