/**
 * Decision engine use cases (Fase 10, MASTER_SPECIFICATION §13). The engine itself is pure
 * (`@tp/domain` decision); this module builds the ClientContext and the KnowledgeSnapshot from
 * the database, stores each run and its recommendations, and records the trainer's decisions
 * (accept · accept with changes · reject · postpone) with manual overrides per field.
 * Nothing here modifies a plan.
 */
import { decideRecommendationSchema, decisionRulesSchema, traitFlagSchema } from '@tp/contracts';
import { schema, type Database } from '@tp/db';
import {
  addDays,
  DEFAULT_DECISION_RULES,
  DomainError,
  hasActiveConsent,
  localDate,
  populationLabel,
  runDecisionEngine,
  samePopulation,
  stableHash,
  type ClaimFact,
  type ClientContext,
  type ConsentPurpose,
  type DecisionResult,
  type DecisionRule,
  type Explanation,
  type KnowledgeSnapshot,
  type MetricFact,
  type ParamVariant,
  EVIDENCE_KINDS,
} from '@tp/domain';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { clientAssessmentProgress } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { clientMonitoring } from './monitoring';
import { secured } from './rls';
import { parse } from './validation';

const {
  alerts,
  claimEvidence,
  clientAvailability,
  clientEquipment,
  clientGoals,
  clientRuleOverrides,
  clientTraitFlags,
  clientTrainingProfiles,
  clients,
  consents,
  decisionRuns,
  equipment,
  evidenceFindings,
  evidenceSources,
  exerciseEquipment,
  exerciseMethodLinks,
  exerciseTolerances,
  exercises,
  goals,
  knowledgeClaims,
  manualOverrides,
  methodNotes,
  methodVariables,
  methods,
  movementPatterns,
  planTemplates,
  populations,
  recommendationEvidence,
  recommendations,
  ruleSets,
  rules,
  screeningResponses,
  sports,
} = schema;

const DECISION_DOMAINS = [
  'screening',
  'needs',
  'prioritization',
  'method_selection',
  'exercise_selection',
  'dosing',
  'progression',
] as const;
const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));

// ── Rules (organization configuration over the defaults) ──────────────────────

async function organizationDecisionRules(db: Database, organizationId: string) {
  const [rs] = await db
    .select()
    .from(ruleSets)
    .where(and(eq(ruleSets.organizationId, organizationId), eq(ruleSets.status, 'published')))
    .orderBy(desc(ruleSets.version))
    .limit(1);
  const rows = rs
    ? await db
        .select()
        .from(rules)
        .where(and(eq(rules.ruleSetId, rs.id), inArray(rules.domain, [...DECISION_DOMAINS])))
    : [];
  const merged: DecisionRule[] = DEFAULT_DECISION_RULES.map((d) => {
    const row = rows.find((r) => r.key === d.key);
    if (!row) return d;
    const stored = row.parameters as Record<string, number | null>;
    // Population values (restructure phase 17), only for parameters the rule still has.
    const variants = ((row.parameterVariants ?? []) as ParamVariant[])
      .map((v) => ({
        ...v,
        values: Object.fromEntries(
          Object.entries(v.values).filter(([k, x]) => k in d.parameters && typeof x === 'number'),
        ),
      }))
      .filter((v) => Object.keys(v.values).length);
    return {
      ...d,
      version: rs!.version,
      enabled: row.enabled,
      parameters: Object.fromEntries(
        Object.entries(d.parameters).map(([k, p]) => [
          k,
          { ...p, value: k in stored ? stored[k]! : p.value },
        ]),
      ),
      ...(variants.length ? { variants } : {}),
    };
  });
  return { version: rs?.version ?? 0, publishedAt: rs?.publishedAt ?? null, rules: merged };
}

// ── Knowledge snapshot ────────────────────────────────────────────────────────

