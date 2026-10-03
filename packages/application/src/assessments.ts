import {
  assessmentStatusSchema,
  batterySchema,
  createAssessmentSchema,
  localReliabilitySchema,
  recordResultSchema,
  testSchema,
  updateTestSchema,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  aggregateAttempts,
  aggregationLabel,
  ageAt,
  asymmetryPercent,
  combineErrors,
  compareToReference,
  computeDerived,
  DERIVED_FORMULAS,
  diffFields,
  DomainError,
  hasActiveConsent,
  interpretChange,
  pickMeasurementError,
  proposeBattery,
  slugify,
  trend,
  type Aggregation,
  type BatteryTemplate,
  type BetterDirection,
  type ChangeInterpretation,
  type ConsentPurpose,
  type MeasurementError,
  type ReferenceComparison,
  type ReferenceRow,
  type ReliabilityRow,
  type Subject,
} from '@tp/domain';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const {
  assessmentTests,
  testReliabilityData,
  referenceValues,
  assessmentBatteries,
  batteryTests,
  assessments,
  assessmentResults,
  derivedMetrics,
  populations,
  evidenceSources,
  clients,
  clientGoals,
  clientTrainingProfiles,
  goals,
  sports,
  screeningResponses,
  consents,
} = schema;

const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));
const catalogWrite = (ctx: RequestContext) =>
  requirePermission(ctx, 'assessments:catalog', { organizationId: ctx.actor.organizationId });
const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const s = (v: number | null | undefined) => (v == null ? null : String(v));

function citation(src: { authors: string[] | null; year: number | null; title: string } | null) {
  if (!src) return 'Medición local del centro';
  const a = src.authors ?? [];
  const who = a.length === 0 ? '' : a.length > 2 ? `${a[0]} et al.` : a.join(' y ');
  return `${who} (${src.year ?? 's. f.'})`.trim();
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

async function listAssessmentTests_(
  ctx: RequestContext,
  query: { q?: string; category?: string } = {},
) {
  requirePermission(ctx, 'assessments:read');
  const conds = [visible(ctx, assessmentTests.organizationId)];
  if (query.q)
    conds.push(
      sql`lower(immutable_unaccent(${assessmentTests.name})) LIKE ${`%${query.q
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')}%`}`,
    );
  if (query.category) conds.push(eq(assessmentTests.category, query.category as 'strength'));
  const rows = await ctx.db
    .select({
      id: assessmentTests.id,
      slug: assessmentTests.slug,
      name: assessmentTests.name,
      category: assessmentTests.category,
      unit: assessmentTests.unit,
      betterDirection: assessmentTests.betterDirection,
      sided: assessmentTests.sided,
      isEstimate: assessmentTests.isEstimate,
      status: assessmentTests.status,
      organizationId: assessmentTests.organizationId,
      reliability: sql<number>`(SELECT count(*)::int FROM test_reliability_data r WHERE r.test_id = ${assessmentTests.id})`,
      references: sql<number>`(SELECT count(*)::int FROM reference_values r WHERE r.test_id = ${assessmentTests.id})`,
    })
    .from(assessmentTests)
    .where(and(...conds))
    .orderBy(asc(assessmentTests.category), asc(assessmentTests.name));
  return rows.map(({ organizationId, ...r }) => ({ ...r, isGlobal: organizationId === null }));
}
export type AssessmentTestSummary = Awaited<ReturnType<typeof listAssessmentTests_>>[number];

async function reliabilityRows(db: Executor, testIds: string[]) {
  if (!testIds.length) return [];
  return db
    .select({
      r: testReliabilityData,
      population: populations.name,
      populationSlug: populations.slug,
      popAgeMin: populations.ageMin,
      popAgeMax: populations.ageMax,
      popSport: populations.sportSlug,
      source: {
        id: evidenceSources.id,
        title: evidenceSources.title,
        authors: evidenceSources.authors,
        year: evidenceSources.year,
        doi: evidenceSources.doi,
        pmid: evidenceSources.pmid,
        verificationStatus: evidenceSources.verificationStatus,
      },
    })
    .from(testReliabilityData)
    .leftJoin(populations, eq(populations.id, testReliabilityData.populationId))
    .leftJoin(evidenceSources, eq(evidenceSources.id, testReliabilityData.sourceId))
    .where(inArray(testReliabilityData.testId, testIds));
}

async function referenceRows(db: Executor, testIds: string[]) {
  if (!testIds.length) return [];
  return db
    .select({
      v: referenceValues,
      population: populations.name,
      populationSlug: populations.slug,
      source: {
        id: evidenceSources.id,
        title: evidenceSources.title,
        authors: evidenceSources.authors,
        year: evidenceSources.year,
        doi: evidenceSources.doi,
        pmid: evidenceSources.pmid,
        verificationStatus: evidenceSources.verificationStatus,
      },
    })
    .from(referenceValues)
    .innerJoin(populations, eq(populations.id, referenceValues.populationId))
    .innerJoin(evidenceSources, eq(evidenceSources.id, referenceValues.sourceId))
    .where(inArray(referenceValues.testId, testIds));
}

async function getAssessmentTest_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'assessments:read');
  const [t] = await ctx.db
    .select()
    .from(assessmentTests)
    .where(and(eq(assessmentTests.id, id), visible(ctx, assessmentTests.organizationId)));
  if (!t) throw new DomainError('not_found', 'Test no encontrado.');
  const [rel, refs, srcs] = await Promise.all([
    reliabilityRows(ctx.db, [id]),
    referenceRows(ctx.db, [id]),
    t.sourceIds.length
      ? ctx.db
          .select({
            id: evidenceSources.id,
            title: evidenceSources.title,
            authors: evidenceSources.authors,
            year: evidenceSources.year,
            doi: evidenceSources.doi,
            pmid: evidenceSources.pmid,
            verificationStatus: evidenceSources.verificationStatus,
            verificationMethod: evidenceSources.verificationMethod,
          })
          .from(evidenceSources)
          .where(inArray(evidenceSources.id, t.sourceIds))
      : Promise.resolve([]),
  ]);
  return {
    ...t,
    isGlobal: t.organizationId === null,
    aggregationLabel: aggregationLabel(t.aggregation as Aggregation, t.aggregationN),
    reliability: rel.map(({ r, population, source }) => ({
      ...r,
      population,
      source: source?.id ? { ...source, label: citation(source) } : null,
    })),
    references: refs.map(({ v, population, source }) => ({
      ...v,
      population,
      source: { ...source, label: citation(source) },
    })),
    sources: srcs.map((x) => ({ ...x, label: citation(x) })),
    formulas: DERIVED_FORMULAS.filter((f) => f.inputs.includes(t.slug)).map((f) => ({
      id: f.id,
      name: f.name,
      definition: f.definition,
    })),
  };
}
export type AssessmentTestDetail = Awaited<ReturnType<typeof getAssessmentTest_>>;

