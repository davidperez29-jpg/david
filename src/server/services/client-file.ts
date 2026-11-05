import 'server-only';
import {
  type ClientPlanVM,
  type ClientProfileVM,
  type ClientResultsVM,
  type ClientSessionsVM,
  type GoalVM,
  type TrainingLogEntryVM,
} from '@/contracts/trainer';
import { type AssessmentSeriesVM, type RehabCaseVM } from '@/contracts/shared';
import { defaultSharing } from '@/domain/access';
import { findAssessmentTest } from '@/domain/assessment';
import { formatNumber } from '@/domain/format';
import { GOAL_AREA_LABELS, GOAL_STATUS_LABELS } from '@/domain/goals';
import { addDays, startOfIsoWeek } from '@/domain/time';
import { formatLoad, formatSetsAndReps } from '@/domain/training/prescription';
import { weeklyVolume } from '@/domain/training/volume';
import { type TrainerContext } from '../context';
import { loadSessionVariants } from './library';
import {
  toAssessmentSeries,
  toPreview,
  toRehabCaseVM,
  toSessionCard,
  toSessionDetail,
} from './mappers';
import { ownClient, sessionsAndLogs, summarize } from './trainer-access';

/**
 * Casos de uso de la ficha del cliente, uno por pestaña. Todos empiezan comprobando que el
 * cliente pertenece al entrenador; si no, devuelven `null` (la página responde 404).
 */

export async function getClientProfile(
  ctx: TrainerContext,
  clientId: string,
): Promise<ClientProfileVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const [summary, sharing, rehab] = await Promise.all([
    summarize(ctx, client),
    ctx.repos.sharing.getForClient(client.id),
    ctx.repos.rehab.listByClient(client.id),
  ]);
  return {
    client: { ...summary, startedOn: client.startedOn },
    sharing: sharing ?? defaultSharing(client.id),
    hasActiveRehab: rehab.some((r) => r.status === 'active'),
  };
}

export async function getClientGoals(
  ctx: TrainerContext,
  clientId: string,
): Promise<GoalVM[] | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const [goals, results] = await Promise.all([
    ctx.repos.goals.listByClient(client.id),
    ctx.repos.assessments.listByClient(client.id),
  ]);
  const series = toAssessmentSeries(results);
  return goals.map((goal) => {
    const linked: AssessmentSeriesVM[] = series.filter((s) =>
      goal.linkedTestIds.includes(s.testId),
    );
    return {
      id: goal.id,
      title: goal.title,
      areaLabel: GOAL_AREA_LABELS[goal.area],
      status: goal.status,
      statusLabel: GOAL_STATUS_LABELS[goal.status],
      startedOn: goal.startedOn,
      targetDate: goal.targetDate ?? null,
      notes: goal.notes ?? null,
      linkedTests: linked,
      unlinkedTestNames: goal.linkedTestIds
        .filter((id) => !linked.some((s) => s.testId === id))
        .map((id) => findAssessmentTest(id)?.name ?? id),
    };
  });
}

export async function getClientPlan(
  ctx: TrainerContext,
  clientId: string,
): Promise<ClientPlanVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const weekStart = startOfIsoWeek(ctx.today);
  const { sessions, logs } = await sessionsAndLogs(ctx, client.id, {
    from: weekStart,
    to: addDays(ctx.today, 14),
  });
  const variants = await loadSessionVariants(
    ctx,
    sessions.flatMap((s) => s.exercises.map((rx) => rx.variantId)),
  );
  const next = sessions.find((s) => s.date >= ctx.today && !logs.get(s.id)?.completedAt) ?? null;
  const weekEnd = addDays(weekStart, 6);
  return {
    nextSession: next
      ? toSessionDetail(next, logs.get(next.id), variants.byId, variants.stepsOf, ctx.today)
      : null,
    weekStart,
    days: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    weekSessions: sessions
      .filter((s) => s.date <= weekEnd)
      .map((s) => ({
        ...toSessionCard(s, logs.get(s.id), ctx.today),
        preview: toPreview(s, variants.byId),
      })),
  };
}