async function knowledgeSnapshot(
  ctx: RequestContext,
  clientId: string,
  version: number,
  ruleList: DecisionRule[],
): Promise<KnowledgeSnapshot> {
  const db = ctx.db as Database;
  const [
    claimRows,
    sourceRows,
    pops,
    methodRows,
    varRows,
    noteRows,
    exRows,
    eqRows,
    linkRows,
    tplRows,
    off,
    sportRows,
  ] = await Promise.all([
    db
      .select()
      .from(knowledgeClaims)
      .where(
        and(visible(ctx, knowledgeClaims.organizationId), eq(knowledgeClaims.status, 'published')),
      ),
    db
      .select({
        claimId: claimEvidence.claimId,
        authors: evidenceSources.authors,
        year: evidenceSources.year,
        journal: evidenceSources.journal,
        doi: evidenceSources.doi,
        pmid: evidenceSources.pmid,
        population: evidenceSources.populationSummary,
      })
      .from(claimEvidence)
      .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
      .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
      // Phase 9: only verified sources that support the claim are shown as its backing.
      .where(
        and(
          eq(claimEvidence.role, 'supports'),
          inArray(evidenceSources.verificationStatus, ['verified', 'verified_with_corrections']),
        ),
      ),
    db.select({ id: populations.id, slug: populations.slug }).from(populations),
    db.select().from(methods).where(visible(ctx, methods.organizationId)),
    db.select().from(methodVariables),
    db.select({ methodId: methodNotes.methodId, claimId: methodNotes.claimId }).from(methodNotes),
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        pattern: movementPatterns.slug,
        level: exercises.level,
        complexity: exercises.technicalComplexity,
        impact: exercises.impactLevel,
      })
      .from(exercises)
      .innerJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
      .where(and(visible(ctx, exercises.organizationId), eq(exercises.status, 'published'))),
    db
      .select({
        exerciseId: exerciseEquipment.exerciseId,
        slug: equipment.slug,
        optional: exerciseEquipment.optional,
      })
      .from(exerciseEquipment)
      .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId)),
    db
      .select({ exerciseId: exerciseMethodLinks.exerciseId, slug: methods.slug })
      .from(exerciseMethodLinks)
      .innerJoin(methods, eq(methods.id, exerciseMethodLinks.methodId)),
    db.select().from(planTemplates).where(visible(ctx, planTemplates.organizationId)),
    db
      .select({ key: clientRuleOverrides.ruleKey })
      .from(clientRuleOverrides)
      .where(
        and(eq(clientRuleOverrides.clientId, clientId), eq(clientRuleOverrides.enabled, false)),
      ),
    db.select({ slug: sports.slug, name: sports.name }).from(sports),
  ]);
  const popSlug = new Map(pops.map((p) => [p.id, p.slug]));
  const claimKey = new Map(claimRows.map((c) => [c.id, c.key]));
  const claims: Record<string, ClaimFact> = {};
  for (const c of claimRows) {
    const app = (c.applicability ?? {}) as { appliesTo?: string[]; notFor?: string[] };
    const srcs = sourceRows
      .filter((s) => s.claimId === c.id)
      .map((s) => {
        const authors = (s.authors as string[] | null) ?? [];
        return {
          citation:
            `${authors[0] ?? 'Anónimo'}${authors.length > 1 ? ' et al.' : ''} ${s.year ?? ''} · ${s.journal ?? ''}`.trim(),
          doi: s.doi,
          pmid: s.pmid,
          population: s.population,
        };
      });
    claims[c.key] = {
      key: c.key,
      statement: c.statement,
      confidence: c.confidence,
      appliesTo: (app.appliesTo ?? []).map((x) => popSlug.get(x) ?? x),
      notFor: (app.notFor ?? []).map((x) => popSlug.get(x) ?? x),
      sources: [...new Map(srcs.map((x) => [x.doi ?? x.pmid ?? x.citation, x])).values()],
      evidenceKind: c.evidenceKind ? EVIDENCE_KINDS[c.evidenceKind] : null,
      limitations: c.limitations,
    };
  }
  const methodFacts = methodRows.map((m) => {
    const vars = varRows.filter((v) => v.methodId === m.id);
    const keys = [
      ...vars.map((v) => (v.claimId ? claimKey.get(v.claimId) : undefined)),
      ...noteRows
        .filter((n) => n.methodId === m.id)
        .map((n) => (n.claimId ? claimKey.get(n.claimId) : undefined)),
    ].filter((x): x is string => !!x);
    return {
      slug: m.slug,
      name: m.name,
      kind: m.kind,
      claimKeys: [...new Set(keys)],
      variables: vars.map((v) => ({
        key: v.variableKey,
        min: v.minValue == null ? null : Number(v.minValue),
        max: v.maxValue == null ? null : Number(v.maxValue),
        typical: v.typicalValue == null ? null : Number(v.typicalValue),
        unit: v.unit,
        population: v.populationId ? (popSlug.get(v.populationId) ?? null) : null,
        claimKey: v.claimId ? (claimKey.get(v.claimId) ?? null) : null,
      })),
    };
  });
  return {
    ruleSetVersion: version,
    rules: ruleList,
    claims,
    methods: methodFacts,
    exercises: exRows.map((e) => ({
      ...e,
      requiredEquipment: eqRows
        .filter((q) => q.exerciseId === e.id && !q.optional)
        .map((q) => q.slug),
      methodSlugs: linkRows.filter((l) => l.exerciseId === e.id).map((l) => l.slug),
    })),
    templates: tplRows
      .filter((t) => t.status === 'published')
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        goal: t.goalSlug ?? '',
        sessionsPerWeek: t.sessionsPerWeek,
        weeks: ((t.definition as { totalWeeks?: number } | null)?.totalWeeks ?? 12) as number,
      })),
    disabledRules: off.map((o) => o.key),
    sportNames: Object.fromEntries(sportRows.map((x) => [x.slug, x.name])),
  };
}

