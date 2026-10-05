/**
 * Trainer home (restructure phase 1, docs/UX_FLOW.md §2.1): «Mis clientes» and «Entrenamientos de
 * hoy», nothing else. One row per client with what the trainer needs at a glance: profile and level,
 * next session, adherence of the last 4 weeks and a status dot (green: up to date · amber: something
 * to look at · red: review before progressing). What needs attention is shown in the client's row,
 * with its reason, instead of separate panels. Under RLS: only accessible clients appear.
 */
import { schema } from '@tp/db';
import { addDays, adherence, dueSessions, localDate } from '@tp/domain';
import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { listClients, needsReferralCondition } from './clients';
import type { RequestContext } from './context';
import { requirePermission } from './authz';
import { secured } from './rls';

const {
  alerts,
  attendance,
  clients,
  exerciseSubstitutions,
  mesocycles,
  microcycles,
  phases,
  sessions,
  setLogs,
  trainingPlans,
} = schema;

export type HomeStatus = 'ok' | 'look' | 'review';

/** Why a client's row is not green, most important first. */
export interface HomeAttention {
  status: 'look' | 'review';
  reason: 'alert' | 'referral' | 'session_review';
  text: string;
  /** Session to open (reason «session_review»). */
  sessionId?: string | null;
}

const RANK = { review: 0, look: 1, ok: 2 } as const;

async function trainerHome_(ctx: RequestContext, query: unknown = {}) {
  requirePermission(ctx, 'clients:read');
  requirePermission(ctx, 'alerts:manage');
  requirePermission(ctx, 'sessions:review');
  const today = localDate(ctx.now());
  const page = await listClients(ctx, query);
  const ids = page.items.map((c) => c.id);
  const none = Promise.resolve([]);

  const [planned, open, referral, substitutions, flagged] = await Promise.all([
    // Sessions of active plans from 27 days ago onwards (adherence window + upcoming).
    ids.length
      ? ctx.db
          .select({
            id: sessions.id,
            clientId: sessions.clientId,
            date: sessions.scheduledDate,
            title: sessions.title,
            dayLabel: sessions.dayLabel,
            published: sessions.published,
            status: attendance.status,
          })
          .from(sessions)
          .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
          .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
          .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
          .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
          .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
          .where(
            and(
              inArray(sessions.clientId, ids),
              inArray(trainingPlans.status, ['active', 'completed']),
              gte(sessions.scheduledDate, addDays(today, -27)),
              lte(sessions.scheduledDate, addDays(today, 60)),
            ),
          )
          .orderBy(asc(sessions.scheduledDate), asc(sessions.position))
      : none,
    // Live alerts that ask for a look (green ones are proposals, not problems).
    ids.length
      ? ctx.db
          .select({ clientId: alerts.clientId, severity: alerts.severity, message: alerts.message })
          .from(alerts)
          .where(
            and(
              inArray(alerts.clientId, ids),
              ne(alerts.status, 'resolved'),
              inArray(alerts.severity, ['red', 'yellow']),
            ),
          )
          .orderBy(asc(alerts.createdAt))
      : none,
    ids.length
      ? ctx.db
          .select({ id: clients.id })
          .from(clients)
          .where(and(inArray(clients.id, ids), needsReferralCondition))
      : none,
    ids.length
      ? ctx.db
          .select({
            clientId: exerciseSubstitutions.clientId,
            sessionId: exerciseSubstitutions.sessionId,
            reason: exerciseSubstitutions.reason,
          })
          .from(exerciseSubstitutions)
          .where(
            and(
              inArray(exerciseSubstitutions.clientId, ids),
              isNull(exerciseSubstitutions.decidedAt),
            ),
          )
      : none,
    ids.length
      ? ctx.db
          .selectDistinct({ clientId: setLogs.clientId, sessionId: setLogs.sessionId })
          .from(setLogs)
          .where(and(inArray(setLogs.clientId, ids), eq(setLogs.needsReview, true)))
      : none,
  ]);

  const byClient = <T extends { clientId: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      if (!r.clientId) continue;
      const list = m.get(r.clientId);
      if (list) list.push(r);
      else m.set(r.clientId, [r]);
    }
    return (id: string) => m.get(id) ?? [];
  };
  const plannedOf = byClient(planned);
  const alertsOf = byClient(open);
  const substitutionsOf = byClient(substitutions);
  const flaggedOf = byClient(flagged);
  const referred = new Set(referral.map((r) => r.id));

  const items = page.items
    .map((c) => {
      const mine = plannedOf(c.id).filter((s) => s.date);
      const counted = mine
        .filter((s) => s.published || s.status)
        .map((s) => ({ id: s.id, date: s.date!, status: s.status }));
      const a28 = adherence(dueSessions(counted, today), addDays(today, -27), today);
      const next = mine.find((s) => s.date! >= today && !s.status) ?? null;

      const attention: HomeAttention[] = [];
      for (const a of alertsOf(c.id).filter((x) => x.severity === 'red'))
        attention.push({ status: 'review', reason: 'alert', text: a.message });
      if (referred.has(c.id))
        attention.push({
          status: 'review',
          reason: 'referral',
          text: 'Requiere valoración por profesional sanitario',
        });
      for (const s of substitutionsOf(c.id))
        attention.push({
          status: s.reason === 'pain' ? 'review' : 'look',
          reason: 'session_review',
          text:
            s.reason === 'pain'
              ? 'Cambió un ejercicio por dolor: revisar la sesión'
              : 'Cambió un ejercicio: revisar la sesión',
          sessionId: s.sessionId,
        });
      for (const f of flaggedOf(c.id))
        attention.push({
          status: 'look',
          reason: 'session_review',
          text: 'Registro de series por revisar',
          sessionId: f.sessionId,
        });
      for (const a of alertsOf(c.id).filter((x) => x.severity === 'yellow'))
        attention.push({ status: 'look', reason: 'alert', text: a.message });
      attention.sort((x, y) => RANK[x.status] - RANK[y.status]);
      const status: HomeStatus = attention[0]?.status ?? 'ok';

      return {
        ...c,
        next: next
          ? {
              id: next.id,
              date: next.date!,
              title: next.title ?? next.dayLabel,
              published: next.published,
            }
          : null,
        adherence28: { done: a28.done, planned: a28.planned, percent: a28.percent },
        status,
        attention,
      };
    })
    // What needs attention first; otherwise the list keeps its alphabetical order.
    .map((c, i) => ({ c, i }))
    .sort((x, y) => RANK[x.c.status] - RANK[y.c.status] || x.i - y.i)
    .map(({ c }) => c);

  // Today's sessions of every accessible client (not only this page of the list).
  const todaySessions = await ctx.db
    .select({
      id: sessions.id,
      clientId: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      title: sessions.title,
      dayLabel: sessions.dayLabel,
      time: sessions.scheduledTime,
      published: sessions.published,
      status: attendance.status,
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
        eq(sessions.scheduledDate, today),
        eq(trainingPlans.status, 'active'),
        ne(clients.status, 'archived'),
        or(eq(sessions.published, true), sql`${attendance.id} IS NOT NULL`),
        isNull(clients.anonymizedAt),
      ),
    )
    .orderBy(asc(sessions.scheduledTime), asc(clients.lastName))
    .limit(50);

  return {
    today,
    clients: { ...page, items },
    todaySessions: todaySessions.map((s) => ({
      ...s,
      title: s.title ?? s.dayLabel,
      time: s.time?.slice(0, 5) ?? null,
    })),
  };
}

export const trainerHome = secured(trainerHome_);
export type TrainerHome = Awaited<ReturnType<typeof trainerHome_>>;
