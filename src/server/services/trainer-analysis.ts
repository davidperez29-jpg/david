import 'server-only';
import {
  type AnalysisFilters,
  type ClientAnalysisVM,
  type DayExecutedSessionVM,
  type DayPlannedSessionVM,
  type ExecutionDayVM,
  type ExerciseEvolutionVM,
  MAGNITUDE_PARAM,
  PERIOD_PARAM,
  type RecentExecutionVM,
  type SessionAnalysisVM,
} from '@/contracts/analysis';
import { canAnalyzeClient, canAnalyzeSession } from '@/domain/access';
import { exerciseEvolution } from '@/domain/analysis/exercise';
import { analyzePeriod, type PeriodSession, resolvePeriod } from '@/domain/analysis/period';
import { type Perspective } from '@/domain/analysis/reference';
import { addExecutedVolumes } from '@/domain/analysis/session';
import { type ExerciseVariant } from '@/domain/library/exercise';
import { SYSTEM_TAXONOMY } from '@/domain/library/taxonomy';
import { firstName } from '@/domain/text';
import { addDays, isIsoDate, isoWeekKey, startOfIsoWeek } from '@/domain/time';
import { summarizeExecutionV2 } from '@/domain/training/execution';
import { type TrainerContext } from '../context';
import { analyzeStoredSession, executionsOn, type StartFacts } from './analysis-data';
import { visibleVariants } from './library';

/**
 * Análisis para el entrenador (B3.1 y B3.2, docs/BLOCK3_SPEC.md §9): A8, totales del día, panel,
 * A9 (cliente por periodos) y A10 (evolución de un ejercicio). Solo lectura. Los permisos se
 * aplican aquí con las políticas del dominio (`canAnalyzeSession`, `canAnalyzeClient`): sin
 * acceso, `null`, sin revelar si existe.
 */

const clockOf = (ctx: TrainerContext) => ({ today: ctx.today, timeZone: ctx.timeZone });

function namesOf(variants: readonly ExerciseVariant[]) {
  const byId = new Map(variants.map((v) => [v.id, v.name]));
  return (variantId: string, fallback?: string) => fallback ?? byId.get(variantId) ?? 'Ejercicio';
}

async function exerciseNames(ctx: TrainerContext) {
  return namesOf(await visibleVariants(ctx));
}

/** Una sesión analizable: publicada, de ese cliente y del entrenador que pregunta. */
async function analyzable(ctx: TrainerContext, clientId: string, sessionId: string) {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session || session.clientId !== clientId || session.currentVersion === null) return null;
  const client = await ctx.repos.clients.getById(session.clientId);
  if (!client || !canAnalyzeSession(ctx.actor, session, client)) return null;
  return { session, client, currentVersion: session.currentVersion };
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
  const analysis = (await analyzeStoredSession(ctx.repos, own.session, {
    perspective: input.perspective,
    clock: clockOf(ctx),
    facts: await ctx.repos.training.startVersionFacts(),
    names: await exerciseNames(ctx),
  }))!;
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