async function createAssessmentTest_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(testSchema, input);
  catalogWrite(ctx);
  return ctx.db.transaction(async (tx) => {
    const base = slugify(d.name).replace(/-/g, '_');
    const taken = (
      await tx
        .select({ slug: assessmentTests.slug })
        .from(assessmentTests)
        .where(visible(ctx, assessmentTests.organizationId))
    ).map((r) => r.slug);
    let slug = base;
    for (let i = 2; taken.includes(slug); i++) slug = `${base}_${i}`;
    const [row] = await tx
      .insert(assessmentTests)
      .values({
        ...d,
        aggregationN: d.aggregationN ?? null,
        organizationId: ctx.actor.organizationId,
        slug,
        status: 'published',
        createdBy: ctx.actor.userId,
      })
      .returning({ id: assessmentTests.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'assessment_test',
      entityId: row!.id,
      changes: { name: d.name },
    });
    return { id: row!.id };
  });
}

async function updateAssessmentTest_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { expectedVersion, ...d } = parse(updateTestSchema, input);
  catalogWrite(ctx);
  const [t] = await ctx.db
    .select()
    .from(assessmentTests)
    .where(and(eq(assessmentTests.id, id), visible(ctx, assessmentTests.organizationId)));
  if (!t) throw new DomainError('not_found', 'Test no encontrado.');
  if (t.organizationId === null)
    throw new DomainError('forbidden', 'El catálogo global es de solo lectura.');
  if (t.version !== expectedVersion)
    throw new DomainError('conflict', 'El test ha cambiado. Recarga los datos.');
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v;
  // A protocol change creates a new protocol version: results keep the version they were taken with.
  const protocolChanged = 'protocol' in values && values.protocol !== t.protocol;
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(assessmentTests)
      .set({
        ...values,
        ...(protocolChanged ? { protocolVersion: String(Number(t.protocolVersion) + 1 || 2) } : {}),
        version: t.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(assessmentTests.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'assessment_test',
      entityId: id,
      changes: diffFields(
        t as unknown as Record<string, unknown>,
        { ...t, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

/** Records the centre's own test-retest reliability for a test (global or own). */
async function addLocalReliability_(
  ctx: RequestContext,
  testId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(localReliabilitySchema, input);
  catalogWrite(ctx);
  const [t] = await ctx.db
    .select({ id: assessmentTests.id, unit: assessmentTests.unit })
    .from(assessmentTests)
    .where(and(eq(assessmentTests.id, testId), visible(ctx, assessmentTests.organizationId)));
  if (!t) throw new DomainError('not_found', 'Test no encontrado.');
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(testReliabilityData)
      .values({
        organizationId: ctx.actor.organizationId,
        testId,
        isLocal: true,
        measurementMethod: d.measurementMethod ?? null,
        icc: s(d.icc),
        cvPercent: s(d.cvPercent),
        sem: s(d.sem),
        semUnit: d.semUnit ?? t.unit,
        mdc95: s(d.mdc95),
        swc: s(d.swc),
        notes: d.notes ?? null,
      })
      .returning({ id: testReliabilityData.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'test_reliability',
      entityId: row!.id,
      changes: { testId, sem: d.sem ?? null, cvPercent: d.cvPercent ?? null },
    });
    return { id: row!.id };
  });
}

async function deleteLocalReliability_(ctx: RequestContext, id: string): Promise<void> {
  catalogWrite(ctx);
  const [r] = await ctx.db.select().from(testReliabilityData).where(eq(testReliabilityData.id, id));
  if (!r || r.organizationId !== ctx.actor.organizationId)
    throw new DomainError('not_found', 'Dato de fiabilidad no encontrado.');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(testReliabilityData).where(eq(testReliabilityData.id, id));
    await writeAudit(tx, ctx, { action: 'delete', entityType: 'test_reliability', entityId: id });
  });
}

// ── Batteries ─────────────────────────────────────────────────────────────────

async function batteryTemplates(ctx: RequestContext): Promise<
  (BatteryTemplate & {
    id: string;
    isGlobal: boolean;
    description: string | null;
    testIds: Record<string, string>;
  })[]
> {
  const bats = await ctx.db
    .select()
    .from(assessmentBatteries)
    .where(visible(ctx, assessmentBatteries.organizationId))
    .orderBy(asc(assessmentBatteries.name));
  if (!bats.length) return [];
  const items = await ctx.db
    .select({
      batteryId: batteryTests.batteryId,
      testId: assessmentTests.id,
      slug: assessmentTests.slug,
      name: assessmentTests.name,
      isCore: batteryTests.isCore,
      position: batteryTests.position,
    })
    .from(batteryTests)
    .innerJoin(assessmentTests, eq(assessmentTests.id, batteryTests.testId))
    .where(
      inArray(
        batteryTests.batteryId,
        bats.map((b) => b.id),
      ),
    )
    .orderBy(asc(batteryTests.position));
  return bats.map((b) => {
    const mine = items.filter((i) => i.batteryId === b.id);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      goalFamily: b.goalFamily ?? '',
      description: b.description,
      isGlobal: b.organizationId === null,
      tests: mine.map((i) => ({ slug: i.slug, name: i.name, isCore: i.isCore })),
      testIds: Object.fromEntries(mine.map((i) => [i.slug, i.testId])),
    };
  });
}

