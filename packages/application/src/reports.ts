/**
 * Client reports (encargo §34, Phase 12). Generating a report freezes a snapshot of the data
 * (ReportInput) with its sha256; every format (screen, PDF, XLSX, CSV) is rendered from that
 * snapshot, so a report reproduces exactly even if the client's data change later. Downloads are
 * audited as exports. Health data (screening, pain) only appear with the client's consent.
 */
import { createHash } from 'node:crypto';
import { generateGroupReportSchema, generateReportSchema, shareReportSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  addDays,
  buildReport,
  clientReportView,
  DIMENSION_SETS,
  dimensionScore,
  languageIssues,
  periodInputOf,
  REPORT_KINDS,
  DomainError,
  hasActiveConsent,
  localDate,
  reportRows,
  stableStringify,
  toCsv,
  type ConsentPurpose,
  type Explanation,
  type Permission,
  type ComparativeSnapshot,
  type ComparisonData,
  type PerformanceSnapshot,
  type ReportInput,
  type ReportKind,
  type RtpSnapshot,
} from '@tp/domain';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { clientAssessmentProgress, listClientAssessments } from './assessments';
import { writeAudit } from './audit';
import { clientComparison, type ClientComparison } from './comparison';
import { getGroup, groupReport } from './groups';
import { authorizeClient, requirePermission } from './authz';
import { getClient } from './clients';
import type { RequestContext } from './context';
import { clientMonitoring } from './monitoring';
import { listPlanRevisions } from './planning';
import { reportPdf } from './render/pdf';
import { toXlsx } from './render/xlsx';
import { secured } from './rls';
import { clientSessionReview } from './sessions';
import { parse } from './validation';

const {
  assessmentResults,
  assessmentTests,
  clientGoals,
  clientGroups,
  clients: clientsTable,
  consents,
  goals: goalsTable,
  healthDeclarations,
  painLogs,
  decisionRuns,
  mesocycles,
  microcycles,
  organizations,
  phases,
  recommendations,
  reports,
  screeningResponses,
  trainerClientAssignments,
  trainers,
  trainingPlans,
  users,
} = schema;