// ── Context builder (stage 1) ─────────────────────────────────────────────────

const ageOn = (birth: string, today: string) => {
  const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
};

export async function buildDecisionContext(
  ctx: RequestContext,
  clientId: string,
): Promise<ClientContext> {
  const db = ctx.db as Database;
  const today = localDate(ctx.now());
  const [c] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  const [[profile], goalRows, avail, eqRows, consentRows, flagRows] = await Promise.all([
    db.select().from(clientTrainingProfiles).where(eq(clientTrainingProfiles.clientId, clientId)),
    db
      .select({
        slug: goals.slug,
        family: goals.family,
        isPrimary: clientGoals.isPrimary,
        weight: clientGoals.priorityWeight,
        sport: sports.slug,
        sportFamily: sports.family,
      })
      .from(clientGoals)
      .innerJoin(goals, eq(goals.id, clientGoals.goalId))
      .leftJoin(sports, eq(sports.id, clientGoals.sportId))
      .where(and(eq(clientGoals.clientId, clientId), eq(clientGoals.status, 'active'))),
    db.select().from(clientAvailability).where(eq(clientAvailability.clientId, clientId)),
    db
      .select({ slug: equipment.slug })
      .from(clientEquipment)
      .innerJoin(equipment, eq(equipment.id, clientEquipment.equipmentId))
      .where(eq(clientEquipment.clientId, clientId)),
    db.select().from(consents).where(eq(consents.clientId, clientId)),
    db.select().from(clientTraitFlags).where(eq(clientTraitFlags.clientId, clientId)),
  ]);
  const [ownSport] = c.sportId
    ? await db.select({ slug: sports.slug }).from(sports).where(eq(sports.id, c.sportId))
    : [];
  const missing: string[] = [];
  const age = c.birthDate ? ageOn(c.birthDate, today) : null;
  const primaryRow = goalRows.find((g) => g.isPrimary) ?? null;
  if (!primaryRow) missing.push('Sin objetivo principal.');
  if (!profile?.experienceLevel) missing.push('Sin nivel de experiencia en el perfil.');

  // Health data only with the client's explicit consent (art. 9 RGPD).
  const consented = hasActiveConsent(
    consentRows.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
  let screening: ClientContext['screening'] = 'unknown';
  let notTolerated: string[] = [];
  let restricted: string[] = [];
  if (consented) {
    const [scr] = await db
      .select({ result: screeningResponses.result })
      .from(screeningResponses)
      .where(eq(screeningResponses.clientId, clientId))
      .orderBy(desc(screeningResponses.completedOn))
      .limit(1);
    screening = scr ? scr.result : 'unknown';
    const tol = await db
      .select({
        exerciseId: exerciseTolerances.exerciseId,
        pattern: movementPatterns.slug,
        kind: exerciseTolerances.kind,
      })
      .from(exerciseTolerances)
      .leftJoin(movementPatterns, eq(movementPatterns.id, exerciseTolerances.movementPatternId))
      .where(eq(exerciseTolerances.clientId, clientId));
    notTolerated = tol
      .filter((t) => t.kind === 'not_tolerated' && t.exerciseId)
      .map((t) => t.exerciseId!);
    restricted = tol.filter((t) => t.kind !== 'tolerated' && t.pattern).map((t) => t.pattern!);
  } else
    missing.push('Sin consentimiento de datos de salud: cribado y tolerancias no disponibles.');

  // Latest valid results, change verdicts and applicable references (assessment engine).
  const metrics: Record<string, MetricFact> = {};
  const progress = await clientAssessmentProgress(ctx, clientId);
  for (const s of progress.series.filter((x) => x.side === 'both')) {
    const last = s.points.at(-1)!;
    const ref = s.references.find((r) => r.applicable && r.zScore != null);
    const z =
      ref?.zScore == null ? null : s.test.betterDirection === 'lower' ? -ref.zScore : ref.zScore;
    metrics[s.test.slug] = {
      testSlug: s.test.slug,
      name: s.test.name,
      value: last.value,
      unit: s.test.unit,
      date: last.on,
      change: (s.lastStep ?? s.overall)?.verdict ?? null,
      reference: z == null ? null : z < -1 ? 'low' : z > 1 ? 'high' : 'average',
    };
  }
  const strength = Object.values(metrics).filter((m) => m.testSlug.startsWith('one_rm_'));
  if (!strength.some((m) => m.date >= addDays(today, -90)))
    missing.push('Sin evaluación de fuerza en 90 días.');
  const derived: ClientContext['derived'] = {};
  const sq = metrics.one_rm_back_squat;
  const bm = metrics.body_mass;
  if (sq && bm && bm.value > 0)
    derived.relative_strength_back_squat = {
      value: Math.round((sq.value / bm.value) * 100) / 100,
      unit: '×PC',
      date: sq.date,
      from: `1RM ${sq.value} kg / ${bm.value} kg`,
    };
  else if (sq) missing.push('Sin masa corporal reciente: no se calcula la fuerza relativa.');

  const mon = await clientMonitoring(ctx, clientId);
  const liveAlerts = await db
    .select({ type: alerts.type, severity: alerts.severity })
    .from(alerts)
    .where(and(eq(alerts.clientId, clientId), ne(alerts.status, 'resolved')));

  const experience = profile?.experienceLevel ?? null;
  const pops = new Set<string>();
  if (age != null && age < 18) pops.add('youth');
  if (age != null && age >= 65) pops.add('older_adults');
  if (age == null || (age >= 18 && age < 65))
    pops.add(
      experience === 'beginner'
        ? 'adults_untrained'
        : experience === 'advanced'
          ? 'adults_resistance_trained'
          : 'adults_recreational',
    );
  for (const g of goalRows) {
    if (g.sportFamily === 'team') pops.add('team_sport_athletes');
    if (g.sportFamily === 'endurance') pops.add('endurance_athletes');
    if (g.sport === 'football' || g.sport === 'futsal') pops.add('football_players');
    if (g.sport === 'handball') pops.add('handball_players');
    if (g.sport === 'sprint_athletics') pops.add('sprinters');
  }
  return {
    today,
    person: {
      age,
      sex: c.sex,
      experience: experience as ClientContext['person']['experience'],
      yearsTraining: profile?.yearsTraining != null ? Number(profile.yearsTraining) : null,
      sport: ownSport?.slug ?? null,
    },
    goals: {
      primary: primaryRow
        ? {
            slug: primaryRow.slug,
            family: primaryRow.family,
            sport: primaryRow.sport,
            sportType: primaryRow.sportFamily,
          }
        : null,
      secondary: goalRows
        .filter((g) => !g.isPrimary)
        .map((g) => ({ slug: g.slug, weight: Number(g.weight), sport: g.sport })),
    },
    metrics,
    derived,
    availability: {
      daysPerWeek: avail.length || profile?.sessionsPerWeek || null,
      minutesPerSession: profile?.sessionDurationMin ?? null,
    },
    equipment: eqRows.length ? eqRows.map((e) => e.slug) : null,
    tolerances: {
      notToleratedExerciseIds: notTolerated,
      restrictedPatterns: [...new Set(restricted)],
    },
    screening,
    response: {
      adherence28: mon.adherence28.percent,
      painFlag: liveAlerts.some((a) => a.type === 'pain'),
      srpeHigh: liveAlerts.some((a) => a.type === 'srpe_high'),
    },
    manualTraits: Object.fromEntries(flagRows.map((f) => [f.trait, f.value])),
    modality: c.modality,
    populations: [...pops].sort(),
    missing,
  };
}

// ── Running and storing (stages 2–10 are pure) ────────────────────────────────

type RecType =
  'need' | 'priority' | 'method' | 'exercise' | 'dose' | 'plan_proposal' | 'referral_notice';
const conf = (c: Explanation['confidence']) => (c === 'very_low' ? 'low' : c);

async function runDecision_(
  ctx: RequestContext,
  clientId: string,
): Promise<{ runId: string; result: DecisionResult }> {
  await authorizeClient(ctx, 'decision:run', clientId);
  const context = await buildDecisionContext(ctx, clientId);
  const cfg = await organizationDecisionRules(ctx.db as Database, ctx.actor.organizationId);
  const snapshot = await knowledgeSnapshot(ctx, clientId, cfg.version, cfg.rules);
  const result = runDecisionEngine(context, snapshot);
  const [run] = await ctx.db
    .insert(decisionRuns)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      ruleSetVersion: cfg.version,
      inputHash: result.inputHash,
      context,
      result,
      createdBy: ctx.actor.userId,
    })
    .returning({ id: decisionRuns.id });
  const runId = run!.id;
  // Earlier pending proposals are superseded (decided ones stay as history).
  await ctx.db
    .update(recommendations)
    .set({ status: 'superseded' })
    .where(
      and(
        eq(recommendations.clientId, clientId),
        inArray(recommendations.status, ['proposed', 'postponed']),
        // Programming adjustments (Phase 11) carry a situation key and live on their own.
        isNull(recommendations.key),
      ),
    );

  const items: { type: RecType; payload: unknown; explanation: Explanation }[] = [];
  if (result.screening.status === 'refer')
    items.push({
      type: 'referral_notice',
      payload: { text: result.screening.reasons[0] },
      explanation: {
        proposal: result.screening.reasons[0]!,
        data: ['Cribado previo con resultado «derivar».'],
        interpretation: ['Solo propuestas de baja intensidad hasta su valoración.'],
        rules: [{ key: 'screening.refer', version: cfg.version || 1 }],
        evidence: [],
        applicability: [],
        limitations: ['El cribado no es un diagnóstico.'],
        confidence: 'high',
      },
    });
  for (const n of result.needs)
    items.push({
      type: 'need',
      payload: { quality: n.quality, score: n.score, direction: n.direction },
      explanation: n.explanation,
    });
  for (const p of result.priorities)
    items.push({
      type: 'priority',
      payload: p,
      explanation: result.needs.find((n) => n.quality === p.quality)!.explanation,
    });
  for (const m of result.methods)
    items.push({
      type: 'method',
      payload: { method: m.method, name: m.name, quality: m.quality },
      explanation: m.explanation,
    });
  if (result.planSkeleton)
    items.push({
      type: 'plan_proposal',
      payload: {
        ...result.planSkeleton,
        explanation: undefined,
        introPhase: { level: result.introPhase.level, weeks: result.introPhase.weeks },
      },
      explanation: result.planSkeleton.explanation,
    });
  const claimIds = new Map(
    (
      await ctx.db
        .select({ id: knowledgeClaims.id, key: knowledgeClaims.key })
        .from(knowledgeClaims)
        .where(visible(ctx, knowledgeClaims.organizationId))
    ).map((c) => [c.key, c.id]),
  );
  for (const it of items) {
    const [rec] = await ctx.db
      .insert(recommendations)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        type: it.type,
        payload: it.payload as object,
        explanation: it.explanation,
        inputsSnapshot: { runId, inputHash: result.inputHash },
        ruleSetVersion: cfg.version,
        ruleKeys: it.explanation.rules.map((r) => r.key),
        confidence: conf(it.explanation.confidence),
      })
      .returning({ id: recommendations.id });
    const ev = [
      ...new Set(
        it.explanation.evidence
          .map((e) => claimIds.get(e.claimKey))
          .filter((x): x is string => !!x),
      ),
    ];
    if (ev.length)
      await ctx.db
        .insert(recommendationEvidence)
        .values(ev.map((claimId) => ({ recommendationId: rec!.id, claimId })));
  }
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'decision_run',
    entityId: runId,
    clientId,
    changes: {
      ruleSetVersion: cfg.version,
      inputHash: result.inputHash,
      recommendations: items.length,
    },
  });
  return { runId, result };
}