async function listBatteries_(ctx: RequestContext) {
  requirePermission(ctx, 'assessments:read');
  return batteryTemplates(ctx);
}
export type BatteryView = Awaited<ReturnType<typeof listBatteries_>>[number];

async function createBattery_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const d = parse(batterySchema, input);
  catalogWrite(ctx);
  const ids = [...new Set(d.tests.map((t) => t.testId))];
  const ok = await ctx.db
    .select({ id: assessmentTests.id })
    .from(assessmentTests)
    .where(and(inArray(assessmentTests.id, ids), visible(ctx, assessmentTests.organizationId)));
  if (ok.length !== ids.length)
    throw new DomainError('validation', 'Test desconocido.', { tests: ['unknown'] });
  return ctx.db.transaction(async (tx) => {
    const base = slugify(d.name);
    const taken = (
      await tx
        .select({ slug: assessmentBatteries.slug })
        .from(assessmentBatteries)
        .where(eq(assessmentBatteries.organizationId, ctx.actor.organizationId))
    ).map((r) => r.slug);
    let slug = base;
    for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
    const [b] = await tx
      .insert(assessmentBatteries)
      .values({
        organizationId: ctx.actor.organizationId,
        slug,
        name: d.name,
        goalFamily: d.goalFamily ?? null,
        description: d.description ?? null,
        status: 'published',
        createdBy: ctx.actor.userId,
      })
      .returning({ id: assessmentBatteries.id });
    const seen = new Set<string>();
    const rows = d.tests.filter((t) => !seen.has(t.testId) && seen.add(t.testId));
    await tx.insert(batteryTests).values(
      rows.map((t, i) => ({
        batteryId: b!.id,
        testId: t.testId,
        position: i + 1,
        isCore: t.isCore,
        notes: t.notes ?? null,
      })),
    );
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'assessment_battery',
      entityId: b!.id,
      changes: { name: d.name, tests: rows.length },
    });
    return { id: b!.id };
  });
}

// ── Client context ────────────────────────────────────────────────────────────

interface ClientContext {
  subject: Subject;
  goals: string[];
  experience: 'none' | 'beginner' | 'intermediate' | 'advanced' | null;
  screening: 'clear' | 'refer' | 'unknown';
}