const SEX: Record<string, string> = {
  female: 'Mujer',
  male: 'Hombre',
  other: 'Otro',
  undisclosed: 'No indicado',
};
const MODALITY: Record<string, string> = {
  in_person: 'Presencial',
  online: 'Online',
  hybrid: 'Híbrido',
};
const EXPERIENCE: Record<string, string> = {
  none: 'Sin experiencia',
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};
const STATUS: Record<string, string> = {
  accepted: 'Aceptada',
  accepted_with_changes: 'Aceptada con cambios',
  rejected: 'Rechazada',
  reverted: 'Deshecha',
  draft: 'Borrador',
  active: 'Activo',
  completed: 'Completado',
};
const REF: Record<string, string> = { low: 'Bajo', average: 'Medio', high: 'Alto' };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Gathers the snapshot of a client's report for a period (reusing the use cases' own rules). */
async function reportInput(
  ctx: RequestContext,
  clientId: string,
  period: { from: string; to: string },
  trainerNotes: string | null,
): Promise<ReportInput> {
  const c = await getClient(ctx, clientId);
  const [org] = await ctx.db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ctx.actor.organizationId));
  const staff = await ctx.db
    .select({ name: users.displayName })
    .from(trainerClientAssignments)
    .innerJoin(trainers, eq(trainers.id, trainerClientAssignments.trainerId))
    .innerJoin(users, eq(users.id, trainers.userId))
    .where(
      and(
        eq(trainerClientAssignments.clientId, clientId),
        isNull(trainerClientAssignments.endedAt),
      ),
    )
    .orderBy(asc(users.displayName));

  // Health data only with explicit consent (art. 9 RGPD).
  const cs = await ctx.db.select().from(consents).where(eq(consents.clientId, clientId));
  const healthOk = hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
  let screening: ReportInput['screening'] = 'not_consented';
  if (healthOk) {
    const [scr] = await ctx.db
      .select({ result: screeningResponses.result })
      .from(screeningResponses)
      .where(eq(screeningResponses.clientId, clientId))
      .orderBy(desc(screeningResponses.completedOn))
      .limit(1);
    screening = scr ? scr.result : 'unknown';
  }

  // Evaluation: assessments in the period with their tests.
  const inPeriod = (await listClientAssessments(ctx, clientId)).filter(
    (a) => a.status !== 'cancelled' && a.assessedOn >= period.from && a.assessedOn <= period.to,
  );
  const tests = inPeriod.length
    ? await ctx.db
        .selectDistinct({
          assessmentId: assessmentResults.assessmentId,
          name: assessmentTests.name,
        })
        .from(assessmentResults)
        .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
        .where(
          inArray(
            assessmentResults.assessmentId,
            inPeriod.map((a) => a.id),
          ),
        )
    : [];

  // Results and evolution (measured change against the test's error; applicable references).
  const progress = await clientAssessmentProgress(ctx, clientId);
  const series = progress.series
    .filter((s) => s.side === 'both')
    .map((s) => ({ ...s, points: s.points.filter((p) => p.on <= period.to) }))
    .filter((s) => s.points.length);
  const results = series
    .map((s) => {
      const last = s.points.at(-1)!;
      const ref = s.references.find((r) => r.applicable && r.zScore != null);
      const z =
        ref?.zScore == null ? null : s.test.betterDirection === 'lower' ? -ref.zScore : ref.zScore;
      return {
        test: s.test.name,
        unit: s.test.unit,
        value: last.value,
        date: last.on,
        reference:
          z == null
            ? null
            : {
                label: REF[z < -1 ? 'low' : z > 1 ? 'high' : 'average']!,
                source: ref!.population ?? 'referencia verificada',
              },
      };
    })
    .sort((a, b) => a.test.localeCompare(b.test, 'es'));
  const evolution = series
    .filter((s) => s.points.length >= 2)
    .map((s) => ({
      test: s.test.name,
      unit: s.test.unit,
      points: s.points.map((p) => ({ date: p.on, value: p.value })),
      change: s.overall
        ? {
            from: s.overall.pre,
            to: s.overall.post,
            delta: s.overall.delta,
            label: s.overall.label,
            mdc95: s.overall.error?.mdc95 ?? null,
          }
        : null,
      note: s.note,
    }))
    .sort((a, b) => a.test.localeCompare(b.test, 'es'));

  // Decision engine profile (latest run) and recommendations the trainer accepted.
  const [run] = await ctx.db
    .select({ result: decisionRuns.result })
    .from(decisionRuns)
    .where(
      and(
        eq(decisionRuns.clientId, clientId),
        lte(sql`${decisionRuns.createdAt}::date`, period.to),
      ),
    )
    .orderBy(desc(decisionRuns.createdAt))
    .limit(1);
  const result = run?.result as
    | {
        traits: { label: string; value: boolean | null; basis: string }[];
        needs: { label: string; direction: string }[];
      }
    | undefined;
  const BASIS: Record<string, string> = {
    threshold: 'umbral del centro',
    reference: 'referencia verificada',
    manual: 'valoración del entrenador',
    change: 'cambio medido',
    unknown: 'sin base',
  };
  const accepted = await ctx.db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        inArray(recommendations.status, ['accepted', 'accepted_with_changes']),
        lte(sql`${recommendations.decidedAt}::date`, period.to),
        gte(sql`${recommendations.decidedAt}::date`, period.from),
      ),
    )
    .orderBy(asc(recommendations.decidedAt), asc(recommendations.createdAt));
  const describe = (r: (typeof accepted)[number]) => {
    const p = r.payload as Record<string, unknown>;
    if (r.type === 'priority')
      return `P${p.rank} · ${p.label}: ${p.sessionsPerWeek} sesiones/semana`;
    if (r.type === 'method') return `Método: ${p.name}`;
    if (r.type === 'need') return `Necesidad: ${(r.explanation as Explanation).proposal}`;
    if (r.type === 'plan_proposal') return `Estructura: ${p.templateName ?? 'propuesta del motor'}`;
    return (p.title as string) ?? (r.explanation as Explanation).proposal;
  };
  const adjustments = accepted.filter((r) => r.key);
  const decisions = accepted.filter((r) => !r.key && r.type !== 'referral_notice');
  // Undone adjustments are part of the period's planning story too.
  const reverted = await ctx.db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        eq(recommendations.status, 'reverted'),
        gte(sql`${recommendations.decidedAt}::date`, period.from),
        lte(sql`${recommendations.decidedAt}::date`, period.to),
      ),
    );

  // Planning: the active plan (or the last one) with its current week and phase.
  const [plan] = await ctx.db
    .select()
    .from(trainingPlans)
    .where(and(eq(trainingPlans.clientId, clientId), eq(trainingPlans.kind, 'CLIENT_PLAN')))
    .orderBy(sql`${trainingPlans.status} = 'active' DESC`, desc(trainingPlans.startDate))
    .limit(1);
  let planInfo: ReportInput['plan'] = null;
  if (plan) {
    const weeks = await ctx.db
      .select({
        weekIndex: microcycles.weekIndex,
        start: microcycles.startDate,
        phase: phases.name,
      })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, plan.id))
      .orderBy(asc(microcycles.weekIndex));
    const w = weeks.find(
      (x) => x.start && x.start <= period.to && addDays(x.start, 6) >= period.to,
    );
    planInfo = {
      name: plan.name,
      status: STATUS[plan.status] ?? plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      weeks: weeks.length,
      sessionsPerWeek: plan.sessionsPerWeek,
      currentWeek: w?.weekIndex ?? null,
      phase: w?.phase ?? null,
      revisions: (await listPlanRevisions(ctx, plan.id)).length,
    };
  }

  // Adherence, load, wellness and session feedback.
  const mon = await clientMonitoring(ctx, clientId);
  const done = (await clientSessionReview(ctx, clientId)).filter(
    (r) => r.date && r.date >= period.from && r.date <= period.to && r.status,
  );
  const rpe = done.map((r) => r.sessionRpe).filter((x): x is number => x != null);
  const wellness = mon.readiness
    .filter((r) => r.date >= period.from && r.date <= period.to)
    .map((r) => r.score)
    .filter((x): x is number => x != null);

  // Next reassessment: a test week ahead in the plan, else the engine's rule from the last one.
  let next: ReportInput['nextReassessment'] = {
    date: null,
    basis: 'Sin reevaluación programada: conviene planificarla.',
  };
  if (plan) {
    const [tw] = await ctx.db
      .select({ start: microcycles.startDate })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(
        and(
          eq(phases.planId, plan.id),
          eq(microcycles.weekType, 'test'),
          gte(microcycles.startDate, period.to),
        ),
      )
      .orderBy(asc(microcycles.startDate))
      .limit(1);
    if (tw?.start) next = { date: tw.start, basis: 'semana de evaluación del plan' };
  }
  const lastAssessment = (await listClientAssessments(ctx, clientId)).find(
    (a) => a.status !== 'cancelled' && a.assessedOn <= period.to,
  );
  if (!next.date && lastAssessment) {
    const every =
      (run?.result as { planSkeleton?: { reassessmentEveryWeeks?: number } } | undefined)
        ?.planSkeleton?.reassessmentEveryWeeks ?? 6;
    next = {
      date: addDays(lastAssessment.assessedOn, every * 7),
      basis: `cada ${every} semanas desde la última evaluación (${lastAssessment.assessedOn.split('-').reverse().join('/')})`,
    };
  }

  return {
    generatedAt: ctx.now().toISOString(),
    period,
    organization: org?.name ?? '',
    trainers: staff.map((s) => s.name),
    client: {
      name: `${c.firstName} ${c.lastName}`,
      age: c.age,
      sex: SEX[c.sex] ?? c.sex,
      modality: MODALITY[c.modality] ?? c.modality,
      experience: c.profile ? (EXPERIENCE[c.profile.experienceLevel] ?? null) : null,
      sessionsPerWeek: c.profile?.sessionsPerWeek ?? null,
      minutesPerSession: c.profile?.sessionDurationMin ?? null,
      since: c.joinedAt,
    },
    goals: c.goals.map((g) => ({ name: g.name, primary: g.isPrimary, sport: g.sportName ?? null })),
    screening,
    assessments: inPeriod
      .map((a) => ({
        date: a.assessedOn,
        context: a.context,
        tests: tests
          .filter((t) => t.assessmentId === a.id)
          .map((t) => t.name)
          .sort(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    results,
    series: evolution,
    traits: (result?.traits ?? []).map((t) => ({
      label: t.label,
      value: t.value,
      basis: BASIS[t.basis] ?? t.basis,
    })),
    needs: (result?.needs ?? []).map((n) => ({ label: n.label, direction: n.direction })),
    plan: planInfo,
    adjustments: [...adjustments, ...reverted]
      .map((r) => ({
        title: (r.payload as { title: string }).title,
        status: STATUS[r.status] ?? r.status,
        date: r.decidedAt!.toISOString().slice(0, 10),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    adherence: {
      last4: mon.adherence28,
      last12: mon.adherence84,
      weeks: mon.weeks.map((w) => ({
        weekStart: w.weekStart,
        planned: w.adherence.planned,
        done: w.adherence.done,
        load: w.load,
      })),
    },
    feedback: {
      sessionsWithRpe: rpe.length,
      avgRpe: avg(rpe),
      avgWellness: avg(wellness),
      painReports: healthOk ? done.filter((r) => r.pain != null && r.pain > 0).length : null,
      comments: done
        .filter((r) => r.comment)
        .slice(0, 5)
        .map((r) => ({ date: r.date!, text: r.comment! })),
    },
    recommendations: decisions.map((r) => ({
      text: describe(r),
      status: STATUS[r.status] ?? r.status,
      evidence: (r.explanation as Explanation).evidence.flatMap((e) =>
        e.sources.map((s) => ({ citation: s.citation, doi: s.doi })),
      ),
    })),
    trainerNotes,
    nextReassessment: next,
  };
}

const isStaff = (ctx: RequestContext) =>
  ctx.actor.roles.includes('ADMIN') || ctx.actor.roles.includes('TRAINER');

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** The trainer's free text follows the report language rules (no «previene lesiones», «apto»…). */
function checkLanguage(text: string | null | undefined) {
  if (!text) return;
  const issues = languageIssues(text);
  if (issues.length)
    throw new DomainError(
      'validation',
      `Revisa el texto: ${issues.map((i) => `«${i.phrase}»`).join(', ')}. ${issues[0]!.message}`,
      { trainerNotes: issues.map((i) => `«${i.phrase}»: ${i.message}`) },
    );
}

const neutralLabelOf = (c: ClientComparison) =>
  c.basis?.kind === 'group'
    ? c.scale?.value === 'percentile'
      ? 'P50 del grupo'
      : 'Media del grupo'
    : c.scale?.value === 'percent_reference'
      ? '100 % de la referencia'
      : 'Referencia';

/** The frozen part of a comparison (what the report needs, nothing else). */
function comparisonData(c: ClientComparison, withScale = true): ComparisonData | null {
  if (!c.b || !c.scale) return null;
  return {
    a: c.a ? { date: c.a.assessedOn } : null,
    b: { date: c.b.assessedOn },
    scale: withScale
      ? { key: c.scale.value, label: c.scale.label, neutral: c.scale.neutral, range: c.scale.range }
      : null,
    basisLabel: withScale ? (c.basis?.label ?? null) : null,
    neutralLabel: neutralLabelOf(c),
    dimensions: c.dimensions.map((d) => ({ name: d.name, scoreA: d.scoreA, scoreB: d.scoreB })),
    items: c.items.map((i) => ({
      name: i.name,
      unit: i.unit,
      direction: i.direction,
      rawA: i.rawA,
      rawB: i.rawB,
      scoreA: withScale ? i.scoreA : null,
      scoreB: withScale ? i.scoreB : null,
      basis: withScale ? i.basis : null,
      change: i.change
        ? {
            delta: i.change.delta,
            deltaPercent: i.change.deltaPercent,
            label: i.change.label,
            mdc95: i.change.error?.mdc95 ?? null,
          }
        : null,
    })),
    notes: c.notes,
  };
}

/** Only B (the starting point): no A layer, no change. */
const onlyB = (c: ComparisonData): ComparisonData => ({
  ...c,
  a: null,
  dimensions: c.dimensions.map((d) => ({ ...d, scoreA: null })),
  items: c.items.map((i) => ({ ...i, rawA: null, scoreA: null, change: null })),
});

async function healthConsent(ctx: RequestContext, clientId: string) {
  const cs = await ctx.db.select().from(consents).where(eq(consents.clientId, clientId));
  return hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
}

const DECLARATION: Record<string, string> = {
  injury: 'Lesión',
  surgery: 'Cirugía',
  limitation: 'Limitación',
  other: 'Otra',
};
const DECLARED: Record<string, string> = {
  active: 'Activa',
  resolved: 'Resuelta',
  unknown: 'Sin indicar',
};

/** The snapshot of a client's report of any kind (phase 6). */
async function snapshotFor(
  ctx: RequestContext,
  clientId: string,
  d: ReturnType<typeof generateReportSchema.parse>,
): Promise<{ type: string; snapshot: unknown; parameters: Record<string, unknown> }> {
  const notes = d.trainerNotes ?? null;
  const period = d.from && d.to ? { from: d.from, to: d.to } : null;
  const parameters = { kind: d.kind, from: d.from ?? null, to: d.to ?? null, trainerNotes: notes };
  const withResults = async () =>
    (await clientComparison(ctx, clientId, {})).assessments.filter((a) => a.hasResults);
  switch (d.kind) {
    case 'technical':
      return {
        type: 'client_report',
        snapshot: await reportInput(ctx, clientId, period!, notes),
        parameters,
      };
    case 'client':
      return {
        type: 'client',
        snapshot: await reportInput(ctx, clientId, period!, notes),
        parameters,
      };
    case 'initial':
    case 'follow_up':
    case 'final': {
      const input = await reportInput(ctx, clientId, period!, notes);
      const inPeriod = (await withResults()).filter(
        (a) => a.assessedOn >= period!.from && a.assessedOn <= period!.to,
      );
      let comparison: ComparisonData | null = null;
      if (d.kind === 'initial' && inPeriod.length) {
        const c = comparisonData(await clientComparison(ctx, clientId, { b: inPeriod[0]!.id }));
        comparison = c ? onlyB(c) : null;
      } else if (d.kind === 'final' && inPeriod.length >= 2)
        comparison = comparisonData(
          await clientComparison(ctx, clientId, { a: inPeriod[0]!.id, b: inPeriod.at(-1)!.id }),
        );
      else if (d.kind === 'follow_up' && inPeriod.length)
        comparison = comparisonData(
          await clientComparison(ctx, clientId, { b: inPeriod.at(-1)!.id }),
        );
      const goals =
        d.kind === 'final'
          ? (
              await ctx.db
                .select({ name: goalsTable.name, status: clientGoals.status })
                .from(clientGoals)
                .innerJoin(goalsTable, eq(goalsTable.id, clientGoals.goalId))
                .where(eq(clientGoals.clientId, clientId))
                .orderBy(desc(clientGoals.isPrimary), asc(goalsTable.name))
            ).map((g) => ({ name: g.name, status: g.status }))
          : undefined;
      return {
        type: d.kind,
        snapshot: { input, comparison, ...(goals ? { goals } : {}) },
        parameters,
      };
    }
    case 'comparative': {
      const scale =
        d.reference === 'normative' ? 'z_reference' : d.reference === 'group' ? 'z_group' : 'auto';
      const c = await clientComparison(ctx, clientId, { a: d.a, b: d.b, scale });
      const data = comparisonData(c, d.reference !== 'none');
      if (!data)
        throw new DomainError('validation', 'El cliente no tiene evaluaciones con resultados.');
      const progress = await clientAssessmentProgress(ctx, clientId);
      const names = new Set(data.items.map((i) => i.name));
      const snapshot: ComparativeSnapshot = {
        generatedAt: ctx.now().toISOString(),
        organization: await orgName(ctx),
        client: await getClient(ctx, clientId).then((x) => ({
          name: `${x.firstName} ${x.lastName}`,
        })),
        reference: d.reference,
        comparison: data,
        series: progress.series
          .filter((x) => names.has(x.test.name) && x.side === 'both')
          .map((x) => ({
            test: x.test.name,
            unit: x.test.unit,
            points: x.points
              .filter((p) => p.on <= data.b.date)
              .map((p) => ({ date: p.on, value: p.value })),
          })),
        trainerNotes: notes,
      };
      return {
        type: 'comparative',
        snapshot,
        parameters: {
          ...parameters,
          a: c.a?.id ?? null,
          b: c.b?.id ?? null,
          reference: d.reference,
        },
      };
    }
    case 'rtp': {
      const consent = await healthConsent(ctx, clientId);
      const c = await getClient(ctx, clientId);
      let injury: RtpSnapshot['injury'] = null;
      let pain: RtpSnapshot['pain'] = [];
      let comparison: ComparisonData | null = null;
      if (consent) {
        const [h] = await ctx.db
          .select()
          .from(healthDeclarations)
          .where(
            and(
              eq(healthDeclarations.clientId, clientId),
              inArray(healthDeclarations.type, ['injury', 'surgery']),
            ),
          )
          .orderBy(
            sql`${healthDeclarations.declaredStatus} = 'active' DESC`,
            desc(healthDeclarations.declaredOn),
          )
          .limit(1);
        if (h)
          injury = {
            type: DECLARATION[h.type] ?? h.type,
            region: h.bodyRegion,
            declaredOn: h.declaredOn!,
            status: DECLARED[h.declaredStatus] ?? h.declaredStatus,
            cleared: h.clearedAt != null,
          };
        const since = addDays(localDate(ctx.now()), -180);
        pain = (
          await ctx.db
            .select({
              date: painLogs.occurredOn,
              intensity: painLogs.intensity,
              region: painLogs.bodyRegion,
            })
            .from(painLogs)
            .where(and(eq(painLogs.clientId, clientId), gte(painLogs.occurredOn, since)))
            .orderBy(asc(painLogs.occurredOn))
        ).map((p) => ({ date: p.date, intensity: p.intensity, region: p.region }));
        if (injury) {
          const list = await withResults();
          const before = list.filter((a) => a.assessedOn < injury!.declaredOn).at(-1);
          const after = list.filter((a) => a.assessedOn >= injury!.declaredOn).at(-1);
          if (before && after)
            comparison = comparisonData(
              await clientComparison(ctx, clientId, { a: before.id, b: after.id }),
            );
        }
      }
      const snapshot: RtpSnapshot = {
        generatedAt: ctx.now().toISOString(),
        organization: await orgName(ctx),
        client: { name: `${c.firstName} ${c.lastName}` },
        consent,
        injury,
        pain,
        comparison,
        trainerNotes: notes,
      };
      return { type: 'rtp', snapshot, parameters };
    }
  }
}

async function orgName(ctx: RequestContext) {
  const [org] = await ctx.db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ctx.actor.organizationId));
  return org?.name ?? '';
}

async function generateClientReport_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(generateReportSchema, input);
  checkLanguage(d.trainerNotes);
  await authorizeClient(ctx, 'reports:generate', clientId);
  const { type, snapshot, parameters } = await snapshotFor(ctx, clientId, d);
  const hash = sha256(stableStringify(snapshot));
  const [r] = await ctx.db
    .insert(reports)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      type,
      format: 'json',
      parameters,
      snapshot,
      hash,
      status: 'succeeded',
      generatedBy: ctx.actor.userId,
    })
    .returning({ id: reports.id });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'report',
    entityId: r!.id,
    clientId,
    changes: { type, from: d.from ?? null, to: d.to ?? null, hash },
  });
  return { id: r!.id, hash };
}

