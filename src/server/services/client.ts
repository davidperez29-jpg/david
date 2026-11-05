import 'server-only';
import { type ClientHomeVM, type ClientProgressVM, type ClientWeekVM } from '@/contracts/client';
import { type SessionDetailVM } from '@/contracts/shared';
import { canAccessClient, canReadResource, visibleAssessmentTestIds } from '@/domain/access';
import { firstName } from '@/domain/text';
import { addDays, startOfIsoWeek } from '@/domain/time';
import { sortSessions } from '@/domain/training/session';
import { weeklyVolume } from '@/domain/training/volume';
import { type ClientContext } from '../context';
import { loadSessionVariants } from './library';
import {
  logsBySession,
  toAssessmentSeries,
  toPreview,
  toSessionCard,
  toSessionDetail,
} from './mappers';

async function loadSelf(ctx: ClientContext) {
  const client = await ctx.repos.clients.getById(ctx.actor.clientId);
  if (!client || !canAccessClient(ctx.actor, client)) {
    throw new Error('La sesión no corresponde a ningún cliente accesible.');
  }
  return client;
}

/** Pantalla principal del cliente: la sesión de hoy es la protagonista. */
export async function getClientHome(ctx: ClientContext): Promise<ClientHomeVM> {
  const client = await loadSelf(ctx);
  const weekStart = startOfIsoWeek(ctx.today);
  const range = { from: weekStart, to: addDays(ctx.today, 14) };
  const [sessions, logs] = await Promise.all([
    ctx.repos.sessions.listByClient(client.id, range),
    ctx.repos.logs.listByClient(client.id, range),
  ]);
  const logIndex = logsBySession(logs);
  const ordered = sortSessions(sessions);
  const todays = ordered.find((s) => s.date === ctx.today) ?? null;
  const next = ordered.find((s) => s.date > ctx.today) ?? null;
  const thisWeek = ordered.filter((s) => s.date <= addDays(weekStart, 6));
  const { byId: variants } = await loadSessionVariants(
    ctx,
    todays ? todays.exercises.map((rx) => rx.variantId) : [],
  );

  return {
    firstName: firstName(client.displayName),
    today: ctx.today,
    todaySession: todays
      ? {
          ...toSessionCard(todays, logIndex.get(todays.id), ctx.today),
          coachNote: todays.coachNote ?? null,
          preview: toPreview(todays, variants),
        }
      : null,
    nextSession: next ? toSessionCard(next, logIndex.get(next.id), ctx.today) : null,
    week: {
      planned: thisWeek.length,
      completed: thisWeek.filter((s) => logIndex.get(s.id)?.completedAt).length,
    },
  };
}

/** Detalle de una sesión. Devuelve `null` si no existe o no pertenece al cliente. */
export async function getClientSession(
  ctx: ClientContext,
  sessionId: string,
): Promise<SessionDetailVM | null> {
  const session = await ctx.repos.sessions.getById(sessionId);
  if (!session || session.clientId !== ctx.actor.clientId) return null;
  const client = await loadSelf(ctx);
  if (!canReadResource(ctx.actor, client, 'plan', null)) return null;

  const [logs, variants] = await Promise.all([
    ctx.repos.logs.listByClient(client.id, { from: session.date, to: session.date }),
    loadSessionVariants(
      ctx,
      session.exercises.map((rx) => rx.variantId),
    ),
  ]);
  return toSessionDetail(
    session,
    logsBySession(logs).get(session.id),
    variants.byId,
    variants.stepsOf,
    ctx.today,
  );
}

export async function getClientWeek(ctx: ClientContext): Promise<ClientWeekVM> {
  const client = await loadSelf(ctx);
  const weekStart = startOfIsoWeek(ctx.today);
  const range = { from: weekStart, to: addDays(weekStart, 6) };
  const [sessions, logs] = await Promise.all([
    ctx.repos.sessions.listByClient(client.id, range),
    ctx.repos.logs.listByClient(client.id, range),
  ]);
  const logIndex = logsBySession(logs);
  return {
    today: ctx.today,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        sessions: sortSessions(sessions.filter((s) => s.date === date)).map((s) =>
          toSessionCard(s, logIndex.get(s.id), ctx.today),
        ),
      };
    }),
  };
}

/** Progreso: solo lo que el entrenador ha decidido compartir. */
export async function getClientProgress(ctx: ClientContext): Promise<ClientProgressVM> {
  const client = await loadSelf(ctx);
  const sharing = await ctx.repos.sharing.getForClient(client.id);

  let volume: ClientProgressVM['volume'] = null;
  if (canReadResource(ctx.actor, client, 'volume', sharing)) {
    const range = { from: startOfIsoWeek(addDays(ctx.today, -21)), to: ctx.today };
    const [sessions, logs] = await Promise.all([
      ctx.repos.sessions.listByClient(client.id, range),
      ctx.repos.logs.listByClient(client.id, range),
    ]);
    const sessionIds = new Set(sessions.map((s) => s.id));
    volume = weeklyVolume(
      logs
        .filter((log) => sessionIds.has(log.sessionId))
        .map((log) => ({ date: log.date, sets: log.sets })),
      range,
    );
  }

  let assessments: ClientProgressVM['assessments'] = null;
  const visible = visibleAssessmentTestIds(ctx.actor, client, sharing);
  if (visible === 'all' || visible.size > 0) {
    const results = await ctx.repos.assessments.listByClient(client.id);
    assessments = toAssessmentSeries(
      results.filter((result) => visible === 'all' || visible.has(result.testId)),
    );
  }

  return { volume, assessments };
}