async function loadClientContext(
  ctx: RequestContext,
  clientId: string,
  canReadHealth: boolean,
): Promise<ClientContext> {
  const [c] = await ctx.db
    .select({ birthDate: clients.birthDate, sex: clients.sex })
    .from(clients)
    .where(eq(clients.id, clientId));
  const gs = await ctx.db
    .select({
      slug: goals.slug,
      sport: sports.slug,
      isPrimary: clientGoals.isPrimary,
      weight: clientGoals.priorityWeight,
    })
    .from(clientGoals)
    .innerJoin(goals, eq(goals.id, clientGoals.goalId))
    .leftJoin(sports, eq(sports.id, clientGoals.sportId))
    .where(and(eq(clientGoals.clientId, clientId), eq(clientGoals.status, 'active')))
    .orderBy(desc(clientGoals.isPrimary), desc(clientGoals.priorityWeight));
  const [p] = await ctx.db
    .select({ experience: clientTrainingProfiles.experienceLevel })
    .from(clientTrainingProfiles)
    .where(eq(clientTrainingProfiles.clientId, clientId));
  let screening: ClientContext['screening'] = 'unknown';
  // Screening is health data (art. 9): only used with the client's explicit consent.
  if (canReadHealth) {
    const cs = await ctx.db.select().from(consents).where(eq(consents.clientId, clientId));
    const consented = hasActiveConsent(
      cs.map((r) => ({
        purpose: r.purpose as ConsentPurpose,
        textVersion: r.textVersion,
        grantedAt: r.grantedAt,
        revokedAt: r.revokedAt,
      })),
      'health_data',
    );
    if (consented) {
      const [last] = await ctx.db
        .select({ result: screeningResponses.result })
        .from(screeningResponses)
        .where(eq(screeningResponses.clientId, clientId))
        .orderBy(desc(screeningResponses.completedOn), desc(screeningResponses.createdAt))
        .limit(1);
      if (last) screening = last.result;
    }
  }
  return {
    subject: {
      age: c?.birthDate ? ageAt(c.birthDate, ctx.now()) : null,
      sex: c?.sex ?? null,
      sportSlug: gs.find((g) => g.sport)?.sport ?? null,
    },
    goals: gs.map((g) => g.slug),
    experience: p?.experience ?? null,
    screening,
  };
}

async function canReadHealth(ctx: RequestContext, clientId: string): Promise<boolean> {
  try {
    await authorizeClient(ctx, 'health:read', clientId);
    return true;
  } catch {
    return false;
  }
}

async function proposeAssessmentBattery_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'assessments:write', clientId);
  const cc = await loadClientContext(ctx, clientId, await canReadHealth(ctx, clientId));
  const templates = await batteryTemplates(ctx);
  const p = proposeBattery(
    { goals: cc.goals, age: cc.subject.age, experience: cc.experience, screening: cc.screening },
    templates.filter((t) => t.isGlobal),
  );
  const t = p.battery ? templates.find((x) => x.slug === p.battery!.slug && x.isGlobal) : null;
  return {
    batteryId: t?.id ?? null,
    batteryName: p.battery?.name ?? null,
    screening: cc.screening,
    tests: p.tests.map((x) => ({ ...x, testId: t?.testIds[x.slug] ?? null })),
    explanation: p.explanation,
  };
}
export type BatteryProposalView = Awaited<ReturnType<typeof proposeAssessmentBattery_>>;

// ── Assessments ───────────────────────────────────────────────────────────────

async function loadAssessment(
  ctx: RequestContext,
  id: string,
  permission: 'assessments:read' | 'assessments:write',
) {
  const [a] = await ctx.db.select().from(assessments).where(eq(assessments.id, id));
  if (!a || a.organizationId !== ctx.actor.organizationId)
    throw new DomainError('not_found', 'Evaluación no encontrada.');
  try {
    await authorizeClient(ctx, permission, a.clientId);
  } catch (e) {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Evaluación no encontrada.');
    throw e;
  }
  return a;
}

async function listClientAssessments_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'assessments:read', clientId);
  const rows = await ctx.db
    .select({
      a: assessments,
      battery: assessmentBatteries.name,
      results: sql<number>`(SELECT count(*)::int FROM assessment_results r WHERE r.assessment_id = ${assessments.id})`,
    })
    .from(assessments)
    .leftJoin(assessmentBatteries, eq(assessmentBatteries.id, assessments.batteryId))
    .where(eq(assessments.clientId, clientId))
    .orderBy(desc(assessments.assessedOn), desc(assessments.createdAt));
  return rows.map(({ a, battery, results }) => ({
    id: a.id,
    assessedOn: a.assessedOn,
    status: a.status,
    battery,
    context: a.context,
    planned: a.plannedTestIds.length,
    results,
  }));
}

async function createAssessment_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(createAssessmentSchema, input);
  await authorizeClient(ctx, 'assessments:write', clientId);
  let testIds = [...new Set(d.testIds)];
  if (d.batteryId) {
    const [b] = await ctx.db
      .select({ id: assessmentBatteries.id })
      .from(assessmentBatteries)
      .where(
        and(
          eq(assessmentBatteries.id, d.batteryId),
          visible(ctx, assessmentBatteries.organizationId),
        ),
      );
    if (!b) throw new DomainError('validation', 'Batería desconocida.', { batteryId: ['unknown'] });
    if (!testIds.length)
      testIds = (
        await ctx.db
          .select({ id: batteryTests.testId })
          .from(batteryTests)
          .where(eq(batteryTests.batteryId, d.batteryId))
          .orderBy(asc(batteryTests.position))
      ).map((r) => r.id);
  }
  if (testIds.length) {
    const ok = await ctx.db
      .select({ id: assessmentTests.id })
      .from(assessmentTests)
      .where(
        and(inArray(assessmentTests.id, testIds), visible(ctx, assessmentTests.organizationId)),
      );
    if (ok.length !== testIds.length)
      throw new DomainError('validation', 'Test desconocido.', { testIds: ['unknown'] });
  }
  return ctx.db.transaction(async (tx) => {
    const [a] = await tx
      .insert(assessments)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        batteryId: d.batteryId ?? null,
        assessedOn: d.assessedOn,
        assessorUserId: ctx.actor.userId,
        status: 'planned',
        context: d.context ?? null,
        conditions: d.conditions ?? null,
        plannedTestIds: testIds,
        notes: d.notes ?? null,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: assessments.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'assessment',
      entityId: a!.id,
      clientId,
      changes: { assessedOn: d.assessedOn, tests: testIds.length },
    });
    return { id: a!.id };
  });
}

