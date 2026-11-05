import 'server-only';
import {
  type AssessmentsOverviewVM,
  type ClientSummaryVM,
  type LoadOverviewVM,
  type PlanningVM,
  type TrainerDashboardVM,
} from '@/contracts/trainer';
import { type RehabCaseVM } from '@/contracts/shared';
import {
  ASSESSMENT_CATALOG,
  ASSESSMENT_CATEGORY_LABELS,
  findAssessmentTest,
} from '@/domain/assessment';
import { formatNumber } from '@/domain/format';
import { FORMULA_REGISTRY } from '@/domain/formulas';
import { UNIT_SYMBOLS } from '@/domain/measurement';
import { initials } from '@/domain/text';
import { addDays, startOfIsoWeek } from '@/domain/time';
import { sessionStatus } from '@/domain/training/session';
import { VOLUME_FORMULAS, weeklyVolume } from '@/domain/training/volume';
import { type TrainerContext } from '../context';
import { loadSessionVariants } from './library';
import { toAssessmentSeries, toPreview, toRehabCaseVM, toSessionCard } from './mappers';
import { ownClients, sessionsAndLogs, summarize } from './trainer-access';

export async function listTrainerClients(ctx: TrainerContext): Promise<ClientSummaryVM[]> {
  const clients = await ownClients(ctx);
  const summaries = await Promise.all(clients.map((client) => summarize(ctx, client)));
  return summaries.sort(
    (a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name, 'es'),
  );
}

export async function getTrainerDashboard(ctx: TrainerContext): Promise<TrainerDashboardVM> {
  const [trainer, clients] = await Promise.all([
    ctx.repos.trainers.getById(ctx.actor.trainerId),
    ownClients(ctx),
  ]);
  const active = clients.filter((client) => client.status === 'active');
  const weekStart = startOfIsoWeek(ctx.today);
  const week = { planned: 0, completed: 0, missed: 0 };
  const todaySessions: TrainerDashboardVM['todaySessions'] = [];
  const attention: TrainerDashboardVM['attention'] = [];
  const recentAssessments: TrainerDashboardVM['recentAssessments'] = [];
  let activeRehabCases = 0;

  for (const client of active) {
    // Desde el lunes de esta semana o hace 7 días (lo que sea antes) hasta el domingo.
    const lastSevenDays = addDays(ctx.today, -6);
    const { sessions, logs } = await sessionsAndLogs(ctx, client.id, {
      from: lastSevenDays < weekStart ? lastSevenDays : weekStart,
      to: addDays(weekStart, 6),
    });
    for (const session of sessions) {
      const status = sessionStatus(session, logs.get(session.id), ctx.today);
      if (session.date >= weekStart) {
        week.planned += 1;
        if (status === 'completed') week.completed += 1;
        if (status === 'missed') week.missed += 1;
      }
      if (session.date === ctx.today) {
        todaySessions.push({
          clientId: client.id,
          clientName: client.displayName,
          initials: initials(client.displayName),
          session: toSessionCard(session, logs.get(session.id), ctx.today),
        });
      }
    }
    const missedLast7 = sessions.filter(
      (s) =>
        s.date >= addDays(ctx.today, -6) &&
        sessionStatus(s, logs.get(s.id), ctx.today) === 'missed',
    ).length;
    if (missedLast7 > 0) {
      attention.push({
        clientId: client.id,
        clientName: client.displayName,
        reason: `${missedLast7} ${missedLast7 === 1 ? 'sesión no realizada' : 'sesiones no realizadas'} en los últimos 7 días`,
      });
    }

    const rehab = await ctx.repos.rehab.listByClient(client.id);
    activeRehabCases += rehab.filter((r) => r.status === 'active').length;

    for (const result of await ctx.repos.assessments.listByClient(client.id)) {
      if (result.date < addDays(ctx.today, -14)) continue;
      recentAssessments.push({
        clientId: client.id,
        clientName: client.displayName,
        testName: findAssessmentTest(result.testId)?.name ?? result.testId,
        date: result.date,
        valueLabel: `${formatNumber(result.measurement.value, 2)} ${UNIT_SYMBOLS[result.measurement.unit]}`,
        origin: result.measurement.provenance.origin,
      });
    }
  }

  return {
    trainerName: trainer?.displayName ?? 'Entrenador',
    today: ctx.today,
    activeClients: active.length,
    pausedClients: clients.length - active.length,
    todaySessions,
    week,
    activeRehabCases,
    recentAssessments: recentAssessments.sort((a, b) => b.date.localeCompare(a.date)),
    attention,
  };
}