/**
 * Rendimiento (group): the group report of one assessment date, with the individual sheet (radar
 * of dimensions against the group, strengths, points to improve) of the chosen people.
 */
async function generateGroupReport_(ctx: RequestContext, groupId: string, input: unknown) {
  const d = parse(generateGroupReportSchema, input);
  checkLanguage(d.trainerNotes);
  requirePermission(ctx, 'reports:generate', { organizationId: ctx.actor.organizationId });
  const g = await groupReport(ctx, groupId, { date: d.date });
  if (!g.members.length)
    throw new DomainError('validation', 'No hay evaluaciones del grupo en esa fecha.', {
      date: ['empty'],
    });
  const chosen = d.players?.length
    ? g.members.filter((m) => d.players!.includes(m.clientId))
    : g.members;
  const bySlug = new Map(
    g.rows
      .filter(
        (r) =>
          r.kind !== 'asymmetry' && (r.kind === 'formula' ? r.side === 'both' : r.side === 'both'),
      )
      .map((r) => [r.kind === 'formula' ? r.key : r.key.split(':')[0]!, r]),
  );
  const snapshot: PerformanceSnapshot = {
    generatedAt: ctx.now().toISOString(),
    organization: await orgName(ctx),
    group: {
      name: g.group.name,
      date: g.date,
      members: g.members.map((m) => m.name),
      missing: g.missing,
    },
    rows: g.rows.map((r) => ({
      name: r.name,
      unit: r.unit,
      direction: r.direction,
      n: r.n,
      mean: r.mean,
      sd: r.sd,
      max: r.max,
      min: r.min,
      best: r.best,
      worst: r.worst,
      reference: r.references[0]?.split(' (')[0] ?? null,
      z: r.z,
      values: r.values,
      flags: r.flags,
    })),
    players: chosen.map((m) => {
      const i = g.members.indexOf(m);
      return {
        name: m.name,
        dimensions: DIMENSION_SETS.performance
          .map((dim) => ({
            name: dim.name,
            score: dimensionScore(
              dim.items.map((it) => ({ ...it, score: bySlug.get(it.slug)?.z[i] ?? null })),
            ).score,
          }))
          .filter((x) => x.score != null),
        items: g.rows
          .filter((r) => r.direction !== 'target_range' && r.kind !== 'asymmetry')
          .map((r) => ({ name: r.name, score: r.z[i] ?? null })),
      };
    }),
    trainerNotes: d.trainerNotes ?? null,
  };
  const hash = sha256(stableStringify(snapshot));
  const [r] = await ctx.db
    .insert(reports)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId: null,
      type: 'performance',
      format: 'json',
      parameters: {
        kind: 'performance',
        groupId,
        date: d.date,
        players: chosen.map((m) => m.clientId),
        // Everyone whose data the report holds: only who can see all of them may open it.
        members: g.members.map((m) => m.clientId),
      },
      snapshot,
      hash,
      status: 'succeeded',
      generatedBy: ctx.actor.userId,
    })
    .returning({ id: reports.id });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'report',
    entityId: r!.id,
    changes: { type: 'performance', groupId, date: d.date, hash },
  });
  return { id: r!.id, hash };
}

