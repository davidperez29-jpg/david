import {
  claimSchema,
  evidenceReviewSchema,
  exerciseMethodsSchema,
  findingSchema,
  listScienceSchema,
  methodSchema,
  sourceSchema,
  statusSchema,
  updateClaimSchema,
  updateMethodSchema,
  updateSourceSchema,
  verifySourceSchema,
  type Page,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  claimLevel,
  diffFields,
  DomainError,
  gradeFinding,
  LEVEL_LABELS,
  qaClaim,
  qaFinding,
  qaSource,
  slugify,
  type EvidenceLevel,
  type GradingRationale,
  type QaFinding,
  type QaIssue,
  type QaSource,
  type StudyDesign,
  evidenceKindIssue,
  type EvidenceKind,
} from '@tp/domain';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const {
  evidenceSources,
  evidenceFindings,
  knowledgeClaims,
  claimEvidence,
  methods,
  methodVariables,
  methodEvidence,
  methodNotes,
  evidenceReviews,
  populations,
  outcomes,
  exerciseMethodLinks,
  exercises,
} = schema;

const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));
const orgWrite = (ctx: RequestContext) =>
  requirePermission(ctx, 'science:write', { organizationId: ctx.actor.organizationId });
const orgPublish = (ctx: RequestContext) =>
  requirePermission(ctx, 'science:publish', { organizationId: ctx.actor.organizationId });
const isVerified = (s: string) => s === 'verified' || s === 'verified_with_corrections';

async function own<T extends { organizationId: string | null }>(
  row: T | undefined,
  what: string,
): Promise<T> {
  if (!row) throw new DomainError('not_found', `${what} no encontrado/a.`);
  if (row.organizationId === null)
    throw new DomainError('forbidden', 'El contenido global es de solo lectura.');
  return row;
}

// ── Taxonomies ────────────────────────────────────────────────────────────────

async function listScienceTaxonomies_(ctx: RequestContext) {
  requirePermission(ctx, 'science:read');
  const [pops, outs] = await Promise.all([
    ctx.db
      .select()
      .from(populations)
      .where(visible(ctx, populations.organizationId))
      .orderBy(asc(populations.name)),
    ctx.db
      .select()
      .from(outcomes)
      .where(visible(ctx, outcomes.organizationId))
      .orderBy(asc(outcomes.domain), asc(outcomes.name)),
  ]);
  return { populations: pops, outcomes: outs };
}
export type ScienceTaxonomies = Awaited<ReturnType<typeof listScienceTaxonomies_>>;

// ── Level recomputation ───────────────────────────────────────────────────────

/** Recomputes finding levels for the given sources and the levels of every dependent claim. */
async function recompute(tx: Executor, sourceIds: string[]): Promise<void> {
  if (!sourceIds.length) return;
  const rows = await tx
    .select({
      f: evidenceFindings,
      status: evidenceSources.verificationStatus,
      design: evidenceSources.studyDesign,
    })
    .from(evidenceFindings)
    .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
    .where(inArray(evidenceFindings.sourceId, sourceIds));
  for (const r of rows) {
    const rationale = {
      ...(r.f.gradingRationale as GradingRationale),
      design: r.design as StudyDesign,
    };
    const g = gradeFinding(rationale, isVerified(r.status));
    if (g.level !== r.f.evidenceLevel)
      await tx
        .update(evidenceFindings)
        .set({ evidenceLevel: g.level })
        .where(eq(evidenceFindings.id, r.f.id));
  }
  const findingIds = rows.map((r) => r.f.id);
  if (!findingIds.length) return;
  const claimIds = (
    await tx
      .select({ id: claimEvidence.claimId })
      .from(claimEvidence)
      .where(inArray(claimEvidence.findingId, findingIds))
  ).map((r) => r.id);
  await recomputeClaims(tx, [...new Set(claimIds)]);
}

async function recomputeClaims(tx: Executor, claimIds: string[]): Promise<void> {
  for (const id of claimIds) {
    const ev = await tx
      .select({ level: evidenceFindings.evidenceLevel, role: claimEvidence.role })
      .from(claimEvidence)
      .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
      .where(eq(claimEvidence.claimId, id));
    await tx
      .update(knowledgeClaims)
      .set({ evidenceLevel: claimLevel(ev) })
      .where(eq(knowledgeClaims.id, id));
  }
}

// ── Sources ───────────────────────────────────────────────────────────────────

async function listSources_(
  ctx: RequestContext,
  query: unknown,
): Promise<
  Page<{
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    journal: string | null;
    doi: string | null;
    pmid: string | null;
    studyDesign: string;
    verificationStatus: string;
    findings: number;
    isGlobal: boolean;
  }>