async function getDecision_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'decision:read', clientId);
  const [run] = await ctx.db
    .select()
    .from(decisionRuns)
    .where(eq(decisionRuns.clientId, clientId))
    .orderBy(desc(decisionRuns.createdAt))
    .limit(1);
  const [flags, off] = await Promise.all([
    ctx.db.select().from(clientTraitFlags).where(eq(clientTraitFlags.clientId, clientId)),
    ctx.db
      .select()
      .from(clientRuleOverrides)
      .where(
        and(eq(clientRuleOverrides.clientId, clientId), eq(clientRuleOverrides.enabled, false)),
      ),
  ]);
  if (!run) return { run: null, recommendations: [], traitFlags: flags, disabledRules: off };
  const recs = await ctx.db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        sql`${recommendations.inputsSnapshot}->>'runId' = ${run.id}`,
      ),
    )
    .orderBy(asc(recommendations.createdAt));
  return {
    run: {
      id: run.id,
      createdAt: run.createdAt,
      ruleSetVersion: run.ruleSetVersion,
      inputHash: run.inputHash,
      result: run.result as DecisionResult,
      context: run.context as ClientContext,
    },
    recommendations: recs.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      payload: r.payload as Record<string, unknown>,
      explanation: r.explanation as Explanation,
      ruleKeys: r.ruleKeys,
      confidence: r.confidence,
      decidedAt: r.decidedAt,
      decisionReason: r.decisionReason,
    })),
    traitFlags: flags,
    disabledRules: off,
  };
}
export type DecisionView = Awaited<ReturnType<typeof getDecision_>>;