async function listGroupReports_(ctx: RequestContext, groupId: string) {
  await getGroup(ctx, groupId);
  const rows = await ctx.db
    .select({
      id: reports.id,
      parameters: reports.parameters,
      hash: reports.hash,
      createdAt: reports.createdAt,
      by: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.generatedBy))
    .where(
      and(
        isNull(reports.clientId),
        eq(reports.type, 'performance'),
        sql`${reports.parameters}->>'groupId' = ${groupId}`,
      ),
    )
    .orderBy(desc(reports.createdAt))
    .limit(50);
  const out = [];
  for (const r of rows) {
    const p = r.parameters as { date: string; members?: string[] };
    if (await canSeeAll(ctx, p.members ?? [])) out.push({ ...r, parameters: { date: p.date } });
  }
  return out;
}

/**
 * A group report holds data of several people: an ADMIN sees it; a trainer only if they can access
 * every one of them (RLS on clients decides which are visible).
 */
async function canSeeAll(ctx: RequestContext, ids: string[]) {
  if (ctx.actor.roles.includes('ADMIN')) return true;
  if (!ids.length) return true;
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(clientsTable)
    .where(inArray(clientsTable.id, ids));
  return (row?.n ?? 0) === new Set(ids).size;
}

async function loadReport(
  ctx: RequestContext,
  id: string,
  permission: Permission = 'reports:generate',
) {
  const [r] = await ctx.db.select().from(reports).where(eq(reports.id, id));
  if (!r || !r.snapshot || !(r.type === 'client_report' || r.type in REPORT_KINDS))
    throw new DomainError('not_found', 'Informe no encontrado.');
  // Group reports: staff of the organization only (RLS: client_id NULL is staff-only).
  if (!r.clientId) {
    if (!isStaff(ctx)) throw new DomainError('not_found', 'Informe no encontrado.');
    requirePermission(ctx, 'reports:generate', { organizationId: ctx.actor.organizationId });
    const p = r.parameters as { groupId?: string; members?: string[] } | null;
    if (!(await canSeeAll(ctx, p?.members ?? [])))
      throw new DomainError('not_found', 'Informe no encontrado.');
    const groupId = p?.groupId;
    if (groupId) {
      const [g] = await ctx.db
        .select({ id: clientGroups.id })
        .from(clientGroups)
        .where(eq(clientGroups.id, groupId));
      if (!g) throw new DomainError('not_found', 'Informe no encontrado.');
    }
    return r;
  }
  // The client only ever sees what their trainer shared (RLS enforces it too).
  if (!r.sharedAt && !isStaff(ctx)) throw new DomainError('not_found', 'Informe no encontrado.');
  try {
    await authorizeClient(ctx, permission, r.clientId);
  } catch (e) {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Informe no encontrado.');
    throw e;
  }
  return r;
}

