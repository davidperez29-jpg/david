import 'server-only';
import {
  type ClientSessionDetailVM,
  type ClientSessionLineVM,
  type ClientTodayVM,
} from '@/contracts/sessions';
import { canAccessClient, canViewSession } from '@/domain/access';
import { formatSetsAndReps } from '@/domain/training/prescription';
import { firstName } from '@/domain/text';
import { addDays, localDateOf, startOfIsoWeek } from '@/domain/time';
import { type SessionVersion, type TrainingSession } from '@/domain/training/session-v2';
import { type ClientContext } from '../context';
import { loadSessionVariants } from './library';
import { reviewSessionExecution } from './client-execution';
import { forClient, publishedState, toPrescriptionItems } from './session-views';

/**
 * Casos de uso del cliente sobre sus sesiones v2 (docs/V1_SPEC.md §3 B1 y B2).
 * Solo ve sus sesiones PUBLICADAS, en la versión vigente, sin la nota privada ni los borradores.
 */

async function loadSelf(ctx: ClientContext) {
  const client = await ctx.repos.clients.getById(ctx.actor.clientId);
  if (!client || !canAccessClient(ctx.actor, client)) {
    throw new Error('La sesión no corresponde a ningún cliente accesible.');
  }
  return client;
}

type Visible = {
  session: TrainingSession;
  version: SessionVersion;
  line: ClientSessionLineVM;
  lastActivityAt: string | null;
};

async function visibleSessions(ctx: ClientContext, range: { from: string; to: string }) {
  const client = await loadSelf(ctx);
  const sessions = (await ctx.repos.training.listSessions(client.id, range)).filter((s) =>
    canViewSession(ctx.actor, s, client),
  );
  const trainer = await ctx.repos.trainers.getById(client.trainerId);
  const visible = await Promise.all(
    sessions.map(async (session): Promise<Visible> => {
      const state = (await publishedState(ctx.repos, session, ctx.today, ctx.timeZone))!;
      const content = state.version.content;
      return {
        session,
        version: state.version,
        lastActivityAt: state.lastActivityAt,
        line: {
          id: session.id,
          plannedDate: content.plannedDate,
          dayOrder: content.dayOrder,
          label: content.label ?? null,
          title: content.title,
          focus: content.focus,
          estimatedMinutes: content.estimatedMinutes ?? null,
          exerciseCount: content.items.length,
          execution: state.summary,
          // «Actualizada por Alex»: cambió antes de que la empezaras.
          updatedBy:
            state.version.number > 1 && !state.execution
              ? firstName(trainer?.displayName ?? 'tu entrenador')
              : null,
        },
      };
    }),
  );
  return { client, visible };
}

const UNFINISHED = new Set(['overdue', 'interrupted', 'paused']);
const ACTIVE = new Set(['in_progress', 'paused', 'interrupted']);

/** B1 · Hoy: la sesión protagonista, las demás del día, lo pendiente de días anteriores y la semana. */
export async function getClientToday(ctx: ClientContext): Promise<ClientTodayVM> {
  const weekStart = startOfIsoWeek(ctx.today);
  const from = addDays(ctx.today, -7) < weekStart ? addDays(ctx.today, -7) : weekStart;
  const { client, visible } = await visibleSessions(ctx, { from, to: addDays(ctx.today, 60) });

  const todays = visible.filter((v) => v.line.plannedDate === ctx.today);
  // Protagonista 1 (aclaración del §3 B1): la que se está haciendo (actividad hoy) o la de hoy
  // interrumpida. Una interrumpida de otro día va a «De días anteriores», con «Continuar»: así el
  // entrenamiento del día sigue siendo lo primero.
  const active = visible
    .filter(
      (v) =>
        v.line.execution.status === 'in_progress' ||
        ((v.line.execution.status === 'interrupted' || v.line.execution.status === 'paused') &&
          (v.line.plannedDate === ctx.today ||
            (v.lastActivityAt !== null &&
              localDateOf(v.lastActivityAt, ctx.timeZone) === ctx.today))),
    )
    .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
  const hero =
    active[0] ??
    todays.find((v) => v.line.execution.status === 'planned') ??
    todays.find((v) => ['completed', 'partial'].includes(v.line.execution.status)) ??
    null;

  const { byId } = await loadSessionVariants(
    ctx,
    hero ? hero.version.content.items.map((i) => i.variantId) : [],
  );
  const weekEnd = addDays(weekStart, 6);
  const thisWeek = visible.filter(
    (v) => v.line.plannedDate >= weekStart && v.line.plannedDate <= weekEnd,
  );

  return {
    firstName: firstName(client.displayName),
    today: ctx.today,
    hero: hero
      ? {
          ...hero.line,
          action: ACTIVE.has(hero.line.execution.status)
            ? 'continue'
            : hero.line.execution.status === 'planned'
              ? 'start'
              : 'summary',
          coachNote: hero.version.content.coachNote ?? null,
          preview: [...hero.version.content.items]
            .sort((a, b) => a.order - b.order)
            .map((item) => ({
              name: item.variantName ?? byId.get(item.variantId)?.name ?? 'Ejercicio',
              silhouette: byId.get(item.variantId)?.silhouette ?? 'squat',
              setsAndReps: formatSetsAndReps(item.sets, item.defaults.reps),
            })),
        }
      : null,
    alsoToday: todays.filter((v) => v !== hero).map((v) => v.line),
    earlier: visible
      .filter(
        (v) =>
          v !== hero &&
          v.line.plannedDate < ctx.today &&
          v.line.plannedDate >= addDays(ctx.today, -7) &&
          UNFINISHED.has(v.line.execution.status),
      )
      .reverse()
      .slice(0, 3)
      .map((v) => v.line),
    next:
      todays.length === 0
        ? (visible.find((v) => v.line.plannedDate > ctx.today)?.line ?? null)
        : null,
    week: {
      planned: thisWeek.length,
      completed: thisWeek.filter((v) => v.line.execution.status === 'completed').length,
    },
  };
}

/** B2 · Detalle de una sesión publicada. `null` si no existe, no es suya o no está publicada. */
export async function getClientSessionDetail(
  ctx: ClientContext,
  sessionId: string,
): Promise<ClientSessionDetailVM | null> {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session) return null;
  const client = await loadSelf(ctx);
  if (!canViewSession(ctx.actor, session, client)) return null;
  const { visible } = await visibleSessions(ctx, {
    from: session.plannedDate,
    to: session.plannedDate,
  });
  const found = visible.find((v) => v.session.id === session.id);
  if (!found) return null;
  const { byId } = await loadSessionVariants(
    ctx,
    found.version.content.items.map((i) => i.variantId),
  );
  return {
    ...found.line,
    today: ctx.today,
    coachNote: found.version.content.coachNote ?? null,
    items: forClient(toPrescriptionItems(found.version.content, byId)),
    // Lo registrado frente a lo prescrito (B6), si ya se ha empezado.
    review: await reviewSessionExecution(ctx, session, client),
  };
}
