/**
 * Client reports (encargo §34, Phase 12). Generating a report freezes a snapshot of the data
 * (ReportInput) with its sha256; every format (screen, PDF, XLSX, CSV) is rendered from that
 * snapshot, so a report reproduces exactly even if the client's data change later. Downloads are
 * audited as exports. Health data (screening, pain) only appear with the client's consent.
 */
import { createHash } from 'node:crypto';
import { generateReportSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  addDays,
  buildClientReport,
  DomainError,
  hasActiveConsent,
  localDate,
  reportRows,
  stableStringify,
  toCsv,
  type ConsentPurpose,
  type Explanation,
  type ReportInput,
} from '@tp/domain';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { clientAssessmentProgress, listClientAssessments } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient } from './authz';
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
  consents,
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

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function generateClientReport_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(generateReportSchema, input);
  await authorizeClient(ctx, 'reports:generate', clientId);
  const snapshot = await reportInput(
    ctx,
    clientId,
    { from: d.from, to: d.to },
    d.trainerNotes ?? null,
  );
  const hash = sha256(stableStringify(snapshot));
  const [r] = await ctx.db
    .insert(reports)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      type: 'client_report',
      format: 'json',
      parameters: { from: d.from, to: d.to, trainerNotes: d.trainerNotes ?? null },
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
    changes: { type: 'client_report', from: d.from, to: d.to, hash },
  });
  return { id: r!.id, hash };
}

async function loadReport(ctx: RequestContext, id: string) {
  const [r] = await ctx.db.select().from(reports).where(eq(reports.id, id));
  if (!r || !r.clientId || r.type !== 'client_report' || !r.snapshot)
    throw new DomainError('not_found', 'Informe no encontrado.');
  try {
    await authorizeClient(ctx, 'reports:generate', r.clientId);
  } catch (e) {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Informe no encontrado.');
    throw e;
  }
  return r;
}

async function listClientReports_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'reports:generate', clientId);
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
    .where(and(eq(reports.clientId, clientId), eq(reports.type, 'client_report')))
    .orderBy(desc(reports.createdAt))
    .limit(50);
  return rows.map((r) => ({
    ...r,
    parameters: r.parameters as { from: string; to: string; trainerNotes: string | null },
  }));
}

/** The report rebuilt from its frozen snapshot (identical every time). */
async function getClientReport_(ctx: RequestContext, id: string) {
  const r = await loadReport(ctx, id);
  const snapshot = r.snapshot as ReportInput;
  return {
    id: r.id,
    clientId: r.clientId!,
    hash: r.hash,
    createdAt: r.createdAt,
    intact: sha256(stableStringify(snapshot)) === r.hash,
    report: buildClientReport(snapshot),
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
  const base = `informe-${slug(report.title.replace(/^Informe de /, ''))}-${report.generatedAt.slice(0, 10)}`;
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
    clientId,
    changes: { format },
  });
  return out;
}

export const generateClientReport = secured(generateClientReport_);
export const listClientReports = secured(listClientReports_);
export const getClientReport = secured(getClientReport_);
export const downloadClientReport = secured(downloadClientReport_);
export type ClientReportView = Awaited<ReturnType<typeof getClientReport_>>;

/** Today's default period: the last 12 weeks. */
export function defaultReportPeriod(now: Date) {
  const to = localDate(now);
  return { from: addDays(to, -83), to };
}