> {
  const q = parse(listScienceSchema, query ?? {});
  requirePermission(ctx, 'science:read');
  const conds: (SQL | undefined)[] = [visible(ctx, evidenceSources.organizationId)];
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(evidenceSources.title, like),
        ilike(evidenceSources.journal, like),
        eq(evidenceSources.doi, q.q),
        eq(evidenceSources.pmid, q.q),
        sql`${evidenceSources.authors}::text ILIKE ${like}`,
      ),
    );
  }
  if (q.design) conds.push(eq(evidenceSources.studyDesign, q.design));
  if (q.status) conds.push(eq(evidenceSources.verificationStatus, q.status as 'verified'));
  const where = and(...conds);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(evidenceSources)
    .where(where);
  const rows = await ctx.db
    .select({
      id: evidenceSources.id,
      title: evidenceSources.title,
      authors: evidenceSources.authors,
      year: evidenceSources.year,
      journal: evidenceSources.journal,
      doi: evidenceSources.doi,
      pmid: evidenceSources.pmid,
      studyDesign: evidenceSources.studyDesign,
      verificationStatus: evidenceSources.verificationStatus,
      organizationId: evidenceSources.organizationId,
      findings: sql<number>`(SELECT count(*)::int FROM evidence_findings f WHERE f.source_id = ${evidenceSources.id})`,
    })
    .from(evidenceSources)
    .where(where)
    .orderBy(desc(evidenceSources.year), asc(evidenceSources.title))
    .limit(q.limit)
    .offset(q.offset);
  return {
    items: rows.map(({ organizationId, ...r }) => ({ ...r, isGlobal: organizationId === null })),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}

async function getSource_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'science:read');
  const [s] = await ctx.db
    .select()
    .from(evidenceSources)
    .where(and(eq(evidenceSources.id, id), visible(ctx, evidenceSources.organizationId)));
  if (!s) throw new DomainError('not_found', 'Fuente no encontrada.');
  const findings = await ctx.db
    .select({ f: evidenceFindings, outcome: outcomes.name, population: populations.name })
    .from(evidenceFindings)
    .innerJoin(outcomes, eq(outcomes.id, evidenceFindings.outcomeId))
    .innerJoin(populations, eq(populations.id, evidenceFindings.populationId))
    .where(eq(evidenceFindings.sourceId, id))
    .orderBy(asc(evidenceFindings.createdAt));
  const reviews = await ctx.db
    .select()
    .from(evidenceReviews)
    .where(eq(evidenceReviews.sourceId, id))
    .orderBy(desc(evidenceReviews.reviewedOn));
  const qa: QaIssue[] = [
    ...qaSource({
      key: s.id,
      doi: s.doi,
      pmid: s.pmid,
      verificationStatus: s.verificationStatus,
      verifiedAt: s.verifiedAt,
      verificationMethod: s.verificationMethod,
      populationSummary: s.populationSummary,
    }),
    ...findings.flatMap(({ f }) =>
      qaFinding({
        key: f.id,
        sourceKey: s.id,
        populationSlug: f.populationId,
        quote: f.quote,
        effectValue: f.effectValue != null ? Number(f.effectValue) : null,
      }),
    ),
  ];
  return {
    ...s,
    isGlobal: s.organizationId === null,
    findings: findings.map(({ f, outcome, population }) => ({
      ...f,
      outcome,
      population,
      levelLabel: LEVEL_LABELS[f.evidenceLevel],
      gradingExplanation: gradeFinding(
        { ...(f.gradingRationale as GradingRationale), design: s.studyDesign as StudyDesign },
        isVerified(s.verificationStatus),
      ).explanation,
    })),
    reviews,
    qa,
  };
}
export type SourceDetail = Awaited<ReturnType<typeof getSource_>>;

type SourceInput = z.output<typeof sourceSchema>;
function sourceValues(d: Partial<SourceInput>) {
  const v: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(d)) if (val !== undefined) v[k] = val;
  return v;
}

async function createSource_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(sourceSchema, input);
  orgWrite(ctx);
  return ctx.db
    .transaction(async (tx) => {
      const [row] = await tx
        .insert(evidenceSources)
        .values({
          ...(sourceValues(d) as SourceInput),
          organizationId: ctx.actor.organizationId,
          verificationStatus: 'unverified',
          createdBy: ctx.actor.userId,
        })
        .returning({ id: evidenceSources.id });
      await writeAudit(tx, ctx, {
        action: 'create',
        entityType: 'evidence_source',
        entityId: row!.id,
        changes: { title: d.title, doi: d.doi ?? null, pmid: d.pmid ?? null },
      });
      return { id: row!.id };
    })
    .catch((e) => {
      if (String((e as { cause?: { code?: string } }).cause?.code) === '23505')
        throw new DomainError('conflict', 'Ya existe una fuente con ese DOI o PMID.');
      throw e;
    });
}

