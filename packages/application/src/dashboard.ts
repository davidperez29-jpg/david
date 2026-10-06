/**
 * Dashboards and global calendar (Fase 9, MASTER_SPECIFICATION §8.2–8.3, §9.2, §9.5, F18).
 * Read models only: they aggregate what other modules own (sessions, assessments, monitoring).
 */
import { calendarQuerySchema, progressMetricsSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  addDays,
  adherence,
  dueSessions,
  DomainError,
  localDate,
  milestones,
  planSpans,
  prescriptionShort,
  sessionStreak,
  type Span,
} from '@tp/domain';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { clientAssessmentProgress } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { clientMonitoring } from './monitoring';
import { secured } from './rls';
import { clientAgenda, prescriptionOf } from './sessions';
import { parse } from './validation';

const {
  assessments,
  assessmentTests,
  attendance,
  assessmentBatteries: batteries,
  clients,
  exercises,
  feedback,
  mesocycles,
  microcycles,
  phases,
  sessionBlocks,
  sessionExercises,
  sessions,
  trainingPlans,
} = schema;

const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const isStaff = (ctx: RequestContext) =>
  ctx.actor.roles.includes('ADMIN') || ctx.actor.roles.includes('TRAINER');

// ── Global calendar (staff) ───────────────────────────────────────────────────

/**
 * Sessions, assessments and (for one client) plan phases and rest weeks in a date range.
 * RLS limits a trainer to the clients assigned to them; ADMIN can filter by trainer.
 */
