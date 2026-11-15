import 'server-only';
import {
  type DayExecutedSessionVM,
  type DayPlannedSessionVM,
  type ExecutionDayVM,
  type RecentExecutionVM,
  type SessionAnalysisVM,
} from '@/contracts/analysis';
import { canAnalyzeClient, canAnalyzeSession } from '@/domain/access';
import { type Perspective, startVersionObserved } from '@/domain/analysis/reference';
import { addExecutedVolumes, analyzeSession } from '@/domain/analysis/session';
import { firstName } from '@/domain/text';
import {
  addDays,
  type IsoDate,
  isIsoDate,
  isoWeekKey,
  localDateOf,
  startOfIsoWeek,
} from '@/domain/time';
import { summarizeExecutionV2 } from '@/domain/training/execution';
import { type TrainingSession } from '@/domain/training/session-v2';
import { type TrainerContext } from '../context';
import { visibleVariants } from './library';

/**
 * Análisis para el entrenador (B3.1, docs/BLOCK3_SPEC.md §9): A8, totales del día y el acceso
 * desde el panel. Solo lectura. Los permisos se aplican aquí con las políticas del dominio
 * (`canAnalyzeSession`, `canAnalyzeClient`): sin acceso, `null`, sin revelar si existe.
 */

const now = () => new Date().toISOString();

async function exerciseNames(ctx: TrainerContext) {
  const variants = new Map((await visibleVariants(ctx)).map((v) => [v.id, v.name]));
  return (variantId: string, fallback?: string) =>
    fallback ?? variants.get(variantId) ?? 'Ejercicio';
}

/** Una sesión analizable: publicada, de ese cliente y del entrenador que pregunta. */
async function analyzable(ctx: TrainerContext, clientId: string, sessionId: string) {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session || session.clientId !== clientId || session.currentVersion === null) return null;
  const client = await ctx.repos.clients.getById(session.clientId);
  if (!client || !canAnalyzeSession(ctx.actor, session, client)) return null;
  return { session, client, currentVersion: session.currentVersion };
}

async function analysisOf(
  ctx: TrainerContext,
  session: TrainingSession,
  currentVersion: number,
  perspective: Perspective,
  names: (variantId: string, fallback?: string) => string,
) {
  const [versions, execution, facts] = await Promise.all([
    ctx.repos.training.listVersions(session.id),
    ctx.repos.training.getExecution(session.id),
    ctx.repos.training.startVersionFacts(),
  ]);
  const startObserved = execution
    ? startVersionObserved({ startReceivedAt: execution.log.startReceivedAt, ...facts })
    : true;
  return analyzeSession({
    perspective,
    versions,
    currentVersion,
    execution,
    startObserved,
    today: ctx.today,
    timeZone: ctx.timeZone,
    now: now(),
    exerciseName: names,
  });
}

export const parsePerspective = (value: unknown): Perspective =>
  value === 'vigente' ? 'current' : 'original';

/** A8 · Análisis de una sesión. */
export async function getSessionAnalysis(
  ctx: TrainerContext,
  input: { clientId: string; sessionId: string; perspective: Perspective },
): Promise<SessionAnalysisVM | null> {
  const own = await analyzable(ctx, input.clientId, input.sessionId);
  if (!own) return null;
  const analysis = await analysisOf(
    ctx,
    own.session,
    own.currentVersion,
    input.perspective,
    await exerciseNames(ctx),
  );
  const current = (await ctx.repos.training.getVersion(own.session.id, own.currentVersion))!;
  return {
    sessionId: own.session.id,
    clientId: own.client.id,
    clientFirstName: firstName(own.client.displayName),
    title: current.content.title,
    label: current.content.label ?? null,
    focus: current.content.focus,
    dayOrder: current.content.dayOrder,
    appTimeZone: ctx.timeZone,
    perspective: input.perspective,
    analysis,
  };
}

/**
 * Ejecuciones de un cliente con fecha de ejecución entre `from` y `to` (fechas locales, en la
 * zona del móvil de cada inicio). Se pide un margen de dos días en UTC y se filtra después: las
 * zonas van de UTC−12 a UTC+14.
 */
async function executionsOn(ctx: TrainerContext, clientId: string, from: IsoDate, to: IsoDate) {
  const rows = await ctx.repos.training.listExecutionsStartedBetween(
    clientId,
    `${addDays(from, -2)}T00:00:00.000Z`,
    `${addDays(to, 3)}T00:00:00.000Z`,
  );
  return rows
    .map((r) => ({ ...r, executedOn: localDateOf(r.startedAt, r.startTimeZone) }))
    .filter((r) => r.executedOn >= from && r.executedOn <= to);
}