async function updateSource_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { expectedVersion, ...d } = parse(updateSourceSchema, input);
  orgWrite(ctx);
  const [before] = await ctx.db
    .select()
    .from(evidenceSources)
    .where(and(eq(evidenceSources.id, id), visible(ctx, evidenceSources.organizationId)));
  const s = await own(before, 'Fuente');
  if (s.version !== expectedVersion)
    throw new DomainError('conflict', 'La fuente ha cambiado. Recarga los datos.');
  await ctx.db.transaction(async (tx) => {
    const values = sourceValues(d);
    // Any bibliographic change invalidates a previous verification.
    const bib = ['title', 'authors', 'year', 'journal', 'doi', 'pmid'].some((k) => k in values);
    await tx
      .update(evidenceSources)
      .set({
        ...values,
        ...(bib && isVerified(s.verificationStatus)
          ? { verificationStatus: 'unverified' as const, verifiedAt: null, verifiedBy: null }
          : {}),
        version: s.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(evidenceSources.id, id));
    if (bib) await recompute(tx, [id]);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'evidence_source',
      entityId: id,
      changes: diffFields(
        s as unknown as Record<string, unknown>,
        { ...s, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

/** A person records how the source was verified (§10.3). Only verified sources support recommendations. */
async function verifySource_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const d = parse(verifySourceSchema, input);
  orgPublish(ctx);
  const [row] = await ctx.db
    .select()
    .from(evidenceSources)
    .where(and(eq(evidenceSources.id, id), visible(ctx, evidenceSources.organizationId)));
  const s = await own(row, 'Fuente');
  if (isVerified(d.status) && !s.doi && !s.pmid && !s.url) {
    throw new DomainError('validation', 'Para verificar una fuente indica DOI, PMID o URL.', {
      doi: ['required_for_verification'],
    });
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(evidenceSources)
      .set({
        verificationStatus: d.status,
        access: d.access,
        verificationMethod: d.verificationMethod,
        corrections: d.corrections ?? null,
        verifiedAt: isVerified(d.status) ? ctx.now() : null,
        verifiedBy: isVerified(d.status) ? ctx.actor.userId : null,
        version: s.version + 1,
      })
      .where(eq(evidenceSources.id, id));
    await recompute(tx, [id]);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'evidence_source',
      entityId: id,
      changes: [{ field: 'verificationStatus', before: s.verificationStatus, after: d.status }],
      reason: d.verificationMethod,
    });
  });
}

// ── Findings ──────────────────────────────────────────────────────────────────

async function addFinding_(
  ctx: RequestContext,
  sourceId: string,
  input: unknown,
): Promise<{ id: string; level: EvidenceLevel }> {
  const d = parse(findingSchema, input);
  orgWrite(ctx);
  const [row] = await ctx.db
    .select()
    .from(evidenceSources)
    .where(and(eq(evidenceSources.id, sourceId), visible(ctx, evidenceSources.organizationId)));
  const s = await own(row, 'Fuente');
  const rationale: GradingRationale = { ...d.grading, design: s.studyDesign as StudyDesign };
  const g = gradeFinding(rationale, isVerified(s.verificationStatus));
  return ctx.db.transaction(async (tx) => {
    const n = (v: number | null | undefined) => (v == null ? null : String(v));
    const [f] = await tx
      .insert(evidenceFindings)
      .values({
        organizationId: ctx.actor.organizationId,
        sourceId,
        outcomeId: d.outcomeId,
        populationId: d.populationId,
        intervention: d.intervention ?? null,
        comparator: d.comparator ?? null,
        effectMetric: d.effectMetric ?? null,
        effectValue: n(d.effectValue),
        ciLow: n(d.ciLow),
        ciHigh: n(d.ciHigh),
        nStudies: d.nStudies ?? null,
        nParticipants: d.nParticipants ?? null,
        heterogeneityI2: n(d.heterogeneityI2),
        quote: d.quote,
        gradingRationale: rationale,
        evidenceLevel: g.level,
        epistemicType: d.epistemicType,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: evidenceFindings.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'evidence_finding',
      entityId: f!.id,
      changes: { sourceId, level: g.level },
    });
    return { id: f!.id, level: g.level };
  });
}

/** Findings available to link from claims and methods (picker). */
async function listFindings_(ctx: RequestContext, query: unknown) {
  const q = parse(listScienceSchema, query ?? {});
  requirePermission(ctx, 'science:read');
  const conds: (SQL | undefined)[] = [visible(ctx, evidenceFindings.organizationId)];
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(evidenceSources.title, like),
        ilike(evidenceFindings.quote, like),
        ilike(outcomes.name, like),
        ilike(evidenceFindings.findingKey, like),
      ),
    );
  }
  if (q.level) conds.push(eq(evidenceFindings.evidenceLevel, q.level));
  return ctx.db
    .select({
      id: evidenceFindings.id,
      findingKey: evidenceFindings.findingKey,
      level: evidenceFindings.evidenceLevel,
      quote: evidenceFindings.quote,
      outcome: outcomes.name,
      population: populations.name,
      sourceId: evidenceSources.id,
      sourceTitle: evidenceSources.title,
      year: evidenceSources.year,
    })
    .from(evidenceFindings)
    .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
    .innerJoin(outcomes, eq(outcomes.id, evidenceFindings.outcomeId))
    .innerJoin(populations, eq(populations.id, evidenceFindings.populationId))
    .where(and(...conds))
    .orderBy(asc(evidenceSources.title))
    .limit(q.limit)
    .offset(q.offset);
}
export type FindingOption = Awaited<ReturnType<typeof listFindings_>>[number];

async function deleteFinding_(ctx: RequestContext, findingId: string): Promise<void> {
  orgWrite(ctx);
  const [row] = await ctx.db
    .select()
    .from(evidenceFindings)
    .where(eq(evidenceFindings.id, findingId));
  await own(row, 'Hallazgo');
  await ctx.db.transaction(async (tx) => {
    const claimIds = (
      await tx
        .select({ id: claimEvidence.claimId })
        .from(claimEvidence)
        .where(eq(claimEvidence.findingId, findingId))
    ).map((r) => r.id);
    await tx.delete(evidenceFindings).where(eq(evidenceFindings.id, findingId));
    await recomputeClaims(tx, claimIds);
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'evidence_finding',
      entityId: findingId,
    });
  });
}

// ── Claims ────────────────────────────────────────────────────────────────────

