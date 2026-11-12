import 'server-only';
import { type ClientProgressVM, type ClientWeekVM } from '@/contracts/client';
import { canAccessClient, canReadResource, visibleAssessmentTestIds } from '@/domain/access';
import { addDays, startOfIsoWeek } from '@/domain/time';
import { sortSessions } from '@/domain/training/session';
import { weeklyVolume } from '@/domain/training/volume';
import { type ClientContext } from '../context';
import { loggedSets, logsBySession, toAssessmentSeries, toSessionCard } from './mappers';

async function loadSelf(ctx: ClientContext) {
  const client = await ctx.repos.clients.getById(ctx.actor.clientId);
  if (!client || !canAccessClient(ctx.actor, client)) {
    throw new Error('La sesión no corresponde a ningún cliente accesible.');
  }
  return client;
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
    const byId = new Map(sessions.map((s) => [s.id, s]));
    volume = weeklyVolume(
      logs.flatMap((log) => {
        const session = byId.get(log.sessionId);
        return session ? [{ date: log.date, sets: loggedSets(session, log) }] : [];
      }),
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