/** Totales del día de ejecución (y lo previsto ese día, aparte). */
export async function getExecutionDay(
  ctx: TrainerContext,
  input: { clientId: string; date: string },
): Promise<ExecutionDayVM | null> {
  if (!isIsoDate(input.date)) return null;
  const client = await ctx.repos.clients.getById(input.clientId);
  if (!client || !canAnalyzeClient(ctx.actor, client)) return null;
  const names = await exerciseNames(ctx);

  const executed: DayExecutedSessionVM[] = [];
  for (const row of await executionsOn(ctx, client.id, input.date, input.date)) {
    const own = await analyzable(ctx, client.id, row.sessionId);
    if (!own) continue;
    const analysis = await analysisOf(ctx, own.session, own.currentVersion, 'original', names);
    const current = (await ctx.repos.training.getVersion(own.session.id, own.currentVersion))!;
    executed.push({
      sessionId: own.session.id,
      title: current.content.title,
      label: current.content.label ?? null,
      plannedDate: analysis.plannedDate,
      daysFromPlanned: analysis.daysFromPlanned ?? 0,
      status: analysis.status,
      startedAt: row.startedAt,
      startTimeZone: row.startTimeZone,
      executed: analysis.executed,
    });
  }

  const planned: DayPlannedSessionVM[] = [];
  const sessions = await ctx.repos.training.listSessions(client.id, {
    from: input.date,
    to: input.date,
  });
  for (const session of sessions) {
    if (session.status !== 'published' || session.currentVersion === null) continue;
    if (!canAnalyzeSession(ctx.actor, session, client)) continue;
    const [version, execution] = await Promise.all([
      ctx.repos.training.getVersion(session.id, session.currentVersion),
      ctx.repos.training.getExecution(session.id),
    ]);
    if (!version) continue;
    const summary = summarizeExecutionV2({
      plannedDate: version.content.plannedDate,
      content: version.content,
      log: execution?.log ?? null,
      setLogs: execution?.setLogs ?? [],
      today: ctx.today,
      timeZone: ctx.timeZone,
    });
    planned.push({
      sessionId: session.id,
      title: version.content.title,
      label: version.content.label ?? null,
      dayOrder: version.content.dayOrder,
      status: summary.status,
      executedOn: summary.executedOn,
      daysFromPlanned: summary.daysFromPlanned,
    });
  }

  const week = startOfIsoWeek(input.date);
  return {
    clientId: client.id,
    clientFirstName: firstName(client.displayName),
    date: input.date,
    week: { key: isoWeekKey(input.date), start: week, end: addDays(week, 6) },
    executed,
    totals: addExecutedVolumes(executed.map((s) => s.executed)),
    planned: planned.sort((a, b) => a.dayOrder - b.dayOrder),
  };
}

/** Panel (A1): sesiones empezadas en los últimos 7 días (fecha de ejecución), las más recientes primero. */
export async function listRecentExecutions(ctx: TrainerContext): Promise<RecentExecutionVM[]> {
  const clients = await ctx.repos.clients.listByTrainer(ctx.actor.trainerId);
  const from = addDays(ctx.today, -6);
  const out: RecentExecutionVM[] = [];
  for (const client of clients) {
    if (!canAnalyzeClient(ctx.actor, client)) continue;
    for (const row of await executionsOn(ctx, client.id, from, ctx.today)) {
      const own = await analyzable(ctx, client.id, row.sessionId);
      if (!own) continue;
      const [version, execution] = await Promise.all([
        ctx.repos.training.getVersion(own.session.id, own.currentVersion),
        ctx.repos.training.getExecution(own.session.id),
      ]);
      if (!version || !execution) continue;
      const summary = summarizeExecutionV2({
        plannedDate: version.content.plannedDate,
        content: version.content,
        log: execution.log,
        setLogs: execution.setLogs,
        today: ctx.today,
        timeZone: ctx.timeZone,
      });
      out.push({
        clientId: client.id,
        clientName: client.displayName,
        sessionId: own.session.id,
        title: version.content.title,
        label: version.content.label ?? null,
        executedOn: row.executedOn,
        startedAt: row.startedAt,
        status: summary.status,
      });
    }
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