async function calendarEvents_(ctx: RequestContext, query: unknown) {
  const q = parse(calendarQuerySchema, query);
  requirePermission(ctx, 'sessions:read');
  if (!isStaff(ctx)) throw new DomainError('forbidden', 'No tienes permiso para esta acción.');
  if (q.to < q.from || addDays(q.from, 62) < q.to)
    throw new DomainError('validation', 'Rango de fechas no válido (máximo 9 semanas).', {
      to: ['range'],
    });
  if (q.clientId) await authorizeClient(ctx, 'sessions:read', q.clientId);
  const byTrainer = q.trainerId
    ? sql`${clients.id} IN (SELECT client_id FROM trainer_client_assignments WHERE trainer_id = ${q.trainerId} AND ended_at IS NULL)`
    : undefined;
  const clientFilter = q.clientId ? eq(clients.id, q.clientId) : undefined;
  const ranked = ctx.db
    .select({
      id: sessions.id,
      date: sessions.scheduledDate,
      time: sessions.scheduledTime,
      title: sessions.title,
      dayLabel: sessions.dayLabel,
      published: sessions.published,
      version: sessions.version,
      planId: sql<string>`${trainingPlans.id}`.as('plan_id'),
      planStatus: sql<string>`${trainingPlans.status}`.as('plan_status'),
      weekType: microcycles.weekType,
      attendance: sql<string | null>`${attendance.status}`.as('attendance_status'),
      clientId: sql<string>`${clients.id}`.as('client_id'),
      firstName: clients.firstName,
      lastName: clients.lastName,
      // Per-day rank and total: a month of a large centre returns a few sessions per day and the
      // number of the rest (Phase 14: 1 000 clients).
      rn: sql<number>`row_number() OVER (PARTITION BY ${sessions.scheduledDate} ORDER BY ${sessions.scheduledTime} NULLS FIRST, ${clients.lastName}, ${sessions.id})`.as(
        'rn',
      ),
      dayTotal: sql<number>`count(*) OVER (PARTITION BY ${sessions.scheduledDate})::int`.as(
        'day_total',
      ),
    })
    .from(sessions)
    .innerJoin(clients, eq(clients.id, sessions.clientId))
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
    .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
    .where(
      and(
        inArray(trainingPlans.status, ['active', 'completed']),
        gte(sessions.scheduledDate, q.from),
        lte(sessions.scheduledDate, q.to),
        clientFilter,
        byTrainer,
      ),
    )
    .as('cal');
  const [rankedRows, assessmentRows] = await Promise.all([
    ctx.db
      .select()
      .from(ranked)
      .where(q.perDay ? lte(ranked.rn, q.perDay) : undefined)
      .orderBy(asc(ranked.date), asc(ranked.rn)),
    ctx.db
      .select({
        id: assessments.id,
        date: assessments.assessedOn,
        status: assessments.status,
        battery: batteries.name,
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(assessments)
      .innerJoin(clients, eq(clients.id, assessments.clientId))
      .leftJoin(batteries, eq(batteries.id, assessments.batteryId))
      .where(
        and(
          ne(assessments.status, 'cancelled'),
          gte(assessments.assessedOn, q.from),
          lte(assessments.assessedOn, q.to),
          clientFilter,
          byTrainer,
        ),
      )
      .orderBy(asc(assessments.assessedOn)),
  ]);
  // Phases and rest weeks are only drawn for one client (with many clients they are noise).
  let spans: (Span & { planId: string })[] = [];
  if (q.clientId) {
    const weeks = await ctx.db
      .select({
        planId: trainingPlans.id,
        start: microcycles.startDate,
        weekType: microcycles.weekType,
        phaseName: phases.name,
      })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
      .where(
        and(
          eq(trainingPlans.clientId, q.clientId),
          inArray(trainingPlans.status, ['active', 'completed']),
          isNotNull(microcycles.startDate),
          lte(microcycles.startDate, q.to),
          gte(microcycles.startDate, addDays(q.from, -6)),
        ),
      );
    const plans = [...new Set(weeks.map((w) => w.planId))];
    spans = plans.flatMap((planId) =>
      planSpans(
        weeks
          .filter((w) => w.planId === planId)
          .map((w) => ({ start: w.start!, weekType: w.weekType, phaseName: w.phaseName })),
      ).map((s) => ({ ...s, planId })),
    );
  }
  return {
    from: q.from,
    to: q.to,
    today: localDate(ctx.now()),
    sessions: rankedRows.map(({ rn: _rn, dayTotal: _t, ...r }) => ({
      ...r,
      planStatus: r.planStatus as (typeof trainingPlans.$inferSelect)['status'],
      attendance: r.attendance as (typeof attendance.$inferSelect)['status'] | null,
      date: r.date!,
      title: r.title ?? `Sesión ${r.dayLabel}`,
    })),
    /** Sessions per day before the per-day limit. */
    sessionTotals: Object.fromEntries(rankedRows.map((r) => [r.date!, Number(r.dayTotal)])),
    assessments: assessmentRows,
    spans,
  };
}
export type CalendarData = Awaited<ReturnType<typeof calendarEvents_>>;

// ── Trainer dashboard extras ──────────────────────────────────────────────────

/** Upcoming/overdue assessments and recent client feedback (§8.2). */
async function trainerDashboard_(ctx: RequestContext) {
  requirePermission(ctx, 'sessions:review');
  const today = localDate(ctx.now());
  const [pending, recent, active] = await Promise.all([
    ctx.db
      .select({
        id: assessments.id,
        date: assessments.assessedOn,
        status: assessments.status,
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(assessments)
      .innerJoin(clients, eq(clients.id, assessments.clientId))
      .where(
        and(
          inArray(assessments.status, ['planned', 'in_progress']),
          lte(assessments.assessedOn, addDays(today, 7)),
        ),
      )
      .orderBy(asc(assessments.assessedOn))
      .limit(20),
    ctx.db
      .select({
        sessionId: feedback.sessionId,
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        sessionRpe: feedback.sessionRpe,
        comment: feedback.comment,
        date: attendance.performedDate,
        status: attendance.status,
        title: sessions.title,
      })
      .from(feedback)
      .innerJoin(clients, eq(clients.id, feedback.clientId))
      .innerJoin(sessions, eq(sessions.id, feedback.sessionId))
      .leftJoin(attendance, eq(attendance.sessionId, feedback.sessionId))
      .where(gte(feedback.updatedAt, new Date(ctx.now().getTime() - 7 * 86_400_000)))
      .orderBy(desc(feedback.updatedAt))
      .limit(8),
    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(eq(clients.status, 'active')),
  ]);
  return {
    today,
    activeClients: active[0]?.count ?? 0,
    pendingAssessments: pending.map((a) => ({ ...a, overdue: a.date < today })),
    recentFeedback: recent.map((r) => ({ ...r, sessionRpe: n(r.sessionRpe) })),
  };
}

// ── Client summary (staff, "Resumen" tab) ─────────────────────────────────────

async function clientSummary_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'monitoring:read', clientId);
  if (!isStaff(ctx)) throw new DomainError('forbidden', 'No tienes permiso para esta acción.');
  const today = localDate(ctx.now());
  const [plan] = await ctx.db
    .select({ id: trainingPlans.id, name: trainingPlans.name, startDate: trainingPlans.startDate })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.clientId, clientId), eq(trainingPlans.status, 'active')))
    .limit(1);
  let current: { phase: string; weekIndex: number; weekType: string; totalWeeks: number } | null =
    null;
  if (plan) {
    const weeks = await ctx.db
      .select({
        weekIndex: microcycles.weekIndex,
        start: microcycles.startDate,
        weekType: microcycles.weekType,
        phase: phases.name,
      })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, plan.id))
      .orderBy(asc(microcycles.weekIndex));
    const w = weeks.find((x) => x.start && x.start <= today && addDays(x.start, 6) >= today);
    if (w)
      current = {
        phase: w.phase,
        weekIndex: w.weekIndex,
        weekType: w.weekType,
        totalWeeks: weeks.length,
      };
  }
  const [agenda, monitoring, progress] = await Promise.all([
    clientAgenda(ctx, clientId),
    clientMonitoring(ctx, clientId),
    clientAssessmentProgress(ctx, clientId),
  ]);
  const [c] = await ctx.db
    .select({ progressTestIds: clients.progressTestIds })
    .from(clients)
    .where(eq(clients.id, clientId));
  return {
    plan: plan ? { ...plan, current } : null,
    next: agenda.next,
    adherence28: monitoring.adherence28,
    alerts: {
      red: monitoring.alerts.filter((a) => a.severity === 'red').length,
      yellow: monitoring.alerts.filter((a) => a.severity === 'yellow').length,
      green: monitoring.alerts.filter((a) => a.severity === 'green').length,
      top: monitoring.alerts
        .slice(0, 3)
        .map((a) => ({ id: a.id, severity: a.severity, message: a.message })),
    },
    keyMetrics: keyMetrics(progress, c?.progressTestIds ?? []),
    lastSession: monitoring.recent.find((r) => r.status != null) ?? null,
  };
}

