import 'server-only';
import { type ClientSummaryVM } from '@/contracts/trainer';
import { canAccessClient } from '@/domain/access';
import { type Client, POPULATION_LABELS } from '@/domain/people';
import { initials } from '@/domain/text';
import { addDays } from '@/domain/time';
import { sortSessions } from '@/domain/training/session';
import { type TrainerContext } from '../context';
import { type DateRange } from '../repositories/ports';
import { logsBySession } from './mappers';

/** Clientes del entrenador que hace la petición (nunca los de otro entrenador). */
export async function ownClients(ctx: TrainerContext): Promise<Client[]> {
  const clients = await ctx.repos.clients.listByTrainer(ctx.actor.trainerId);
  return clients.filter((client) => canAccessClient(ctx.actor, client));
}

/** Un cliente concreto, o `null` si no existe o pertenece a otro entrenador. */
export async function ownClient(ctx: TrainerContext, clientId: string): Promise<Client | null> {
  const client = await ctx.repos.clients.getById(clientId);
  return client && canAccessClient(ctx.actor, client) ? client : null;
}

export async function sessionsAndLogs(ctx: TrainerContext, clientId: string, range: DateRange) {
  const [sessions, logs] = await Promise.all([
    ctx.repos.sessions.listByClient(clientId, range),
    ctx.repos.logs.listByClient(clientId, range),
  ]);
  return { sessions: sortSessions(sessions), logs: logsBySession(logs) };
}

export async function summarize(ctx: TrainerContext, client: Client): Promise<ClientSummaryVM> {
  const { sessions, logs } = await sessionsAndLogs(ctx, client.id, {
    from: addDays(ctx.today, -6),
    to: addDays(ctx.today, 30),
  });
  const next = sessions.find((s) => s.date >= ctx.today && !logs.get(s.id)?.completedAt);
  const past = sessions.filter((s) => s.date <= ctx.today);
  return {
    id: client.id,
    name: client.displayName,
    initials: initials(client.displayName),
    status: client.status,
    populationLabel: POPULATION_LABELS[client.population],
    goal: client.goal,
    sport: client.sport ?? null,
    nextSession: next ? { date: next.date, title: next.title } : null,
    last7Days: {
      planned: past.length,
      completed: past.filter((s) => logs.get(s.id)?.completedAt).length,
    },
  };
}
