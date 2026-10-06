/**
 * Estimated strength per exercise (restructure phase 14), informative only: the best estimated
 * 1RM of each session (`estimateOneRm`, practical equation, sets of up to 10 repetitions to failure
 * with the RIR reported), the latest one and one from at least 3 weeks earlier to show the trend.
 * Never replaces a measured 1RM: %1RM prescriptions keep using the assessments.
 */
import { schema } from '@tp/db';
import { addDays, estimateOneRm, localDate } from '@tp/domain';
import { and, asc, eq, gt, gte, isNotNull } from 'drizzle-orm';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';

const { setLogs, sessions, exercises } = schema;

/** Days of history used, and the minimum gap between the latest and the earlier estimate. */
const WINDOW_DAYS = 120;
const TREND_GAP_DAYS = 21;

async function estimatedStrength_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'plans:read', clientId);
  requirePermission(ctx, 'decision:read');
  const since = addDays(localDate(ctx.now()), -WINDOW_DAYS);
  const rows = await ctx.db
    .select({
      exerciseId: setLogs.exerciseIdPerformed,
      name: exercises.name,
      sessionId: setLogs.sessionId,
      date: sessions.scheduledDate,
      reps: setLogs.reps,
      loadKg: setLogs.loadKg,
      rir: setLogs.rir,
    })
    .from(setLogs)
    .innerJoin(sessions, eq(sessions.id, setLogs.sessionId))
    .innerJoin(exercises, eq(exercises.id, setLogs.exerciseIdPerformed))
    .where(
      and(
        eq(setLogs.clientId, clientId),
        eq(setLogs.completed, true),
        eq(setLogs.rirAssumed, false),
        isNotNull(setLogs.rir),
        gt(setLogs.loadKg, '0'),
        gte(sessions.scheduledDate, since),
      ),
    )
    .orderBy(asc(sessions.scheduledDate));
  const byExercise = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.exerciseId || !r.date) continue;
    byExercise.set(r.exerciseId, [...(byExercise.get(r.exerciseId) ?? []), r]);
  }
  const out = [];
  for (const [exerciseId, list] of byExercise) {
    const perSession = [...new Set(list.map((r) => r.sessionId))].flatMap((sid) => {
      const sets = list.filter((r) => r.sessionId === sid);
      const e = estimateOneRm(
        sets.map((s) => ({ loadKg: Number(s.loadKg), reps: s.reps ?? 0, rir: s.rir })),
      );
      return e ? [{ date: sets[0]!.date!, ...e }] : [];
    });
    const latest = perSession.at(-1);
    if (!latest) continue;
    const earlier = perSession
      .filter((p) => p.date <= addDays(latest.date, -TREND_GAP_DAYS))
      .at(-1);
    out.push({
      exerciseId,
      name: list[0]!.name,
      sessions: perSession.length,
      latest,
      earlier: earlier ? { date: earlier.date, kg: earlier.kg } : null,
      changeKg: earlier ? Math.round((latest.kg - earlier.kg) * 2) / 2 : null,
    });
  }
  return { items: out.sort((a, b) => a.name.localeCompare(b.name, 'es')).slice(0, 30) };
}
export type EstimatedStrength = Awaited<ReturnType<typeof estimatedStrength_>>['items'][number];

export const estimatedStrength = secured(estimatedStrength_);