type Progress = Awaited<ReturnType<typeof clientAssessmentProgress>>;

/** Up to 5 series: the ones chosen for the client, otherwise the most recently measured. */
function keyMetrics(progress: Progress, chosen: string[]) {
  const series = progress.series.filter((s) => s.side === 'both' || s.side === 'left');
  const picked = chosen.length
    ? series.filter((s) => chosen.includes(s.test.id))
    : [...series].sort(
        (a, b) =>
          // Performance tests before body measurements, then the most recently measured.
          Number(a.test.category === 'body_composition') -
            Number(b.test.category === 'body_composition') ||
          (a.points.at(-1)!.on < b.points.at(-1)!.on ? 1 : -1),
      );
  return picked.slice(0, 5).map((s) => ({
    testId: s.test.id,
    name: s.side === 'both' ? s.test.name : `${s.test.name} (izq.)`,
    unit: s.test.unit,
    last: s.points.at(-1)!,
    points: s.points.length,
    verdict: s.overall?.verdict ?? null,
    label: s.overall?.label ?? null,
    trend: s.trend,
  }));
}

// ── Client dashboard (client app "Hoy" and "Progreso") ────────────────────────

async function clientDashboard_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'sessions:read', clientId);
  const today = localDate(ctx.now());
  const agenda = await clientAgenda(ctx, clientId, {
    from: addDays(today, -365),
    to: addDays(today, 56),
  });
  const own = !isStaff(ctx);
  // Preview of the next session: exercise and short prescription, in order.
  const preview = agenda.next
    ? await ctx.db
        .select({ se: sessionExercises, name: exercises.name })
        .from(sessionExercises)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .where(eq(sessionBlocks.sessionId, agenda.next.id))
        .orderBy(asc(sessionBlocks.position), asc(sessionExercises.position))
    : [];
  const past = agenda.sessions
    .filter((s) => s.published || s.attendance)
    .map((s) => ({ date: s.date!, status: s.attendance, id: s.id }));
  const streak = sessionStreak(past, today);
  const a28 = adherence(dueSessions(past, today), addDays(today, -27), today);
  const [c] = await ctx.db
    .select({ progressTestIds: clients.progressTestIds })
    .from(clients)
    .where(eq(clients.id, clientId));
  const visible = c?.progressTestIds ?? [];
  const progress = await clientAssessmentProgress(ctx, clientId);
  const improvements = progress.series
    .filter(
      (s) =>
        (!visible.length || visible.includes(s.test.id)) &&
        s.overall?.verdict === 'probable_improvement',
    )
    .map((s) => ({ testName: s.test.name, date: s.points.at(-1)!.on }));
  return {
    today,
    next: agenda.next
      ? {
          ...agenda.next,
          preview: preview.map((r) => ({
            name: r.name,
            // Compact for the client: volume and effort, without %1RM or rest (shown in the player).
            short: prescriptionShort(prescriptionOf(r.se))
              .split(' · ')
              .filter((p) => !/1RM|descanso|tempo/i.test(p))
              .join(' · '),
          })),
        }
      : null,
    nextAssessment:
      agenda.assessments.find((x) => x.date >= today && x.status !== 'completed') ?? null,
    streak,
    adherence28: a28,
    milestones: milestones({
      doneDates: past
        .filter((s) => s.status === 'completed' || s.status === 'partial')
        .map((s) => s.date),
      streak,
      improvements,
    }).slice(0, 6),
    visibleTestIds: visible,
    own,
  };
}
export type ClientDashboard = Awaited<ReturnType<typeof clientDashboard_>>;