async function decideRecommendation_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(decideRecommendationSchema, input);
  const [rec] = await ctx.db.select().from(recommendations).where(eq(recommendations.id, id));
  if (!rec) throw new DomainError('not_found', 'Propuesta no encontrada.');
  await authorizeClient(ctx, 'decision:decide', rec.clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Propuesta no encontrada.');
    throw e;
  });
  if (rec.status !== 'proposed' && rec.status !== 'postponed')
    throw new DomainError(
      'conflict',
      'La propuesta ya está decidida o sustituida por otra más reciente.',
    );
  const changes = Object.entries(d.changes ?? {});
  if (d.action === 'accept_with_changes' && !changes.length)
    throw new DomainError('validation', 'Indica qué cambias.', { changes: ['required'] });
  const status =
    d.action === 'accept'
      ? 'accepted'
      : d.action === 'accept_with_changes'
        ? 'accepted_with_changes'
        : d.action === 'reject'
          ? 'rejected'
          : 'postponed';
  await ctx.db
    .update(recommendations)
    .set({
      status,
      // Postponing is also a decision (who and when); a later decision overwrites it.
      decidedBy: ctx.actor.userId,
      decidedAt: ctx.now(),
      decisionReason: d.reason ?? null,
    })
    .where(eq(recommendations.id, id));
  const payload = rec.payload as Record<string, unknown>;
  if (changes.length)
    await ctx.db.insert(manualOverrides).values(
      changes.map(([field, value]) => ({
        organizationId: rec.organizationId,
        clientId: rec.clientId,
        entityType: 'recommendation',
        entityId: rec.id,
        field,
        proposedValue: (payload[field] ?? null) as object,
        finalValue: value as object,
        recommendationId: rec.id,
        reason: d.reason ?? null,
        userId: ctx.actor.userId,
      })),
    );
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'recommendation',
    entityId: id,
    clientId: rec.clientId,
    changes: [
      { field: 'status', before: rec.status, after: status },
      ...changes.map(([field, value]) => ({ field, before: payload[field] ?? null, after: value })),
    ],
    reason: d.reason ?? null,
  });
}