/** Recomputes derived metrics (BMI, COD deficit, asymmetries…) for one assessment. */
async function recomputeDerived(
  ctx: RequestContext,
  tx: Executor,
  assessmentId: string,
  clientId: string,
) {
  const rows = await tx
    .select({
      slug: assessmentTests.slug,
      name: assessmentTests.name,
      side: assessmentResults.side,
      value: assessmentResults.value,
      valid: assessmentResults.valid,
      better: assessmentTests.betterDirection,
      resultId: assessmentResults.id,
    })
    .from(assessmentResults)
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(eq(assessmentResults.assessmentId, assessmentId));
  const both: Record<string, number> = {};
  for (const r of rows)
    if (r.valid && r.side === 'both' && r.value != null) both[r.slug] = Number(r.value);
  const metrics: {
    metric: string;
    formula: string;
    value: number;
    unit: string;
    isEstimate: boolean;
    inputs: unknown;
    resultId: string | null;
  }[] = computeDerived(both).map((x) => ({
    metric: x.formula.id,
    formula: x.formula.definition,
    value: x.value,
    unit: x.formula.unit,
    isEstimate: x.formula.isEstimate,
    inputs: x.inputs,
    resultId: null,
  }));
  const sided = new Map<
    string,
    { left?: number; right?: number; better: BetterDirection; name: string }
  >();
  for (const r of rows) {
    if (!r.valid || r.value == null || r.side === 'both') continue;
    const e = sided.get(r.slug) ?? { better: r.better, name: r.name };
    e[r.side] = Number(r.value);
    sided.set(r.slug, e);
  }
  for (const [slug, e] of sided) {
    if (e.left == null || e.right == null || e.better === 'target_range') continue;
    const a = asymmetryPercent(e.left, e.right, e.better);
    if (a)
      metrics.push({
        metric: `asymmetry:${slug}`,
        formula: `Asimetría de «${e.name}»: (lado mejor − lado peor) / lado mejor × 100. Descriptiva: no predice lesiones.`,
        value: a.value,
        unit: '%',
        isEstimate: false,
        inputs: { left: e.left, right: e.right, weaker: a.weaker },
        resultId: null,
      });
  }
  await tx.delete(derivedMetrics).where(eq(derivedMetrics.assessmentId, assessmentId));
  if (metrics.length) {
    await tx.insert(derivedMetrics).values(
      metrics.map((m) => ({
        organizationId: ctx.actor.organizationId,
        clientId,
        assessmentId,
        resultId: m.resultId,
        metric: m.metric,
        formula: m.formula,
        value: String(m.value),
        unit: m.unit,
        isEstimate: m.isEstimate,
        inputs: m.inputs,
      })),
    );
  }
}

async function recordAssessmentResult_(
  ctx: RequestContext,
  assessmentId: string,
  input: unknown,
): Promise<{ id: string; value: number }> {
  const d = parse(recordResultSchema, input);
  const a = await loadAssessment(ctx, assessmentId, 'assessments:write');
  if (a.status === 'cancelled') throw new DomainError('conflict', 'La evaluación está cancelada.');
  const [t] = await ctx.db
    .select()
    .from(assessmentTests)
    .where(and(eq(assessmentTests.id, d.testId), visible(ctx, assessmentTests.organizationId)));
  if (!t) throw new DomainError('validation', 'Test desconocido.', { testId: ['unknown'] });
  if (d.side !== 'both' && !t.sided)
    throw new DomainError('validation', 'Este test no se registra por lados.', {
      side: ['not_sided'],
    });
  if (d.side === 'both' && t.sided)
    throw new DomainError('validation', 'Indica el lado (izquierdo o derecho).', {
      side: ['required'],
    });
  const agg = aggregateAttempts(d.attempts, {
    aggregation: t.aggregation as Aggregation,
    n: t.aggregationN,
    betterDirection: t.betterDirection,
  });
  return ctx.db.transaction(async (tx) => {
    const values = {
      organizationId: ctx.actor.organizationId,
      clientId: a.clientId,
      assessmentId,
      testId: t.id,
      protocolVersion: t.protocolVersion,
      side: d.side,
      attempts: d.attempts,
      valueBest: String(agg.best),
      valueMean: String(agg.mean),
      value: String(agg.value),
      cvIntraPercent: s(agg.cvIntraPercent),
      unit: t.unit,
      measurementMethod: d.measurementMethod ?? null,
      device: d.device ?? null,
      valid: d.valid,
      notes: d.notes ?? null,
      createdBy: ctx.actor.userId,
    };
    const [row] = await tx
      .insert(assessmentResults)
      .values(values)
      .onConflictDoUpdate({
        target: [assessmentResults.assessmentId, assessmentResults.testId, assessmentResults.side],
        set: { ...values, updatedBy: ctx.actor.userId, updatedAt: ctx.now() },
      })
      .returning({ id: assessmentResults.id });
    await recomputeDerived(ctx, tx, assessmentId, a.clientId);
    if (a.status === 'planned')
      await tx
        .update(assessments)
        .set({ status: 'in_progress', version: a.version + 1 })
        .where(eq(assessments.id, assessmentId));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'assessment_result',
      entityId: row!.id,
      clientId: a.clientId,
      changes: {
        test: t.slug,
        side: d.side,
        attempts: d.attempts,
        value: agg.value,
        valid: d.valid,
      },
    });
    return { id: row!.id, value: agg.value };
  });
}