export async function getClientSessions(
  ctx: TrainerContext,
  clientId: string,
): Promise<ClientSessionsVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const { sessions, logs } = await sessionsAndLogs(ctx, client.id, {
    from: addDays(ctx.today, -28),
    to: addDays(ctx.today, 14),
  });
  const cards = sessions.map((s) => toSessionCard(s, logs.get(s.id), ctx.today));
  return {
    upcoming: cards.filter((c) => c.date >= ctx.today),
    past: cards.filter((c) => c.date < ctx.today).reverse(),
  };
}

export async function getClientTrainingLog(
  ctx: TrainerContext,
  clientId: string,
): Promise<TrainingLogEntryVM[] | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const { sessions, logs } = await sessionsAndLogs(ctx, client.id, {
    from: addDays(ctx.today, -28),
    to: ctx.today,
  });
  const variants = await loadSessionVariants(
    ctx,
    sessions.flatMap((s) => s.exercises.map((rx) => rx.variantId)),
  );
  return sessions
    .filter((s) => logs.has(s.id))
    .reverse()
    .map((session) => {
      const log = logs.get(session.id)!;
      const card = toSessionCard(session, log, ctx.today);
      const detail = toSessionDetail(session, log, variants.byId, variants.stepsOf, ctx.today);
      return {
        sessionId: session.id,
        date: session.date,
        title: session.title,
        status: card.status,
        completedSets: card.completedSets,
        plannedSets: card.plannedSets,
        perceivedEffort: log.perceivedEffort ?? null,
        comment: log.comment ?? null,
        exercises: session.exercises.map((rx) => {
          const item = detail.exercises.find((e) => e.prescriptionId === rx.id)!;
          const feedback = log.exerciseFeedback?.find((f) => f.prescriptionId === rx.id);
          return {
            prescriptionId: rx.id,
            slot: item.slot,
            name: item.name,
            prescribed: `${formatSetsAndReps(rx.sets, rx.reps)} · ${formatLoad(rx.load)}`,
            repUnit: item.repUnit,
            sets: log.sets
              .filter((set) => set.prescriptionId === rx.id)
              .map(({ setNumber, reps, loadKg, completed }) => ({
                setNumber,
                reps,
                loadKg,
                completed,
              })),
            feedback:
              feedback?.rir !== undefined
                ? `RIR real ${formatNumber(feedback.rir)}`
                : feedback?.rpe !== undefined
                  ? `RPE real ${formatNumber(feedback.rpe)}`
                  : null,
          };
        }),
      };
    });
}

export async function getClientEvaluations(
  ctx: TrainerContext,
  clientId: string,
): Promise<AssessmentSeriesVM[] | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  return toAssessmentSeries(await ctx.repos.assessments.listByClient(client.id));
}

export async function getClientResults(
  ctx: TrainerContext,
  clientId: string,
): Promise<ClientResultsVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const range = { from: startOfIsoWeek(addDays(ctx.today, -21)), to: ctx.today };
  const [{ sessions, logs }, results] = await Promise.all([
    sessionsAndLogs(ctx, client.id, range),
    ctx.repos.assessments.listByClient(client.id),
  ]);
  return {
    weeklyVolume: weeklyVolume(
      sessions.flatMap((s) => {
        const log = logs.get(s.id);
        return log ? [{ date: s.date, sets: log.sets }] : [];
      }),
      range,
    ),
    assessments: toAssessmentSeries(results),
  };
}

/** Datos de salud: solo el entrenador responsable. `undefined` = cliente no accesible. */
export async function getClientHealth(
  ctx: TrainerContext,
  clientId: string,
): Promise<{ rehab: RehabCaseVM | null } | null> {
  const client = await ownClient(ctx, clientId);
  if (!client) return null;
  const active = (await ctx.repos.rehab.listByClient(client.id)).find((r) => r.status === 'active');
  return { rehab: active ? toRehabCaseVM(active, client.displayName) : null };
}