/** The trainer chooses which tests the client sees in "Progreso" (§9.5). Empty = all. */
async function setProgressMetrics_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(progressMetricsSchema, input);
  await authorizeClient(ctx, 'assessments:write', clientId);
  const ids = [...new Set(d.testIds)];
  if (ids.length) {
    const ok = await ctx.db
      .select({ id: assessmentTests.id })
      .from(assessmentTests)
      .where(
        and(
          inArray(assessmentTests.id, ids),
          or(
            isNull(assessmentTests.organizationId),
            eq(assessmentTests.organizationId, ctx.actor.organizationId),
          ),
        ),
      );
    if (ok.length !== ids.length)
      throw new DomainError('validation', 'Test desconocido.', { testIds: ['unknown'] });
  }
  const [before] = await ctx.db
    .select({ ids: clients.progressTestIds })
    .from(clients)
    .where(eq(clients.id, clientId));
  await ctx.db.update(clients).set({ progressTestIds: ids }).where(eq(clients.id, clientId));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'client',
    entityId: clientId,
    clientId,
    changes: [{ field: 'progressTestIds', before: before?.ids ?? [], after: ids }],
  });
}

/** Active trainers (for the ADMIN calendar filter). */
async function calendarTrainers_(ctx: RequestContext) {
  requirePermission(ctx, 'sessions:read');
  if (!ctx.actor.roles.includes('ADMIN')) return [];
  return ctx.db
    .select({
      id: schema.trainers.id,
      firstName: schema.trainers.firstName,
      lastName: schema.trainers.lastName,
    })
    .from(schema.trainers)
    .where(
      and(
        eq(schema.trainers.organizationId, ctx.actor.organizationId),
        eq(schema.trainers.active, true),
      ),
    )
    .orderBy(asc(schema.trainers.lastName));
}

// Use cases run under Row Level Security (see rls.ts).
export const calendarEvents = secured(calendarEvents_);
export const calendarTrainers = secured(calendarTrainers_);
export const trainerDashboard = secured(trainerDashboard_);
export const clientSummary = secured(clientSummary_);
export const clientDashboard = secured(clientDashboard_);
export const setProgressMetrics = secured(setProgressMetrics_);