async function deleteAssessmentResult_(ctx: RequestContext, resultId: string): Promise<void> {
  const [r] = await ctx.db
    .select()
    .from(assessmentResults)
    .where(eq(assessmentResults.id, resultId));
  if (!r) throw new DomainError('not_found', 'Resultado no encontrado.');
  await loadAssessment(ctx, r.assessmentId, 'assessments:write');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(assessmentResults).where(eq(assessmentResults.id, resultId));
    await recomputeDerived(ctx, tx, r.assessmentId, r.clientId);
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'assessment_result',
      entityId: resultId,
      clientId: r.clientId,
    });
  });
}

async function setAssessmentStatus_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { status } = parse(assessmentStatusSchema, input);
  const a = await loadAssessment(ctx, id, 'assessments:write');
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(assessments)
      .set({ status, version: a.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(assessments.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'assessment',
      entityId: id,
      clientId: a.clientId,
      changes: [{ field: 'status', before: a.status, after: status }],
    });
  });
}

// ── Interpretation helpers ────────────────────────────────────────────────────

type RelRow = Awaited<ReturnType<typeof reliabilityRows>>[number];
type RefRow = Awaited<ReturnType<typeof referenceRows>>[number];

/** Published reliability is used only in a population similar to the client (§11.5). */
function similarPopulation(r: RelRow, who: Subject): boolean {
  if (r.r.isLocal) return true;
  if (r.popAgeMin != null && (who.age == null || who.age < r.popAgeMin)) return false;
  if (r.popAgeMax != null && (who.age == null || who.age > r.popAgeMax)) return false;
  if (r.popSport && who.sportSlug && r.popSport !== who.sportSlug) return false;
  return true;
}

function toReliability(rows: RelRow[], who: Subject): ReliabilityRow[] {
  return rows
    .filter((r) => similarPopulation(r, who))
    .map((r) => ({
      isLocal: r.r.isLocal,
      icc: n(r.r.icc),
      cvPercent: n(r.r.cvPercent),
      sem: n(r.r.sem),
      semUnit: r.r.semUnit,
      mdc95: n(r.r.mdc95),
      swc: n(r.r.swc),
      measurementMethod: r.r.measurementMethod,
      label: r.r.isLocal
        ? 'Test-retest del centro'
        : `${citation(r.source?.id ? r.source : null)}${r.population ? `, ${r.population}` : ''}`,
    }));
}

function toReference(r: RefRow): ReferenceRow {
  return {
    id: r.v.id,
    populationName: r.population,
    populationSlug: r.populationSlug,
    ageMin: r.v.ageMin,
    ageMax: r.v.ageMax,
    sex: r.v.sex,
    level: r.v.level,
    sport: r.v.sport,
    statisticType: r.v.statisticType,
    values: r.v.values as Record<string, unknown>,
    measurementMethod: r.v.measurementMethod,
    unit: r.v.unit,
    sourceLabel: `${citation(r.source)}${r.source.doi ? `, doi:${r.source.doi}` : ''}`,
  };
}

function compareRefs(
  value: number,
  refs: RefRow[],
  who: Subject,
  method: string | null,
): (ReferenceComparison & {
  population: string;
  source: string;
  doi: string | null;
  pmid: string | null;
})[] {
  return refs.map((r) => ({
    ...compareToReference(value, toReference(r), who, method),
    population: r.population,
    source: citation(r.source),
    doi: r.source.doi,
    pmid: r.source.pmid,
  }));
}

// ── Assessment detail ─────────────────────────────────────────────────────────