/** Totales del día de ejecución (y lo previsto ese día, aparte). */
export async function getExecutionDay(
  ctx: TrainerContext,
  input: { clientId: string; date: string },
): Promise<ExecutionDayVM | null> {
  if (!isIsoDate(input.date)) return null;
  const client = await ctx.repos.clients.getById(input.clientId);
  if (!client || !canAnalyzeClient(ctx.actor, client)) return null;
  const names = await exerciseNames(ctx);
  const facts = await ctx.repos.training.startVersionFacts();

  const executed: DayExecutedSessionVM[] = [];
  for (const row of await executionsOn(ctx.repos, client.id, input.date, input.date)) {
    const own = await analyzable(ctx, client.id, row.sessionId);
    if (!own) continue;
    const analysis = (await analyzeStoredSession(ctx.repos, own.session, {
      perspective: 'original',
      clock: clockOf(ctx),
      facts,
      names,
    }))!;
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
    for (const row of await executionsOn(ctx.repos, client.id, from, ctx.today)) {
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

// ── B3.2 · A9 y A10 ─────────────────────────────────────────────────────────

/** Un parámetro de texto no vacío de la URL (los formularios GET envían los campos vacíos). */
const param = (query: Record<string, string | string[] | undefined>, key: string) => {
  const value = query[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

/** Periodo de la URL; un valor desconocido se pasa tal cual para que se avise de que no es válido. */
function periodQuery(
  query: Record<string, string | string[] | undefined>,
  fallback: keyof typeof PERIOD_PARAM,
) {
  const raw = param(query, 'periodo') ?? fallback;
  return {
    kind: Object.hasOwn(PERIOD_PARAM, raw) ? PERIOD_PARAM[raw as keyof typeof PERIOD_PARAM] : raw,
    date: param(query, 'fecha'),
    from: param(query, 'desde'),
    to: param(query, 'hasta'),
  };
}

const intIn = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Filtros de A9 desde la URL. Lo que no es válido vuelve al valor por defecto. */
export function parseFilters(
  query: Record<string, string | string[] | undefined>,
): AnalysisFilters {
  const one = (key: string) => param(query, key);
  const m = intIn(one('m'), 1, 20, 5);
  const n = Math.min(intIn(one('n'), 1, 20, 3), m);
  const pattern = one('patron');
  const variant = one('ejercicio');
  const magnitude = one('magnitud');
  return {
    pattern: pattern && SYSTEM_TAXONOMY.patterns.some((p) => p.id === pattern) ? pattern : null,
    patternMode: one('patrones') === 'todos' ? 'all' : 'primary',
    variantId: variant && /^[\w.-]{1,80}$/.test(variant) ? variant : null,
    repeat: { n, m },
    sort: one('orden') === 'asc' ? 'asc' : 'desc',
    magnitude:
      magnitude && Object.hasOwn(MAGNITUDE_PARAM, magnitude)
        ? MAGNITUDE_PARAM[magnitude as keyof typeof MAGNITUDE_PARAM]
        : 'sets',
  };
}

const patternName = (id: string) => SYSTEM_TAXONOMY.patterns.find((p) => p.id === id)?.name ?? id;

/** Todas las sesiones publicadas del cliente, analizadas con la perspectiva y el filtro pedidos. */
async function clientSessions(
  ctx: TrainerContext,
  client: { id: string; trainerId: string },
  options: {
    perspective: Perspective;
    names: (variantId: string, fallback?: string) => string;
    facts: StartFacts;
    includeVariant?: (variantId: string) => boolean;
  },
): Promise<PeriodSession[]> {
  const out: PeriodSession[] = [];
  for (const session of await ctx.repos.training.listSessions(client.id)) {
    if (!canAnalyzeSession(ctx.actor, session, client)) continue;
    const analysis = await analyzeStoredSession(ctx.repos, session, {
      perspective: options.perspective,
      clock: clockOf(ctx),
      facts: options.facts,
      names: options.names,
      ...(options.includeVariant ? { includeVariant: options.includeVariant } : {}),
    });
    if (!analysis) continue;
    const current = (await ctx.repos.training.getVersion(session.id, session.currentVersion!))!;
    out.push({
      sessionId: session.id,
      title: current.content.title,
      label: current.content.label ?? null,
      analysis,
    });
  }
  return out;
}

/** A9 · Análisis del cliente por periodos. */
export async function getClientAnalysis(
  ctx: TrainerContext,
  input: {
    clientId: string;
    query: Record<string, string | string[] | undefined>;
    perspective: Perspective;
  },
): Promise<ClientAnalysisVM | null> {
  const client = await ctx.repos.clients.getById(input.clientId);
  if (!client || !canAnalyzeClient(ctx.actor, client)) return null;
  const { period, invalid } = resolvePeriod(periodQuery(input.query, '4-semanas'), ctx.today);
  const filters = parseFilters(input.query);
  const variants = await visibleVariants(ctx);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const names = namesOf(variants);
  const patternsOf = (variantId: string) => byId.get(variantId)?.patterns ?? null;
  const includeVariant =
    filters.pattern || filters.variantId
      ? (variantId: string) =>
          (!filters.variantId || variantId === filters.variantId) &&
          (!filters.pattern ||
            (patternsOf(variantId) ?? []).some(
              (p) =>
                p.id === filters.pattern && (filters.patternMode === 'all' || p.role === 'primary'),
            ))
      : undefined;
  const facts = await ctx.repos.training.startVersionFacts();
  const sessions = await clientSessions(ctx, client, {
    perspective: input.perspective,
    names,
    facts,
    ...(includeVariant ? { includeVariant } : {}),
  });
  const analysis = analyzePeriod({ period, sessions, patternsOf, repeat: filters.repeat });

  // Opciones de los filtros: los ejercicios y patrones que aparecen en las sesiones del cliente.
  const variantIds = new Set(sessions.flatMap((s) => s.analysis.exercises.map((e) => e.variantId)));
  if (filters.variantId) variantIds.add(filters.variantId);
  const patternIds = new Set(
    [...variantIds].flatMap((v) => (patternsOf(v) ?? []).map((p) => p.id)),
  );
  if (filters.pattern) patternIds.add(filters.pattern);
  const variantNames = Object.fromEntries([...variantIds].map((v) => [v, names(v)]));
  const patternNames = Object.fromEntries([...patternIds].map((p) => [p, patternName(p)]));
  return {
    clientId: client.id,
    clientFirstName: firstName(client.displayName),
    today: ctx.today,
    appTimeZone: ctx.timeZone,
    perspective: input.perspective,
    invalidPeriod: invalid,
    filters,
    options: {
      patterns: [...patternIds]
        .map((id) => ({ id, name: patternName(id) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      exercises: [...variantIds]
        .map((variantId) => ({ variantId, name: names(variantId) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    },
    names: { variants: variantNames, patterns: patternNames },
    analysis,
  };
}

/** A10 · Evolución de un ejercicio (por defecto, las últimas 12 semanas). */
export async function getExerciseEvolution(
  ctx: TrainerContext,
  input: {
    clientId: string;
    variantId: string;
    query: Record<string, string | string[] | undefined>;
    perspective: Perspective;
  },
): Promise<ExerciseEvolutionVM | null> {
  const client = await ctx.repos.clients.getById(input.clientId);
  if (!client || !canAnalyzeClient(ctx.actor, client)) return null;
  if (!/^[\w.-]{1,80}$/.test(input.variantId)) return null;
  const { period, invalid } = resolvePeriod(periodQuery(input.query, '12-semanas'), ctx.today);
  const names = await exerciseNames(ctx);
  const sessions = await clientSessions(ctx, client, {
    perspective: input.perspective,
    names,
    facts: await ctx.repos.training.startVersionFacts(),
    includeVariant: (v) => v === input.variantId,
  });
  const executed = sessions.filter(
    (s) =>
      s.analysis.executedOn !== null &&
      s.analysis.executedOn >= period.from &&
      s.analysis.executedOn <= period.to,
  );
  return {
    clientId: client.id,
    clientFirstName: firstName(client.displayName),
    variantId: input.variantId,
    name: names(input.variantId),
    today: ctx.today,
    appTimeZone: ctx.timeZone,
    perspective: input.perspective,
    period,
    invalidPeriod: invalid,
    evolution: exerciseEvolution({ variantId: input.variantId, sessions: executed }),
  };
}
