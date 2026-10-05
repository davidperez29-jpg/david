/**
 * The Programa tab of a client (restructure phase 2, docs/UX_FLOW.md §2.2): the plan seen as
 * MES → SEMANA → SESIÓN. Opens on the active plan, the current week and the next session to do.
 */
import { programViewSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import { currentWeekId, localDate, monthsOf, weekMonth } from '@tp/domain';
import { inArray } from 'drizzle-orm';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';
import { getPlan, listClientPlans } from './planning';
import { secured } from './rls';
import { parse } from './validation';

const { attendance } = schema;

async function programView_(ctx: RequestContext, clientId: string, query: unknown = {}) {
  const q = parse(programViewSchema, query ?? {});
  await authorizeClient(ctx, 'plans:read', clientId);
  const today = localDate(ctx.now());
  const plans = await listClientPlans(ctx, clientId);
  const chosen =
    (q.plan ? plans.find((p) => p.id === q.plan) : undefined) ??
    plans.find((p) => p.status === 'active') ??
    plans.find((p) => p.status === 'draft') ??
    null;
  if (!chosen)
    return {
      plans,
      plan: null,
      months: [],
      weeks: [],
      selectedWeekId: null,
      sessions: [],
      selectedSessionId: null,
    };
  const detail = await getPlan(ctx, chosen.id);
  const nested = detail.phases.flatMap((ph) =>
    ph.mesocycles.flatMap((m) => m.weeks.map((w) => ({ w, phase: ph.name }))),
  );
  const ids = nested.flatMap(({ w }) => w.sessions.map((s) => s.id));
  const att = ids.length
    ? await ctx.db
        .select({ sessionId: attendance.sessionId, status: attendance.status })
        .from(attendance)
        .where(inArray(attendance.sessionId, ids))
    : [];
  const status = new Map(att.map((a) => [a.sessionId, a.status]));
  const weeks = nested.map(({ w, phase }) => {
    const start =
      w.startDate ??
      w.sessions
        .map((s) => s.scheduledDate)
        .filter((d): d is string => !!d)
        .sort()[0] ??
      null;
    return {
      id: w.id,
      weekIndex: w.weekIndex,
      weekType: w.weekType,
      start,
      month: start ? weekMonth(start) : '',
      phase,
      total: w.sessions.length,
      done: w.sessions.filter((s) => {
        const st = status.get(s.id);
        return st === 'completed' || st === 'partial';
      }).length,
    };
  });
  const currentId = currentWeekId(weeks, today);
  const selectedWeekId =
    (q.week && weeks.some((w) => w.id === q.week) ? q.week : null) ?? currentId;
  const week = nested.find(({ w }) => w.id === selectedWeekId)?.w;
  const sessions = (week?.sessions ?? []).map((s) => ({
    id: s.id,
    dayLabel: s.dayLabel,
    title: s.title,
    scheduledDate: s.scheduledDate,
    published: s.published,
    exercises: s.exercises,
    status: status.get(s.id) ?? null,
  }));
  const selectedSessionId =
    (q.session && sessions.some((s) => s.id === q.session) ? q.session : null) ??
    sessions.find((s) => !s.status && (s.scheduledDate ?? '9999') >= today)?.id ??
    sessions[0]?.id ??
    null;
  return {
    plans,
    plan: {
      id: chosen.id,
      name: chosen.name,
      status: chosen.status,
      startDate: chosen.startDate,
      weeks: weeks.length,
      sessionsPerWeek: chosen.sessionsPerWeek,
      currentWeekIndex: weeks.find((w) => w.id === currentId)?.weekIndex ?? null,
    },
    months: monthsOf(weeks).map((m) => ({ key: m.key, firstWeekId: m.weeks[0]!.id })),
    weeks: weeks.map((w) => ({ ...w, isCurrent: w.id === currentId })),
    selectedWeekId,
    sessions,
    selectedSessionId,
  };
}

export const programView = secured(programView_);
export type ProgramView = Awaited<ReturnType<typeof programView_>>;