async function getAssessment_(ctx: RequestContext, id: string) {
  const a = await loadAssessment(ctx, id, 'assessments:read');
  const results = await ctx.db
    .select({ r: assessmentResults, t: assessmentTests })
    .from(assessmentResults)
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(eq(assessmentResults.assessmentId, id))
    .orderBy(asc(assessmentTests.category), asc(assessmentTests.name), asc(assessmentResults.side));
  const testIds = [...new Set([...a.plannedTestIds, ...results.map((x) => x.t.id)])];
  const tests = testIds.length
    ? await ctx.db.select().from(assessmentTests).where(inArray(assessmentTests.id, testIds))
    : [];
  const ordered = [...a.plannedTestIds, ...testIds.filter((x) => !a.plannedTestIds.includes(x))]
    .map((tid) => tests.find((t) => t.id === tid)!)
    .filter(Boolean);
  const [rels, refs, derived, [battery], cc] = await Promise.all([
    reliabilityRows(ctx.db, testIds),
    referenceRows(ctx.db, testIds),
    ctx.db
      .select()
      .from(derivedMetrics)
      .where(eq(derivedMetrics.assessmentId, id))
      .orderBy(asc(derivedMetrics.metric)),
    a.batteryId
      ? ctx.db
          .select({ name: assessmentBatteries.name })
          .from(assessmentBatteries)
          .where(eq(assessmentBatteries.id, a.batteryId))
      : Promise.resolve([] as { name: string }[]),
    loadClientContext(ctx, a.clientId, false),
  ]);
  // Previous valid result of each test/side for the change column.
  const prev = await ctx.db
    .select({
      testId: assessmentResults.testId,
      side: assessmentResults.side,
      value: assessmentResults.value,
      method: assessmentResults.measurementMethod,
      protocolVersion: assessmentResults.protocolVersion,
      assessedOn: assessments.assessedOn,
    })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .where(
      and(
        eq(assessmentResults.clientId, a.clientId),
        eq(assessmentResults.valid, true),
        sql`${assessments.assessedOn} < ${a.assessedOn}`,
        sql`${assessments.status} <> 'cancelled'`,
      ),
    )
    .orderBy(desc(assessments.assessedOn));
  const flags: { test: string; message: string; criterion: string }[] = [];
  const rows = results.map(({ r, t }) => {
    const value = n(r.value);
    const p = prev.find((x) => x.testId === t.id && x.side === r.side);
    let change:
      | (ChangeInterpretation & { previousOn: string; comparable: boolean; note: string | null })
      | null = null;
    if (value != null && r.valid && p?.value != null) {
      const pre = Number(p.value);
      const sameMethod = (p.method ?? '') === (r.measurementMethod ?? '');
      const sameProtocol = p.protocolVersion === r.protocolVersion;
      const err =
        sameMethod && sameProtocol
          ? pickMeasurementError(
              toReliability(
                rels.filter((x) => x.r.testId === t.id),
                cc.subject,
              ),
              t.unit,
              pre,
              r.measurementMethod,
            )
          : null;
      change = {
        ...interpretChange(pre, value, t.betterDirection, err),
        previousOn: p.assessedOn,
        comparable: sameMethod && sameProtocol,
        note: !sameMethod
          ? 'Método de medida distinto al de la evaluación anterior: no comparable.'
          : !sameProtocol
            ? 'Versión de protocolo distinta: no comparable.'
            : null,
      };
    }
    const references =
      value != null && r.valid
        ? compareRefs(
            value,
            refs.filter((x) => x.v.testId === t.id),
            cc.subject,
            r.measurementMethod,
          )
        : [];
    for (const c of references) if (c.flag) flags.push({ test: t.name, ...c.flag });
    return {
      ...r,
      value,
      valueBest: n(r.valueBest),
      valueMean: n(r.valueMean),
      cvIntraPercent: n(r.cvIntraPercent),
      test: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        unit: t.unit,
        isEstimate: t.isEstimate,
        betterDirection: t.betterDirection,
        aggregation: aggregationLabel(t.aggregation as Aggregation, t.aggregationN),
      },
      change,
      references,
    };
  });
  return {
    ...a,
    battery: battery?.name ?? null,
    tests: ordered.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      unit: t.unit,
      sided: t.sided,
      defaultAttempts: t.defaultAttempts,
      isEstimate: t.isEstimate,
      category: t.category,
      aggregation: aggregationLabel(t.aggregation as Aggregation, t.aggregationN),
      protocol: t.protocol,
      recorded: results.some((x) => x.t.id === t.id),
    })),
    results: rows,
    derived: derived.map((m) => ({
      ...m,
      value: Number(m.value),
      name:
        DERIVED_FORMULAS.find((f) => f.id === m.metric)?.name ??
        (m.metric.startsWith('asymmetry:')
          ? `Asimetría · ${tests.find((t) => t.slug === m.metric.slice(10))?.name ?? m.metric.slice(10)}`
          : m.metric),
    })),
    flags,
  };
}
export type AssessmentDetail = Awaited<ReturnType<typeof getAssessment_>>;

// ── Progress (series and before/after) ────────────────────────────────────────