async function listClaims_(ctx: RequestContext, query: unknown) {
  const q = parse(listScienceSchema, query ?? {});
  requirePermission(ctx, 'science:read');
  const conds: (SQL | undefined)[] = [visible(ctx, knowledgeClaims.organizationId)];
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(knowledgeClaims.statement, like),
        ilike(knowledgeClaims.scope, like),
        ilike(knowledgeClaims.key, like),
      ),
    );
  }
  if (q.level) conds.push(eq(knowledgeClaims.evidenceLevel, q.level));
  if (q.status) conds.push(eq(knowledgeClaims.status, q.status as 'draft'));
  const where = and(...conds);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(knowledgeClaims)
    .where(where);
  const rows = await ctx.db
    .select()
    .from(knowledgeClaims)
    .where(where)
    .orderBy(asc(knowledgeClaims.scope), asc(knowledgeClaims.key))
    .limit(q.limit)
    .offset(q.offset);
  return {
    items: rows.map((r) => ({
      ...r,
      isGlobal: r.organizationId === null,
      levelLabel: LEVEL_LABELS[r.evidenceLevel],
    })),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}

async function claimEvidenceRows(db: Executor, claimId: string) {
  return db
    .select({
      findingId: evidenceFindings.id,
      findingKey: evidenceFindings.findingKey,
      role: claimEvidence.role,
      level: evidenceFindings.evidenceLevel,
      quote: evidenceFindings.quote,
      effectMetric: evidenceFindings.effectMetric,
      effectValue: evidenceFindings.effectValue,
      ciLow: evidenceFindings.ciLow,
      ciHigh: evidenceFindings.ciHigh,
      intervention: evidenceFindings.intervention,
      comparator: evidenceFindings.comparator,
      outcome: outcomes.name,
      population: populations.name,
      populationSlug: populations.slug,
      sourceId: evidenceSources.id,
      sourceTitle: evidenceSources.title,
      sourceYear: evidenceSources.year,
      sourceAuthors: evidenceSources.authors,
      journal: evidenceSources.journal,
      doi: evidenceSources.doi,
      pmid: evidenceSources.pmid,
      design: evidenceSources.studyDesign,
      verificationStatus: evidenceSources.verificationStatus,
      verifiedAt: evidenceSources.verifiedAt,
      verificationMethod: evidenceSources.verificationMethod,
      access: evidenceSources.access,
    })
    .from(claimEvidence)
    .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
    .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
    .innerJoin(outcomes, eq(outcomes.id, evidenceFindings.outcomeId))
    .innerJoin(populations, eq(populations.id, evidenceFindings.populationId))
    .where(eq(claimEvidence.claimId, claimId));
}

function claimQa(
  c: {
    id: string;
    statement: string;
    status: string;
    evidenceLevel: EvidenceLevel;
    applicability: unknown;
    evidenceKind?: EvidenceKind | null;
  },
  ev: Awaited<ReturnType<typeof claimEvidenceRows>>,
): QaIssue[] {
  const findings = new Map<string, QaFinding>(
    ev.map((e) => [
      e.findingId,
      {
        key: e.findingId,
        sourceKey: e.sourceId,
        populationSlug: e.populationSlug,
        quote: e.quote,
        effectValue: e.effectValue != null ? Number(e.effectValue) : null,
      },
    ]),
  );
  const sources = new Map<string, QaSource>(
    ev.map((e) => [
      e.sourceId,
      {
        key: e.sourceId,
        doi: e.doi,
        pmid: e.pmid,
        verificationStatus: e.verificationStatus,
        verifiedAt: e.verifiedAt,
        verificationMethod: e.verificationMethod,
        populationSummary: 'x',
      },
    ]),
  );
  const appliesTo = ((c.applicability as { appliesTo?: string[] } | null)?.appliesTo ??
    []) as string[];
  return qaClaim(
    {
      key: c.id,
      statement: c.statement,
      status: c.status,
      level: c.evidenceLevel,
      appliesTo,
      evidenceKind: c.evidenceKind ?? null,
      findings: ev.map((e) => ({ findingKey: e.findingId, role: e.role })),
    },
    findings,
    sources,
  );
}

async function getClaim_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'science:read');
  const [c] = await ctx.db
    .select()
    .from(knowledgeClaims)
    .where(and(eq(knowledgeClaims.id, id), visible(ctx, knowledgeClaims.organizationId)));
  if (!c) throw new DomainError('not_found', 'Afirmación no encontrada.');
  const ev = await claimEvidenceRows(ctx.db, id);
  const reviews = await ctx.db
    .select()
    .from(evidenceReviews)
    .where(eq(evidenceReviews.claimId, id))
    .orderBy(desc(evidenceReviews.reviewedOn));
  const usedBy = await ctx.db
    .select({
      methodId: methods.id,
      methodName: methods.name,
      variableKey: methodVariables.variableKey,
    })
    .from(methodVariables)
    .innerJoin(methods, eq(methods.id, methodVariables.methodId))
    .where(eq(methodVariables.claimId, id));
  return {
    ...c,
    isGlobal: c.organizationId === null,
    levelLabel: LEVEL_LABELS[c.evidenceLevel],
    evidence: ev,
    reviews,
    usedBy,
    qa: claimQa(c, ev),
  };
}
export type ClaimDetail = Awaited<ReturnType<typeof getClaim_>>;

async function assertFindingsVisible(ctx: RequestContext, tx: Executor, ids: string[]) {
  if (!ids.length) return;
  const rows = await tx
    .select({ id: evidenceFindings.id })
    .from(evidenceFindings)
    .where(and(inArray(evidenceFindings.id, ids), visible(ctx, evidenceFindings.organizationId)));
  if (rows.length !== new Set(ids).size)
    throw new DomainError('validation', 'Hallazgo desconocido.', { findings: ['unknown'] });
}