export async function getPlanningOverview(ctx: TrainerContext): Promise<PlanningVM> {
  const weekStart = startOfIsoWeek(ctx.today);
  const range = { from: weekStart, to: addDays(weekStart, 6) };
  const clients = await ownClients(ctx);

  const rows = await Promise.all(
    clients
      .filter((client) => client.status === 'active')
      .map(async (client) => {
        const { sessions, logs } = await sessionsAndLogs(ctx, client.id, range);
        const { byId } = await loadSessionVariants(
          ctx,
          sessions.flatMap((s) => s.exercises.map((rx) => rx.variantId)),
        );
        return {
          id: client.id,
          name: client.displayName,
          initials: initials(client.displayName),
          sessions: sessions.map((s) => ({
            ...toSessionCard(s, logs.get(s.id), ctx.today),
            preview: toPreview(s, byId),
          })),
        };
      }),
  );
  return {
    weekStart,
    days: Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    clients: rows,
  };
}

export async function getLoadOverview(ctx: TrainerContext): Promise<LoadOverviewVM> {
  const range = { from: startOfIsoWeek(addDays(ctx.today, -21)), to: ctx.today };
  const clients = (await ownClients(ctx)).filter((client) => client.status === 'active');
  const rows = await Promise.all(
    clients.map(async (client) => {
      const { sessions, logs } = await sessionsAndLogs(ctx, client.id, range);
      const entries = sessions.flatMap((s) => {
        const log = logs.get(s.id);
        return log ? [{ date: s.date, sets: log.sets }] : [];
      });
      return {
        id: client.id,
        name: client.displayName,
        initials: initials(client.displayName),
        weeks: weeklyVolume(entries, range),
      };
    }),
  );
  const ids = new Set<string>(Object.values(VOLUME_FORMULAS).map((ref) => ref.id));
  return { range, clients: rows, formulas: FORMULA_REGISTRY.filter((f) => ids.has(f.id)) };
}

export async function getAssessmentsOverview(ctx: TrainerContext): Promise<AssessmentsOverviewVM> {
  const clients = await ownClients(ctx);
  const byClient = await Promise.all(
    clients.map(async (client) => ({
      clientId: client.id,
      clientName: client.displayName,
      series: toAssessmentSeries(await ctx.repos.assessments.listByClient(client.id)),
    })),
  );
  return {
    catalog: ASSESSMENT_CATALOG.map((test) => ({
      id: test.id,
      name: test.name,
      category: test.category,
      categoryLabel: ASSESSMENT_CATEGORY_LABELS[test.category],
      outcomeName: test.outcome.name,
      unit: test.outcome.unit ? UNIT_SYMBOLS[test.outcome.unit] : null,
      status: test.status,
    })),
    byClient: byClient.filter((row) => row.series.length > 0),
  };
}

export async function getRehabOverview(ctx: TrainerContext): Promise<RehabCaseVM[]> {
  const clients = await ownClients(ctx);
  const cases = await Promise.all(
    clients.map(async (client) =>
      (await ctx.repos.rehab.listByClient(client.id))
        .filter((r) => r.status === 'active')
        .map((r) => toRehabCaseVM(r, client.displayName)),
    ),
  );
  return cases.flat();
}