const kindOf = (type: string): ReportKind =>
  type === 'client_report' ? 'technical' : (type as ReportKind);

async function listClientReports_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'reports:generate', clientId);
  const rows = await ctx.db
    .select({
      id: reports.id,
      type: reports.type,
      parameters: reports.parameters,
      hash: reports.hash,
      createdAt: reports.createdAt,
      sharedAt: reports.sharedAt,
      by: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.generatedBy))
    .where(eq(reports.clientId, clientId))
    .orderBy(desc(reports.createdAt))
    .limit(50);
  return rows.map(({ type, ...r }) => ({
    ...r,
    kind: kindOf(type),
    kindLabel: REPORT_KINDS[kindOf(type)]?.label ?? type,
    shareable: periodInputOf(type, {}) !== null,
    parameters: r.parameters as {
      from: string | null;
      to: string | null;
      trainerNotes: string | null;
    },
  }));
}

/** The report rebuilt from its frozen snapshot (identical every time). */
async function getClientReport_(ctx: RequestContext, id: string) {
  const r = await loadReport(ctx, id);
  const kind = kindOf(r.type);
  return {
    id: r.id,
    clientId: r.clientId,
    groupId: (r.parameters as { groupId?: string } | null)?.groupId ?? null,
    kind,
    kindLabel: REPORT_KINDS[kind].label,
    shareable: !!r.clientId && periodInputOf(r.type, r.snapshot) !== null,
    hash: r.hash,
    createdAt: r.createdAt,
    sharedAt: r.sharedAt,
    intact: sha256(stableStringify(r.snapshot)) === r.hash,
    report: buildReport(r.type, r.snapshot),
  };
}