/** «Reduce el riesgo de lesión» needs incidence evidence (SCIENCE_SYSTEM.md §3). */
function checkEvidenceKind(statement: string, kind: EvidenceKind | null | undefined) {
  const issue = evidenceKindIssue(statement, kind ?? null);
  if (issue) throw new DomainError('validation', issue, { evidenceKind: [issue] });
}

async function createClaim_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(claimSchema, input);
  orgWrite(ctx);
  checkEvidenceKind(d.statement, d.evidenceKind);
  return ctx.db.transaction(async (tx) => {
    await assertFindingsVisible(
      ctx,
      tx,
      d.findings.map((f) => f.findingId),
    );
    const [c] = await tx
      .insert(knowledgeClaims)
      .values({
        organizationId: ctx.actor.organizationId,
        key: d.key,
        statement: d.statement,
        scope: d.scope ?? null,
        epistemicType: d.epistemicType,
        confidence: d.confidence,
        limitations: d.limitations ?? null,
        applicability: { appliesTo: d.appliesTo, notFor: d.notFor },
        evidenceKind: d.evidenceKind ?? null,
        origin: d.origin ?? (d.findings.length ? 'external_literature' : 'practical_proposal'),
        status: 'draft',
        createdBy: ctx.actor.userId,
      })
      .returning({ id: knowledgeClaims.id })
      .catch((e) => {
        if (String((e as { cause?: { code?: string } }).cause?.code) === '23505')
          throw new DomainError('conflict', 'Ya existe una afirmación con esa clave.');
        throw e;
      });
    if (d.findings.length)
      await tx
        .insert(claimEvidence)
        .values(d.findings.map((f) => ({ claimId: c!.id, findingId: f.findingId, role: f.role })));
    await recomputeClaims(tx, [c!.id]);
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'knowledge_claim',
      entityId: c!.id,
      changes: { key: d.key },
    });
    return { id: c!.id };
  });
}