async function clientAssessmentProgress_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'assessments:read', clientId);
  const cc = await loadClientContext(ctx, clientId, false);
  const rows = await ctx.db
    .select({ r: assessmentResults, t: assessmentTests, on: assessments.assessedOn })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.valid, true),
        sql`${assessments.status} <> 'cancelled'`,
      ),
    )
    .orderBy(asc(assessments.assessedOn));
  const testIds = [...new Set(rows.map((x) => x.t.id))];
  const [rels, refs] = await Promise.all([
    reliabilityRows(ctx.db, testIds),
    referenceRows(ctx.db, testIds),
  ]);
  const groups = new Map<string, typeof rows>();
  for (const x of rows) {
    const k = `${x.t.id}:${x.r.side}`;
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const errorCache = new Map<string, MeasurementError | null>();
  const series = [...groups.values()].map((g) => {
    const t = g[0]!.t;
    const side = g[0]!.r.side;
    const points = g.map((x) => ({
      assessmentId: x.r.assessmentId,
      on: x.on,
      value: Number(x.r.value),
      method: x.r.measurementMethod,
      protocolVersion: x.r.protocolVersion,
    }));
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const methods = new Set(points.map((p) => `${p.method ?? ''}|${p.protocolVersion ?? ''}`));
    const comparable = methods.size === 1;
    const err = comparable
      ? pickMeasurementError(
          toReliability(
            rels.filter((x) => x.r.testId === t.id),
            cc.subject,
          ),
          t.unit,
          first.value,
          first.method,
        )
      : null;
    errorCache.set(t.slug, err);
    const overall =
      points.length >= 2 ? interpretChange(first.value, last.value, t.betterDirection, err) : null;
    const lastStep =
      points.length >= 3
        ? interpretChange(points[points.length - 2]!.value, last.value, t.betterDirection, err)
        : null;
    const t0 = new Date(first.on).getTime();
    return {
      test: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        unit: t.unit,
        category: t.category,
        betterDirection: t.betterDirection,
        isEstimate: t.isEstimate,
      },
      side,
      points,
      comparable,
      note: comparable
        ? null
        : 'La serie mezcla métodos de medida o versiones de protocolo: no se emite veredicto.',
      overall,
      lastStep,
      trend: trend(
        points.map((p) => ({ t: (new Date(p.on).getTime() - t0) / 86_400_000, value: p.value })),
        err?.te ?? 0,
      ),
      references: compareRefs(
        last.value,
        refs.filter((x) => x.v.testId === t.id),
        cc.subject,
        last.method,
      ),
    };
  });
  // Derived metric series (e.g. COD deficit), with combined error when the formula allows it.
  const dm = await ctx.db
    .select({ m: derivedMetrics, on: assessments.assessedOn })
    .from(derivedMetrics)
    .innerJoin(assessments, eq(assessments.id, derivedMetrics.assessmentId))
    .where(and(eq(derivedMetrics.clientId, clientId), sql`${assessments.status} <> 'cancelled'`))
    .orderBy(asc(assessments.assessedOn));
  const byMetric = new Map<string, typeof dm>();
  for (const x of dm) byMetric.set(x.m.metric, [...(byMetric.get(x.m.metric) ?? []), x]);
  const derived = [...byMetric.entries()].map(([metric, g]) => {
    const f = DERIVED_FORMULAS.find((x) => x.id === metric);
    const points = g.map((x) => ({ on: x.on, value: Number(x.m.value) }));
    const err =
      f?.errorModel === 'difference'
        ? combineErrors(
            errorCache.get(f.inputs[0]!) ?? null,
            errorCache.get(f.inputs[1]!) ?? null,
            f.name,
          )
        : null;
    const overall =
      points.length >= 2 && f
        ? interpretChange(points[0]!.value, points[points.length - 1]!.value, f.better, err)
        : null;
    return {
      metric,
      name: f?.name ?? metric,
      unit: g[0]!.m.unit,
      definition: g[0]!.m.formula,
      points,
      overall,
    };
  });
  return { subject: { age: cc.subject.age, sex: cc.subject.sex }, series, derived };
}
export type AssessmentProgress = Awaited<ReturnType<typeof clientAssessmentProgress_>>;

// Use cases run under Row Level Security (see rls.ts).
export const listAssessmentTests = secured(listAssessmentTests_);
export const getAssessmentTest = secured(getAssessmentTest_);
export const createAssessmentTest = secured(createAssessmentTest_);
export const updateAssessmentTest = secured(updateAssessmentTest_);
export const addLocalReliability = secured(addLocalReliability_);
export const deleteLocalReliability = secured(deleteLocalReliability_);
export const listBatteries = secured(listBatteries_);
export const createBattery = secured(createBattery_);
export const proposeAssessmentBattery = secured(proposeAssessmentBattery_);
export const listClientAssessments = secured(listClientAssessments_);
export const createAssessment = secured(createAssessment_);
export const getAssessment = secured(getAssessment_);
export const recordAssessmentResult = secured(recordAssessmentResult_);
export const deleteAssessmentResult = secured(deleteAssessmentResult_);
export const setAssessmentStatus = secured(setAssessmentStatus_);
export const clientAssessmentProgress = secured(clientAssessmentProgress_);