async function setTraitFlag_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(traitFlagSchema, input);
  await authorizeClient(ctx, 'decision:decide', clientId);
  const [before] = await ctx.db
    .select()
    .from(clientTraitFlags)
    .where(and(eq(clientTraitFlags.clientId, clientId), eq(clientTraitFlags.trait, d.trait)));
  if (d.value === null)
    await ctx.db
      .delete(clientTraitFlags)
      .where(and(eq(clientTraitFlags.clientId, clientId), eq(clientTraitFlags.trait, d.trait)));
  else
    await ctx.db
      .insert(clientTraitFlags)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        trait: d.trait,
        value: d.value,
        note: d.note ?? null,
        createdBy: ctx.actor.userId,
      })
      .onConflictDoUpdate({
        target: [clientTraitFlags.clientId, clientTraitFlags.trait],
        set: { value: d.value, note: d.note ?? null, createdBy: ctx.actor.userId },
      });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'client_trait_flag',
    entityId: clientId,
    clientId,
    changes: [{ field: d.trait, before: before?.value ?? null, after: d.value }],
    reason: d.note ?? null,
  });
}

// ── Rule editor and override metrics (ADMIN) ──────────────────────────────────

async function getDecisionRules_(ctx: RequestContext) {
  requirePermission(ctx, 'decision:read');
  const cfg = await organizationDecisionRules(ctx.db as Database, ctx.actor.organizationId);
  const stats = await decisionRuleStats(ctx);
  const sportList = await ctx.db
    .select({ slug: sports.slug, name: sports.name })
    .from(sports)
    .orderBy(asc(sports.name));
  const sportNames = Object.fromEntries(sportList.map((x) => [x.slug, x.name]));
  return {
    version: cfg.version,
    publishedAt: cfg.publishedAt,
    /** Sports for the population values' «Deporte» (restructure phase 17). */
    sports: sportList,
    rules: cfg.rules.map((r) => ({
      key: r.key,
      domain: r.domain,
      description: r.description,
      enabled: r.enabled,
      evidenceLevel: r.evidenceLevel,
      evidenceClaimKeys: r.evidenceClaimKeys,
      limitations: r.limitations,
      condition: r.condition,
      parameters: Object.entries(r.parameters).map(([k, p]) => ({ key: k, ...p })),
      pending: Object.values(r.parameters).some((p) => p.value === null),
      variants: (r.variants ?? []).map((v) => ({
        when: v.when,
        values: v.values,
        note: v.note ?? null,
        population: populationLabel(v.when, sportNames),
      })),
      stats: stats.get(r.key) ?? null,
    })),
  };
}