async function updateClaim_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { expectedVersion, findings, appliesTo, notFor, ...d } = parse(updateClaimSchema, input);
  orgWrite(ctx);
  const [row] = await ctx.db
    .select()
    .from(knowledgeClaims)
    .where(and(eq(knowledgeClaims.id, id), visible(ctx, knowledgeClaims.organizationId)));
  const c = await own(row, 'Afirmación');
  if (c.version !== expectedVersion)
    throw new DomainError('conflict', 'La afirmación ha cambiado. Recarga los datos.');
  await ctx.db.transaction(async (tx) => {
    const prevApp = (c.applicability as { appliesTo?: string[]; notFor?: string[] } | null) ?? {};
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v ?? null;
    if (appliesTo || notFor)
      values.applicability = {
        appliesTo: appliesTo ?? prevApp.appliesTo ?? [],
        notFor: notFor ?? prevApp.notFor ?? [],
      };
    checkEvidenceKind(
      (values.statement as string | undefined) ?? c.statement,
      values.evidenceKind !== undefined
        ? (values.evidenceKind as EvidenceKind | null)
        : c.evidenceKind,
    );
    // Editing a published claim sends it back to draft: it must be reviewed again.
    await tx
      .update(knowledgeClaims)
      .set({
        ...values,
        status: c.status === 'published' ? 'draft' : c.status,
        version: c.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(knowledgeClaims.id, id));
    if (findings) {
      await assertFindingsVisible(
        ctx,
        tx,
        findings.map((f) => f.findingId),
      );
      await tx.delete(claimEvidence).where(eq(claimEvidence.claimId, id));
      if (findings.length)
        await tx
          .insert(claimEvidence)
          .values(findings.map((f) => ({ claimId: id, findingId: f.findingId, role: f.role })));
    }
    await recomputeClaims(tx, [id]);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'knowledge_claim',
      entityId: id,
      changes: diffFields(
        c as unknown as Record<string, unknown>,
        { ...c, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

/** Publishing requires no QA errors (§10.6) and the ADMIN role. */
async function setClaimStatus_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { status } = parse(statusSchema, input);
  if (status === 'published' || status === 'reviewed') orgPublish(ctx);
  else orgWrite(ctx);
  const detail = await getClaim_(ctx, id);
  if (detail.isGlobal)
    throw new DomainError('forbidden', 'El contenido global es de solo lectura.');
  if (status === 'published') {
    const errors = detail.qa.filter((i) => i.severity === 'error');
    if (errors.length)
      throw new DomainError(
        'validation',
        'La afirmación no supera el control de calidad científico.',
        { qa: errors.map((e) => e.message) },
      );
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(knowledgeClaims)
      .set({
        status,
        ...(status === 'published' || status === 'reviewed'
          ? { reviewedBy: ctx.actor.userId, reviewedAt: ctx.now() }
          : {}),
        version: detail.version + 1,
      })
      .where(eq(knowledgeClaims.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'knowledge_claim',
      entityId: id,
      changes: [{ field: 'status', before: detail.status, after: status }],
    });
  });
}

// ── Reviews (Scientific QA checklist) ─────────────────────────────────────────

async function addEvidenceReview_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(evidenceReviewSchema, input);
  orgPublish(ctx);
  if (d.target === 'source') await getSource_(ctx, d.targetId);
  else await getClaim_(ctx, d.targetId);
  const failed = Object.entries(d.checklist)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (d.outcome === 'approved' && failed.length) {
    throw new DomainError('validation', 'No se puede aprobar con puntos de la lista sin cumplir.', {
      checklist: failed,
    });
  }
  return ctx.db.transaction(async (tx) => {
    const [r] = await tx
      .insert(evidenceReviews)
      .values({
        organizationId: ctx.actor.organizationId,
        sourceId: d.target === 'source' ? d.targetId : null,
        claimId: d.target === 'claim' ? d.targetId : null,
        reviewerId: ctx.actor.userId,
        reviewedOn: ctx.now().toISOString().slice(0, 10),
        checklist: d.checklist,
        outcome: d.outcome,
        notes: d.notes ?? null,
      })
      .returning({ id: evidenceReviews.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'evidence_review',
      entityId: r!.id,
      changes: { target: d.target, targetId: d.targetId, outcome: d.outcome },
    });
    return { id: r!.id };
  });
}

// ── Methods ───────────────────────────────────────────────────────────────────

async function listMethods_(ctx: RequestContext) {
  requirePermission(ctx, 'science:read');
  const rows = await ctx.db
    .select({
      id: methods.id,
      slug: methods.slug,
      name: methods.name,
      kind: methods.kind,
      status: methods.status,
      summaryForTrainer: methods.summaryForTrainer,
      organizationId: methods.organizationId,
      exercises: sql<number>`(SELECT count(*)::int FROM exercise_method_links l WHERE l.method_id = ${methods.id})`,
      claims: sql<number>`(SELECT count(DISTINCT x)::int FROM (SELECT claim_id AS x FROM method_variables v WHERE v.method_id = ${methods.id} AND claim_id IS NOT NULL UNION SELECT claim_id FROM method_notes n WHERE n.method_id = ${methods.id} AND claim_id IS NOT NULL) q)`,
    })
    .from(methods)
    .where(visible(ctx, methods.organizationId))
    .orderBy(asc(methods.name));
  return rows.map(({ organizationId, ...r }) => ({ ...r, isGlobal: organizationId === null }));
}

/**
 * Full traceability (§10.1): method → variables/notes → claims (level, limitations) → findings →
 * sources (DOI/PMID, verification).
 */
async function getMethod_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'science:read');
  const [m] = await ctx.db
    .select()
    .from(methods)
    .where(and(eq(methods.id, id), visible(ctx, methods.organizationId)));
  if (!m) throw new DomainError('not_found', 'Método no encontrado.');
  const [notes, vars, ev, linked] = await Promise.all([
    ctx.db
      .select()
      .from(methodNotes)
      .where(eq(methodNotes.methodId, id))
      .orderBy(asc(methodNotes.kind), asc(methodNotes.position)),
    ctx.db
      .select({ v: methodVariables, population: populations.name })
      .from(methodVariables)
      .leftJoin(populations, eq(populations.id, methodVariables.populationId))
      .where(eq(methodVariables.methodId, id)),
    ctx.db
      .select({
        findingId: evidenceFindings.id,
        role: methodEvidence.role,
        level: evidenceFindings.evidenceLevel,
        quote: evidenceFindings.quote,
        outcome: outcomes.name,
        population: populations.name,
        sourceId: evidenceSources.id,
        sourceTitle: evidenceSources.title,
        year: evidenceSources.year,
        doi: evidenceSources.doi,
        pmid: evidenceSources.pmid,
      })
      .from(methodEvidence)
      .innerJoin(evidenceFindings, eq(evidenceFindings.id, methodEvidence.findingId))
      .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
      .innerJoin(outcomes, eq(outcomes.id, evidenceFindings.outcomeId))
      .innerJoin(populations, eq(populations.id, evidenceFindings.populationId))
      .where(eq(methodEvidence.methodId, id)),
    ctx.db
      .select({ id: exercises.id, name: exercises.name, status: exercises.status })
      .from(exerciseMethodLinks)
      .innerJoin(exercises, eq(exercises.id, exerciseMethodLinks.exerciseId))
      .where(and(eq(exerciseMethodLinks.methodId, id), visible(ctx, exercises.organizationId)))
      .orderBy(asc(exercises.name))
      .limit(200),
  ]);
  const claimIds = [
    ...new Set(
      [...notes.map((n) => n.claimId), ...vars.map((v) => v.v.claimId)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const claims = claimIds.length
    ? await ctx.db.select().from(knowledgeClaims).where(inArray(knowledgeClaims.id, claimIds))
    : [];
  const claimEv = new Map(
    await Promise.all(
      claims.map(async (c) => [c.id, await claimEvidenceRows(ctx.db, c.id)] as const),
    ),
  );
  const claimView = (cid: string | null) => {
    if (!cid) return null;
    const c = claims.find((x) => x.id === cid);
    if (!c) return null;
    return {
      id: c.id,
      key: c.key,
      statement: c.statement,
      level: c.evidenceLevel,
      levelLabel: LEVEL_LABELS[c.evidenceLevel],
      confidence: c.confidence,
      limitations: c.limitations,
      epistemicType: c.epistemicType,
      status: c.status,
      evidence: claimEv.get(c.id) ?? [],
    };
  };
  return {
    ...m,
    isGlobal: m.organizationId === null,
    notes: notes.map((n) => ({ ...n, claim: claimView(n.claimId) })),
    variables: vars.map(({ v, population }) => ({ ...v, population, claim: claimView(v.claimId) })),
    evidence: ev,
    exercises: linked,
  };
}
export type MethodDetail = Awaited<ReturnType<typeof getMethod_>>;

async function writeMethodChildren(
  ctx: RequestContext,
  tx: Executor,
  methodId: string,
  d: Partial<z.output<typeof methodSchema>>,
) {
  const claimIds = [
    ...(d.notes ?? []).map((n) => n.claimId),
    ...(d.variables ?? []).map((v) => v.claimId),
  ].filter((x): x is string => !!x);
  if (claimIds.length) {
    const ok = await tx
      .select({ id: knowledgeClaims.id })
      .from(knowledgeClaims)
      .where(
        and(inArray(knowledgeClaims.id, claimIds), visible(ctx, knowledgeClaims.organizationId)),
      );
    if (ok.length !== new Set(claimIds).size)
      throw new DomainError('validation', 'Afirmación desconocida.', { claimId: ['unknown'] });
  }
  if (d.notes) {
    await tx.delete(methodNotes).where(eq(methodNotes.methodId, methodId));
    if (d.notes.length)
      await tx.insert(methodNotes).values(
        d.notes.map((n, i) => ({
          methodId,
          kind: n.kind,
          text: n.text,
          claimId: n.claimId ?? null,
          position: i + 1,
        })),
      );
  }
  if (d.variables) {
    await tx.delete(methodVariables).where(eq(methodVariables.methodId, methodId));
    const n = (v: number | null | undefined) => (v == null ? null : String(v));
    if (d.variables.length) {
      for (const v of d.variables) {
        if (v.minValue != null && v.maxValue != null && v.minValue > v.maxValue)
          throw new DomainError('validation', 'Rango de dosis no válido (mínimo > máximo).', {
            variables: ['range'],
          });
      }
      await tx.insert(methodVariables).values(
        d.variables.map((v) => ({
          organizationId: ctx.actor.organizationId,
          methodId,
          variableKey: v.variableKey,
          populationId: v.populationId ?? null,
          minValue: n(v.minValue),
          maxValue: n(v.maxValue),
          typicalValue: n(v.typicalValue),
          unit: v.unit ?? null,
          claimId: v.claimId ?? null,
          isDefaultSuggestion: v.isDefaultSuggestion,
          notes: v.notes ?? null,
        })),
      );
    }
  }
  if (d.findings) {
    await assertFindingsVisible(
      ctx,
      tx,
      d.findings.map((f) => f.findingId),
    );
    await tx.delete(methodEvidence).where(eq(methodEvidence.methodId, methodId));
    if (d.findings.length)
      await tx
        .insert(methodEvidence)
        .values(d.findings.map((f) => ({ methodId, findingId: f.findingId, role: f.role })));
  }
}

async function createMethod_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(methodSchema, input);
  orgWrite(ctx);
  return ctx.db.transaction(async (tx) => {
    const base = slugify(d.name);
    const taken = (
      await tx
        .select({ slug: methods.slug })
        .from(methods)
        .where(
          and(
            eq(methods.organizationId, ctx.actor.organizationId),
            sql`${methods.slug} LIKE ${`${base}%`}`,
          ),
        )
    ).map((r) => r.slug);
    let slug = base;
    for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
    const [m] = await tx
      .insert(methods)
      .values({
        organizationId: ctx.actor.organizationId,
        slug,
        name: d.name,
        kind: d.kind,
        parentMethodId: d.parentMethodId ?? null,
        definition: d.definition ?? null,
        summaryForTrainer: d.summaryForTrainer ?? null,
        summaryForClient: d.summaryForClient ?? null,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: methods.id });
    await writeMethodChildren(ctx, tx, m!.id, d);
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'method',
      entityId: m!.id,
      changes: { name: d.name },
    });
    return { id: m!.id };
  });
}