export interface FileOut {
  fileName: string;
  contentType: string;
  body: Buffer;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

async function downloadClientReport_(
  ctx: RequestContext,
  id: string,
  format: string,
): Promise<FileOut> {
  if (!['pdf', 'xlsx', 'csv'].includes(format))
    throw new DomainError('validation', 'Formato no válido.', { format: ['pdf, xlsx o csv'] });
  const { report, clientId } = await getClientReport_(ctx, id);
  const base = `${slug(report.title.replace(/^Informe de /, 'Informe '))}-${report.generatedAt.slice(0, 10)}`;
  let out: FileOut;
  if (format === 'pdf')
    out = {
      fileName: `${base}.pdf`,
      contentType: 'application/pdf',
      body: await reportPdf(report),
    };
  else if (format === 'xlsx')
    out = {
      fileName: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: await toXlsx(
        [
          {
            name: 'Informe',
            rows: reportRows(report),
            bold: reportRows(report)
              .map((r, i) => (i === 0 || /^\d+\. /.test(String(r[0] ?? '')) ? i : -1))
              .filter((i) => i >= 0),
          },
        ],
        new Date(report.generatedAt),
      ),
    };
  else
    out = {
      fileName: `${base}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(toCsv(reportRows(report)), 'utf8'),
    };
  await writeAudit(ctx.db, ctx, {
    action: 'export',
    entityType: 'report',
    entityId: id,
    clientId: clientId ?? null,
    changes: { format },
  });
  return out;
}

/** Shares the report with the client's app, or stops sharing it (the trainer decides). */
async function shareClientReport_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(shareReportSchema, input);
  const r = await loadReport(ctx, id);
  if (!r.clientId || periodInputOf(r.type, r.snapshot) === null)
    throw new DomainError(
      'validation',
      'Este tipo de informe es solo para el equipo: el cliente recibe los informes de su periodo en lenguaje sencillo.',
    );
  if (!!r.sharedAt === d.shared) return { id, sharedAt: r.sharedAt };
  const [u] = await ctx.db
    .update(reports)
    .set(
      d.shared
        ? { sharedAt: ctx.now(), sharedBy: ctx.actor.userId, updatedAt: ctx.now() }
        : { sharedAt: null, sharedBy: null, updatedAt: ctx.now() },
    )
    .where(eq(reports.id, id))
    .returning({ sharedAt: reports.sharedAt });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'report',
    entityId: id,
    clientId: r.clientId,
    changes: { shared: d.shared },
  });
  return { id, sharedAt: u!.sharedAt };
}

/** Reports shared with the client, newest first (the client's app and the trainer's preview). */
async function listSharedReports_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'reports:read_shared', clientId);
  const rows = await ctx.db
    .select({ id: reports.id, parameters: reports.parameters, sharedAt: reports.sharedAt })
    .from(reports)
    .where(
      and(
        eq(reports.clientId, clientId),
        inArray(reports.type, ['client_report', 'client', 'initial', 'follow_up', 'final']),
        sql`${reports.sharedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(reports.sharedAt))
    .limit(50);
  return rows.map((r) => {
    const p = r.parameters as { from: string; to: string };
    return { id: r.id, from: p.from, to: p.to, sharedAt: r.sharedAt! };
  });
}

/** The client's plain-language version, from the same frozen snapshot. */
async function getClientReportView_(ctx: RequestContext, id: string) {
  const r = await loadReport(ctx, id, 'reports:read_shared');
  return {
    id: r.id,
    clientId: r.clientId!,
    sharedAt: r.sharedAt,
    report: clientReportView(periodInputOf(r.type, r.snapshot)!),
  };
}

async function downloadClientReportView_(ctx: RequestContext, id: string): Promise<FileOut> {
  const { report, clientId } = await getClientReportView_(ctx, id);
  await writeAudit(ctx.db, ctx, {
    action: 'export',
    entityType: 'report',
    entityId: id,
    clientId,
    changes: { format: 'pdf', version: 'client' },
  });
  return {
    fileName: `mi-informe-${report.generatedAt.slice(0, 10)}.pdf`,
    contentType: 'application/pdf',
    body: await reportPdf(report),
  };
}

export const generateClientReport = secured(generateClientReport_);
export const shareClientReport = secured(shareClientReport_);
export const listSharedReports = secured(listSharedReports_);
export const getClientReportView = secured(getClientReportView_);
export const downloadClientReportView = secured(downloadClientReportView_);
export const listClientReports = secured(listClientReports_);
export const generateGroupReport = secured(generateGroupReport_);
export const listGroupReports = secured(listGroupReports_);
export const getClientReport = secured(getClientReport_);
export const downloadClientReport = secured(downloadClientReport_);
export type ClientReportView = Awaited<ReturnType<typeof getClientReport_>>;

/** Today's default period: the last 12 weeks. */
export function defaultReportPeriod(now: Date) {
  const to = localDate(now);
  return { from: addDays(to, -83), to };
}