/** Per rule: decided proposals, rejections and changes (to spot badly calibrated rules, §13.9). */
async function decisionRuleStats(ctx: RequestContext) {
  const rows = await ctx.db.execute<{ key: string; status: string; n: number }>(sql`
    SELECT k AS key, status::text AS status, count(*)::int AS n
    FROM recommendations, unnest(rule_keys) AS k
    WHERE organization_id = ${ctx.actor.organizationId}
      AND status IN ('accepted', 'accepted_with_changes', 'rejected')
    GROUP BY 1, 2`);
  const out = new Map<
    string,
    { decided: number; rejected: number; changed: number; rejectionRate: number }
  >();
  for (const r of rows as unknown as { key: string; status: string; n: number }[]) {
    const s = out.get(r.key) ?? { decided: 0, rejected: 0, changed: 0, rejectionRate: 0 };
    s.decided += r.n;
    if (r.status === 'rejected') s.rejected += r.n;
    if (r.status === 'accepted_with_changes') s.changed += r.n;
    s.rejectionRate = Math.round((s.rejected / s.decided) * 1000) / 10;
    out.set(r.key, s);
  }
  return out;
}

async function updateDecisionRules_(ctx: RequestContext, input: unknown) {
  const d = parse(decisionRulesSchema, input);
  requirePermission(ctx, 'decision:rules');
  const current = await organizationDecisionRules(ctx.db as Database, ctx.actor.organizationId);
  const errors: Record<string, string[]> = {};
  const sportSlugs = new Set(
    (await ctx.db.select({ slug: sports.slug }).from(sports)).map((x) => x.slug),
  );
  const next = current.rules.map((r) => {
    const o = d.rules.find((x) => x.key === r.key);
    if (!o) return r;
    const parameters = { ...r.parameters };
    for (const [k, v] of Object.entries(o.parameters)) {
      if (!(k in parameters)) (errors[`${r.key}.${k}`] ??= []).push('Parámetro desconocido.');
      else if (v !== null && v < 0) (errors[`${r.key}.${k}`] ??= []).push('Debe ser positivo.');
      else parameters[k] = { ...parameters[k]!, value: v };
    }
    // Population values (restructure phase 17): omitted = keep the current ones.
    let variants = r.variants ?? [];
    if (o.variants) {
      const err = (msg: string) => (errors[`${r.key}.variants`] ??= []).push(msg);
      variants = o.variants.map((v, i) => {
        const n = `Valores por población ${i + 1}`;
        const when = Object.fromEntries(
          Object.entries(v.when).filter(([, x]) => x !== undefined && x !== null),
        ) as ParamVariant['when'];
        if (!Object.keys(when).length)
          err(`${n}: indica al menos sexo, edad, experiencia o deporte.`);
        if (when.ageMin != null && when.ageMax != null && when.ageMin > when.ageMax)
          err(`${n}: la edad mínima es mayor que la máxima.`);
        if (when.sport && !sportSlugs.has(when.sport)) err(`${n}: deporte desconocido.`);
        if (!Object.keys(v.values).length) err(`${n}: indica al menos un valor.`);
        for (const [k, x] of Object.entries(v.values)) {
          if (!(k in parameters)) err(`${n}: parámetro desconocido «${k}».`);
          else if (x < 0) err(`${n}: los valores deben ser positivos.`);
        }
        if (o.variants!.slice(0, i).some((p) => samePopulation(p.when, when)))
          err(`${n}: repite una población anterior.`);
        return { when, values: v.values, note: v.note ?? null };
      });
    }
    return { ...r, enabled: o.enabled, parameters, variants };
  });
  for (const o of d.rules)
    if (!current.rules.some((r) => r.key === o.key))
      (errors[o.key] ??= []).push('Regla desconocida.');
  if (Object.keys(errors).length) throw new DomainError('validation', 'Revisa las reglas.', errors);
  const [{ max } = { max: 0 }] = await ctx.db
    .select({ max: sql<number>`coalesce(max(${ruleSets.version}), 0)::int` })
    .from(ruleSets)
    .where(eq(ruleSets.organizationId, ctx.actor.organizationId));
  const [prev] = await ctx.db
    .select()
    .from(ruleSets)
    .where(
      and(eq(ruleSets.organizationId, ctx.actor.organizationId), eq(ruleSets.status, 'published')),
    )
    .orderBy(desc(ruleSets.version))
    .limit(1);
  const [rs] = await ctx.db
    .insert(ruleSets)
    .values({
      organizationId: ctx.actor.organizationId,
      version: max + 1,
      status: 'published',
      notes: d.notes ?? null,
      publishedAt: ctx.now(),
      publishedBy: ctx.actor.userId,
    })
    .returning({ id: ruleSets.id, version: ruleSets.version });
  if (prev) {
    await ctx.db.update(ruleSets).set({ status: 'retired' }).where(eq(ruleSets.id, prev.id));
    // Monitoring rules (other domain) carry over unchanged.
    const others = await ctx.db
      .select()
      .from(rules)
      .where(
        and(eq(rules.ruleSetId, prev.id), sql`${rules.domain} NOT IN ${[...DECISION_DOMAINS]}`),
      );
    if (others.length)
      await ctx.db.insert(rules).values(
        others.map(({ id: _i, createdAt: _c, updatedAt: _u, ...r }) => {
          void _i;
          void _c;
          void _u;
          return { ...r, ruleSetId: rs!.id };
        }),
      );
  }
  await ctx.db.insert(rules).values(
    next.map((r) => ({
      organizationId: ctx.actor.organizationId,
      ruleSetId: rs!.id,
      key: r.key,
      domain: r.domain,
      description: r.description,
      condition: r.condition as object,
      action: r.action,
      parameters: Object.fromEntries(Object.entries(r.parameters).map(([k, p]) => [k, p.value])),
      parameterVariants: r.variants ?? [],
      evidenceLevel: r.evidenceLevel,
      limitations: r.limitations,
      enabled: r.enabled,
    })),
  );
  const changes = next.flatMap((r) => {
    const b = current.rules.find((x) => x.key === r.key)!;
    return [
      ...(b.enabled !== r.enabled
        ? [{ field: `${r.key}.enabled`, before: b.enabled, after: r.enabled }]
        : []),
      ...Object.entries(r.parameters)
        .filter(([k, p]) => b.parameters[k]!.value !== p.value)
        .map(([k, p]) => ({
          field: `${r.key}.${k}`,
          before: b.parameters[k]!.value,
          after: p.value,
        })),
      ...(stableHash(b.variants ?? []) !== stableHash(r.variants ?? [])
        ? [
            {
              field: `${r.key}.variants`,
              before: variantSummary(b.variants),
              after: variantSummary(r.variants),
            },
          ]
        : []),
    ];
  });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'rule_set',
    entityId: rs!.id,
    changes,
    reason: d.notes ?? `Reglas de decisión, versión ${rs!.version}`,
  });
  return { version: rs!.version };
}

/** «fútbol: threshold 35 · mujeres: threshold 28» for the audit trail. */
function variantSummary(vs: ParamVariant[] | undefined) {
  return (vs ?? [])
    .map(
      (v) =>
        `${populationLabel(v.when)}: ${Object.entries(v.values)
          .map(([k, x]) => `${k} ${x}`)
          .join(', ')}`,
    )
    .join(' · ');
}

// Use cases run under Row Level Security (see rls.ts).
export const runDecision = secured(runDecision_);
export const getDecision = secured(getDecision_);
export const decideRecommendation = secured(decideRecommendation_);
export const setTraitFlag = secured(setTraitFlag_);
export const getDecisionRules = secured(getDecisionRules_);
export const updateDecisionRules = secured(updateDecisionRules_);
export const decisionContext = secured(async (ctx: RequestContext, clientId: string) => {
  await authorizeClient(ctx, 'decision:read', clientId);
  return buildDecisionContext(ctx, clientId);
});