async function updateMethod_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { expectedVersion, notes, variables, findings, ...d } = parse(updateMethodSchema, input);
  orgWrite(ctx);
  const [row] = await ctx.db
    .select()
    .from(methods)
    .where(and(eq(methods.id, id), visible(ctx, methods.organizationId)));
  const m = await own(row, 'Método');
  if (m.version !== expectedVersion)
    throw new DomainError('conflict', 'El método ha cambiado. Recarga los datos.');
  await ctx.db.transaction(async (tx) => {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v ?? null;
    await tx
      .update(methods)
      .set({
        ...values,
        status: m.status === 'published' ? 'draft' : m.status,
        version: m.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(methods.id, id));
    await writeMethodChildren(ctx, tx, id, { notes, variables, findings });
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'method',
      entityId: id,
      changes: diffFields(
        m as unknown as Record<string, unknown>,
        { ...m, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

async function setMethodStatus_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { status } = parse(statusSchema, input);
  if (status === 'published') orgPublish(ctx);
  else orgWrite(ctx);
  const detail = await getMethod_(ctx, id);
  if (detail.isGlobal)
    throw new DomainError('forbidden', 'El contenido global es de solo lectura.');
  if (status === 'published') {
    const problems: string[] = [];
    if (!detail.definition?.trim()) problems.push('Falta la definición.');
    for (const v of detail.variables)
      if (!v.claim)
        problems.push(`La variable «${v.variableKey}» no está justificada por ninguna afirmación.`);
    if (problems.length)
      throw new DomainError('validation', 'El método no puede publicarse todavía.', {
        publish: problems,
      });
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(methods)
      .set({ status, version: detail.version + 1 })
      .where(eq(methods.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'method',
      entityId: id,
      changes: [{ field: 'status', before: detail.status, after: status }],
    });
  });
}

/** Links an exercise (library layer) to methods (science layer) by id only (§4.2). */
async function setExerciseMethods_(
  ctx: RequestContext,
  exerciseId: string,
  input: unknown,
): Promise<void> {
  const { methodIds } = parse(exerciseMethodsSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  const [ex] = await ctx.db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), visible(ctx, exercises.organizationId)));
  await own(ex, 'Ejercicio');
  const uniq = [...new Set(methodIds)];
  if (uniq.length) {
    const ok = await ctx.db
      .select({ id: methods.id })
      .from(methods)
      .where(and(inArray(methods.id, uniq), visible(ctx, methods.organizationId)));
    if (ok.length !== uniq.length)
      throw new DomainError('validation', 'Método desconocido.', { methodIds: ['unknown'] });
  }
  await ctx.db.transaction(async (tx) => {
    await tx.delete(exerciseMethodLinks).where(eq(exerciseMethodLinks.exerciseId, exerciseId));
    if (uniq.length)
      await tx
        .insert(exerciseMethodLinks)
        .values(uniq.map((methodId) => ({ exerciseId, methodId })));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'exercise',
      entityId: exerciseId,
      changes: [{ field: 'methods', before: null, after: uniq }],
    });
  });
}

// ── QA report ────────────────────────────────────────────────────────────────

/** Runs every scientific QA check over the visible knowledge base (§10.6). */
async function scientificQaReport_(ctx: RequestContext) {
  requirePermission(ctx, 'science:read');
  const srcs = await ctx.db
    .select()
    .from(evidenceSources)
    .where(visible(ctx, evidenceSources.organizationId));
  const fnds = await ctx.db
    .select({ f: evidenceFindings, pop: populations.slug })
    .from(evidenceFindings)
    .innerJoin(populations, eq(populations.id, evidenceFindings.populationId))
    .where(visible(ctx, evidenceFindings.organizationId));
  const clms = await ctx.db
    .select()
    .from(knowledgeClaims)
    .where(visible(ctx, knowledgeClaims.organizationId));
  const links = clms.length
    ? await ctx.db
        .select()
        .from(claimEvidence)
        .where(
          inArray(
            claimEvidence.claimId,
            clms.map((c) => c.id),
          ),
        )
    : [];
  const sourceMap = new Map<string, QaSource>(
    srcs.map((s) => [
      s.id,
      {
        key: s.id,
        doi: s.doi,
        pmid: s.pmid,
        verificationStatus: s.verificationStatus,
        verifiedAt: s.verifiedAt,
        verificationMethod: s.verificationMethod,
        populationSummary: s.populationSummary,
      },
    ]),
  );
  const findingMap = new Map<string, QaFinding>(
    fnds.map(({ f, pop }) => [
      f.id,
      {
        key: f.id,
        sourceKey: f.sourceId,
        populationSlug: pop,
        quote: f.quote,
        effectValue: f.effectValue != null ? Number(f.effectValue) : null,
      },
    ]),
  );
  const issues: (QaIssue & { label: string; href: string })[] = [];
  for (const s of srcs)
    for (const i of qaSource(sourceMap.get(s.id)!))
      issues.push({ ...i, label: s.title, href: `/app/science/sources/${s.id}` });
  for (const { f } of fnds)
    for (const i of qaFinding(findingMap.get(f.id)!))
      issues.push({
        ...i,
        label: f.findingKey ?? f.id,
        href: `/app/science/sources/${f.sourceId}`,
      });
  for (const c of clms) {
    const appliesTo = ((c.applicability as { appliesTo?: string[] } | null)?.appliesTo ??
      []) as string[];
    const qa = qaClaim(
      {
        key: c.id,
        statement: c.statement,
        status: c.status,
        level: c.evidenceLevel,
        appliesTo,
        findings: links
          .filter((l) => l.claimId === c.id)
          .map((l) => ({ findingKey: l.findingId, role: l.role })),
      },
      findingMap,
      sourceMap,
    );
    for (const i of qa) issues.push({ ...i, label: c.key, href: `/app/science/claims/${c.id}` });
  }
  const levels: Record<string, number> = {};
  for (const c of clms) levels[c.evidenceLevel] = (levels[c.evidenceLevel] ?? 0) + 1;
  return {
    totals: {
      sources: srcs.length,
      verifiedSources: srcs.filter((s) => isVerified(s.verificationStatus)).length,
      findings: fnds.length,
      claims: clms.length,
      publishedClaims: clms.filter((c) => c.status === 'published').length,
    },
    claimLevels: levels,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}

// Use cases run under Row Level Security (see rls.ts).
export const listScienceTaxonomies = secured(listScienceTaxonomies_);
export const listSources = secured(listSources_);
export const getSource = secured(getSource_);
export const createSource = secured(createSource_);
export const updateSource = secured(updateSource_);
export const verifySource = secured(verifySource_);
export const addFinding = secured(addFinding_);
export const listFindings = secured(listFindings_);
export const deleteFinding = secured(deleteFinding_);
export const listClaims = secured(listClaims_);
export const getClaim = secured(getClaim_);
export const createClaim = secured(createClaim_);
export const updateClaim = secured(updateClaim_);
export const setClaimStatus = secured(setClaimStatus_);
export const addEvidenceReview = secured(addEvidenceReview_);
export const listMethods = secured(listMethods_);
export const getMethod = secured(getMethod_);
export const createMethod = secured(createMethod_);
export const updateMethod = secured(updateMethod_);
export const setMethodStatus = secured(setMethodStatus_);
export const setExerciseMethods = secured(setExerciseMethods_);
export const scientificQaReport = secured(scientificQaReport_);
