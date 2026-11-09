import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  type CreateSessionOutcome,
  type NewSessionFormVM,
  type NewSessionInput,
  type PublishedSessionVM,
  type PublishOutcome,
  type SaveDraftOutcome,
  type SessionBuilderVM,
  type SessionDayVM,
  type TrainerSessionRowVM,
  type TrainerSessionsVM,
} from '@/contracts/sessions';
import { canEditSession, canPlanForClient, canViewExercise } from '@/domain/access';
import { issue, type Issue } from '@/domain/issues';
import { normalizeForSearch, firstName } from '@/domain/text';
import { addDays, isIsoDate } from '@/domain/time';
import { effectiveSetLogs } from '@/domain/training/execution';
import {
  changeSummary,
  contentIssues,
  lockIssues,
  normalizeContent,
  publishIssues,
  sameContent,
  type SessionContent,
  type SessionVersion,
  type TrainingSession,
  type ValidationContext,
} from '@/domain/training/session-v2';
import { type TrainerContext } from '../context';
import { visibleVariants } from './library';
import { publishedState, toPrescriptionItems } from './session-views';
import { ownClient } from './trainer-access';

/**
 * Casos de uso del entrenador sobre las sesiones v2 (docs/V1_SPEC.md §3 A3–A7 y §5).
 * Cada uno comprueba los permisos con las políticas de `access.ts`. Lo que no es del entrenador
 * se trata como inexistente (`null` o `not_found`), sin revelar si existe.
 */

export const LABEL_SUGGESTIONS = ['Mañana', 'Tarde', 'Club', 'Recuperación'];
const SESSION_ID = /^[A-Za-z0-9-]{8,80}$/;

const now = () => new Date().toISOString();

/** La sesión y su cliente, si el entrenador puede editarla. */
async function ownSession(ctx: TrainerContext, sessionId: string) {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session) return null;
  const client = await ctx.repos.clients.getById(session.clientId);
  if (!client || !canEditSession(ctx.actor, session, client)) return null;
  return { session, client };
}

async function validationContext(ctx: TrainerContext) {
  const variants = await visibleVariants(ctx);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const context: ValidationContext = {
    isUsableVariant: (id) => {
      const variant = byId.get(id);
      return !!variant && canViewExercise(ctx.actor, variant);
    },
  };
  return { variants, byId, context };
}

/**
 * Comprobación de forma de un contenido que llega del navegador (no se confía en él): lo justo
 * para que las validaciones del dominio puedan ejecutarse sin fallar.
 */
function isContentShape(value: unknown): value is SessionContent {
  const c = value as SessionContent | null;
  return (
    !!c &&
    typeof c === 'object' &&
    c.schema === 1 &&
    typeof c.plannedDate === 'string' &&
    typeof c.dayOrder === 'number' &&
    typeof c.title === 'string' &&
    typeof c.focus === 'string' &&
    (c.label === undefined || typeof c.label === 'string') &&
    (c.coachNote === undefined || typeof c.coachNote === 'string') &&
    (c.estimatedMinutes === undefined || typeof c.estimatedMinutes === 'number') &&
    Array.isArray(c.items) &&
    c.items.every(
      (item) =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.variantId === 'string' &&
        typeof item.order === 'number' &&
        typeof item.block === 'string' &&
        item.blockMode === 'sequential' &&
        typeof item.sets === 'number' &&
        !!item.defaults &&
        typeof item.defaults === 'object' &&
        !!item.defaults.reps &&
        !!item.defaults.load &&
        !!item.defaults.effort &&
        typeof item.defaults.restSeconds === 'number' &&
        Array.isArray(item.perSet),
    )
  );
}

const SHAPE_ISSUE: Issue[] = [issue('content', 'El contenido de la sesión no es válido.')];

/** Copia el nombre de cada variante en el contenido (la versión no depende de la biblioteca). */
function withVariantNames(content: SessionContent, byId: Map<string, { name: string }>) {
  return normalizeContent({
    ...content,
    items: content.items.map((item) => ({
      ...item,
      variantName: byId.get(item.variantId)?.name ?? item.variantName,
    })),
  });
}

/** Orden al final del día: el siguiente al mayor de ese cliente y esa fecha. */
async function nextDayOrder(ctx: TrainerContext, clientId: string, date: string, except?: string) {
  const sameDay = await ctx.repos.training.listSessions(clientId, { from: date, to: date });
  return Math.max(0, ...sameDay.filter((s) => s.id !== except).map((s) => s.dayOrder)) + 1;
}

// ── A3 · Sesiones del cliente, por días ──────────────────────────────────────

export async function getTrainerSessions(
  ctx: TrainerContext,
  clientId: string,
): Promise<TrainerSessionsVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client || !canPlanForClient(ctx.actor, client)) return null;
  const from = addDays(ctx.today, -28);
  const sessions = (await ctx.repos.training.listSessions(client.id)).filter(
    (s) => s.plannedDate >= from && canEditSession(ctx.actor, s, client),
  );

  const rows = await Promise.all(
    sessions.map(
      async (
        session,
      ): Promise<[TrainingSession, Omit<TrainerSessionRowVM, 'canMoveUp' | 'canMoveDown'>]> => {
        const state = await publishedState(ctx.repos, session, ctx.today, ctx.timeZone);
        const content: SessionContent | null = state?.version.content ?? session.draft;
        return [
          session,
          {
            id: session.id,
            dayOrder: session.dayOrder,
            label: session.label ?? null,
            title: content?.title ?? 'Sesión',
            focus: content?.focus ?? '',
            exerciseCount: content?.items.length ?? 0,
            publication: session.status,
            version: session.currentVersion,
            hasUnpublishedChanges: session.status === 'published' && session.draft !== null,
            execution: state?.summary ?? null,
            canDelete: session.status === 'draft',
          },
        ];
      },
    ),
  );

  const days = new Map<
    string,
    [TrainingSession, Omit<TrainerSessionRowVM, 'canMoveUp' | 'canMoveDown'>][]
  >();
  for (const row of rows)
    days.set(row[0].plannedDate, [...(days.get(row[0].plannedDate) ?? []), row]);
  const grouped: SessionDayVM<TrainerSessionRowVM>[] = [...days.entries()].map(([date, list]) => ({
    date,
    sessions: list.map(([session, row], index) => {
      const movable = (other: TrainingSession | undefined) =>
        session.status === 'draft' && other?.status === 'draft';
      return {
        ...row,
        canMoveUp: movable(list[index - 1]?.[0]),
        canMoveDown: movable(list[index + 1]?.[0]),
      };
    }),
  }));

  return {
    clientId: client.id,
    clientName: client.displayName,
    clientFirstName: firstName(client.displayName),
    today: ctx.today,
    upcoming: grouped.filter((d) => d.date >= ctx.today),
    past: grouped.filter((d) => d.date < ctx.today).reverse(),
  };
}

// ── A4 · Nueva sesión ────────────────────────────────────────────────────────

export async function getNewSessionForm(
  ctx: TrainerContext,
  clientId: string,
  date?: string,
): Promise<NewSessionFormVM | null> {
  const client = await ownClient(ctx, clientId);
  if (!client || !canPlanForClient(ctx.actor, client)) return null;
  return {
    clientId: client.id,
    clientFirstName: firstName(client.displayName),
    sessionId: randomUUID(),
    defaultDate: date && isIsoDate(date) ? date : ctx.today,
    today: ctx.today,
    labelSuggestions: LABEL_SUGGESTIONS,
  };
}

/** Crear el borrador. Idempotente: reenviar el formulario (mismo identificador) no crea otro. */
export async function createSessionDraft(
  ctx: TrainerContext,
  input: NewSessionInput,
): Promise<CreateSessionOutcome> {
  const client = await ownClient(ctx, input.clientId);
  if (!client || !canPlanForClient(ctx.actor, client)) return { ok: false, reason: 'not_found' };
  if (!SESSION_ID.test(input.sessionId)) return { ok: false, reason: 'not_found' };

  const existing = await ownSession(ctx, input.sessionId);
  if (existing) {
    return existing.session.clientId === client.id
      ? { ok: true, sessionId: existing.session.id }
      : { ok: false, reason: 'not_found' };
  }
  if (await ctx.repos.training.getSession(input.sessionId)) {
    return { ok: false, reason: 'not_found' }; // De otro entrenador: no se revela.
  }

  const plannedDate = input.plannedDate.trim();
  const draft: SessionContent = normalizeContent({
    schema: 1,
    plannedDate,
    dayOrder: isIsoDate(plannedDate) ? await nextDayOrder(ctx, client.id, plannedDate) : 1,
    label: input.label,
    title: input.title,
    focus: input.focus,
    ...(input.estimatedMinutes !== null ? { estimatedMinutes: input.estimatedMinutes } : {}),
    items: [],
  });
  const { context } = await validationContext(ctx);
  const issues = contentIssues(draft, context);
  if (issues.length > 0) return { ok: false, reason: 'invalid', issues };

  const at = now();
  await ctx.repos.training.createDraft({
    id: input.sessionId,
    clientId: client.id,
    trainerId: ctx.actor.trainerId,
    plannedDate: draft.plannedDate,
    dayOrder: draft.dayOrder,
    ...(draft.label ? { label: draft.label } : {}),
    status: 'draft',
    currentVersion: null,
    draft,
    draftBaseVersion: null,
    draftRevision: 0,
    createdAt: at,
    updatedAt: at,
  });
  return { ok: true, sessionId: input.sessionId };
}

// ── A5 · Constructor (borrador que nunca se ha publicado) ────────────────────

export async function getSessionBuilder(
  ctx: TrainerContext,
  sessionId: string,
): Promise<SessionBuilderVM | null> {
  const own = await ownSession(ctx, sessionId);
  if (!own || own.session.status !== 'draft' || !own.session.draft) return null;
  const { variants } = await validationContext(ctx);
  return {
    sessionId: own.session.id,
    clientId: own.client.id,
    clientFirstName: firstName(own.client.displayName),
    today: ctx.today,
    revision: own.session.draftRevision,
    updatedAt: own.session.updatedAt,
    content: own.session.draft,
    variants: variants
      .map((v) => ({
        id: v.id,
        name: v.name,
        silhouette: v.silhouette,
        searchText: normalizeForSearch(v.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  };
}

/**
 * Guardar el borrador con la revisión esperada. Guardar dos veces lo mismo no da conflicto;
 * una revisión antigua con otro contenido, sí («Hay una versión más reciente»).
 */
export async function saveSessionDraft(
  ctx: TrainerContext,
  input: { sessionId: string; expectedRevision: number; content: unknown },
): Promise<SaveDraftOutcome> {
  const own = await ownSession(ctx, input.sessionId);
  if (!own) return { ok: false, reason: 'not_found' };
  if (own.session.status !== 'draft' || !own.session.draft) {
    return { ok: false, reason: 'not_editable' };
  }
  if (!isContentShape(input.content)) return { ok: false, reason: 'invalid', issues: SHAPE_ISSUE };
  const { byId, context } = await validationContext(ctx);
  let content = withVariantNames(input.content, byId);
  // Si cambia la fecha, la sesión pasa al final del nuevo día.
  const dayOrder =
    content.plannedDate === own.session.draft.plannedDate
      ? own.session.draft.dayOrder
      : isIsoDate(content.plannedDate)
        ? await nextDayOrder(ctx, own.client.id, content.plannedDate, own.session.id)
        : 1;
  content = { ...content, dayOrder };
  const issues = contentIssues(content, context);
  if (issues.length > 0) return { ok: false, reason: 'invalid', issues };

  const updatedAt = now();
  const result = await ctx.repos.training.saveDraft({
    sessionId: own.session.id,
    expectedRevision: input.expectedRevision,
    content,
    updatedAt,
  });
  switch (result.result) {
    case 'saved':
      return { ok: true, revision: result.revision, updatedAt, unchanged: false };
    case 'unchanged':
      return {
        ok: true,
        revision: result.revision,
        updatedAt: own.session.updatedAt,
        unchanged: true,
      };
    case 'conflict':
      return { ok: false, reason: 'conflict', revision: result.revision };
    case 'no_draft':
      return { ok: false, reason: 'not_editable' };
    case 'not_found':
      return { ok: false, reason: 'not_found' };
  }
}

/**
 * Publicar la versión 1: guarda lo pendiente, valida que la sesión está completa y publica.
 * Publicar dos veces (reintento) no crea dos versiones.
 */
export async function publishSession(
  ctx: TrainerContext,
  input: { sessionId: string; expectedRevision: number; content: unknown },
): Promise<PublishOutcome> {
  const own = await ownSession(ctx, input.sessionId);
  if (!own) return { ok: false, reason: 'not_found' };
  if (!isContentShape(input.content)) return { ok: false, reason: 'invalid', issues: SHAPE_ISSUE };
  const { byId, context } = await validationContext(ctx);

  if (own.session.status === 'published') {
    // ¿Reintento de una publicación ya hecha? (mismo contenido que la versión vigente)
    const content = { ...withVariantNames(input.content, byId), dayOrder: own.session.dayOrder };
    const retry = await ctx.repos.training.publish(publishInputFor(ctx, own.session, -1, content));
    return retry.result === 'already_published'
      ? { ok: true, version: retry.version.number, alreadyPublished: true }
      : { ok: false, reason: 'not_editable' };
  }

  const saved = await saveSessionDraft(ctx, input);
  if (!saved.ok) return saved;
  const stored = (await ctx.repos.training.getSession(own.session.id))!;
  const content = stored.draft!;
  const issues = publishIssues(content, context);
  if (issues.length > 0) return { ok: false, reason: 'invalid', issues };

  const result = await ctx.repos.training.publish(
    publishInputFor(ctx, stored, saved.revision, content),
  );
  switch (result.result) {
    case 'published':
    case 'already_published':
      return {
        ok: true,
        version: result.version.number,
        alreadyPublished: result.result === 'already_published',
      };
    case 'conflict':
      return { ok: false, reason: 'conflict', revision: result.revision };
    default:
      return { ok: false, reason: 'not_found' };
  }
}

function publishInputFor(
  ctx: TrainerContext,
  session: TrainingSession,
  expectedRevision: number,
  content: SessionContent,
  extra: Pick<SessionVersion, 'changes' | 'executionState'> & { reason?: string } = {
    changes: null,
    executionState: 'not_started',
  },
) {
  return {
    sessionId: session.id,
    expectedRevision,
    content,
    versionId: randomUUID(),
    publishedAt: now(),
    publishedBy: ctx.actor.trainerId,
    ...extra,
  };
}

/** Eliminar un borrador que nunca se ha publicado. */
export async function deleteSessionDraft(
  ctx: TrainerContext,
  sessionId: string,
): Promise<'deleted' | 'not_found' | 'not_deletable'> {
  const own = await ownSession(ctx, sessionId);
  if (!own) return 'not_found';
  return ctx.repos.training.deleteDraft(own.session.id);
}

/** Subir o bajar un borrador sin publicar dentro de su día (si el vecino también lo es). */
export async function reorderSessionDraft(
  ctx: TrainerContext,
  sessionId: string,
  direction: 'up' | 'down',
): Promise<'moved' | 'not_found' | 'not_allowed'> {
  const own = await ownSession(ctx, sessionId);
  if (!own) return 'not_found';
  const day = await ctx.repos.training.listSessions(own.client.id, {
    from: own.session.plannedDate,
    to: own.session.plannedDate,
  });
  const index = day.findIndex((s) => s.id === own.session.id);
  const neighbour = day[direction === 'up' ? index - 1 : index + 1];
  if (!neighbour || !canEditSession(ctx.actor, neighbour, own.client)) return 'not_allowed';
  const result = await ctx.repos.training.swapDraftOrder(own.session.id, neighbour.id, now());
  return result === 'swapped' ? 'moved' : 'not_allowed';
}

// ── A7 · Sesión publicada (pestaña Prescripción) ─────────────────────────────

export async function getPublishedSession(
  ctx: TrainerContext,
  sessionId: string,
): Promise<PublishedSessionVM | null> {
  const own = await ownSession(ctx, sessionId);
  if (!own) return null;
  const state = await publishedState(ctx.repos, own.session, ctx.today, ctx.timeZone);
  if (!state) return null;
  const { version } = state;
  const [{ byId }, author] = await Promise.all([
    validationContext(ctx),
    ctx.repos.trainers.getById(version.publishedBy),
  ]);
  const content = version.content;
  return {
    id: own.session.id,
    clientId: own.client.id,
    clientFirstName: firstName(own.client.displayName),
    plannedDate: content.plannedDate,
    dayOrder: content.dayOrder,
    label: content.label ?? null,
    title: content.title,
    focus: content.focus,
    estimatedMinutes: content.estimatedMinutes ?? null,
    coachNote: content.coachNote ?? null,
    version: {
      number: version.number,
      publishedAt: version.publishedAt,
      publishedBy: author?.displayName ?? 'Entrenador',
    },
    hasUnpublishedChanges: own.session.draft !== null,
    execution: state.summary,
    items: toPrescriptionItems(content, byId),
  };
}

// ── Versiones 2 y siguientes (solo servicio en el bloque 1; la interfaz llega en el bloque 5) ──

/** Abrir un borrador de cambios desde la versión vigente. */
export async function startSessionChange(ctx: TrainerContext, sessionId: string) {
  const own = await ownSession(ctx, sessionId);
  if (!own) return 'not_found' as const;
  return ctx.repos.training.startChangeDraft(own.session.id, now());
}

/**
 * Publicar la versión n + 1 de una sesión publicada (V1_SPEC §5.4): nunca cambia lo ya
 * registrado (bloqueos), guarda el resumen de cambios y el estado de la ejecución, y exige el
 * motivo si la sesión estaba terminada.
 */
export async function publishSessionChange(
  ctx: TrainerContext,
  input: { sessionId: string; expectedRevision: number; content: unknown; reason?: string },
): Promise<PublishOutcome> {
  const own = await ownSession(ctx, input.sessionId);
  if (!own) return { ok: false, reason: 'not_found' };
  const { session } = own;
  if (session.status !== 'published' || session.currentVersion === null || !session.draft) {
    return { ok: false, reason: 'not_editable' };
  }
  if (!isContentShape(input.content)) return { ok: false, reason: 'invalid', issues: SHAPE_ISSUE };
  const { byId, context } = await validationContext(ctx);
  const content = withVariantNames(input.content, byId);
  const [base, execution] = await Promise.all([
    ctx.repos.training.getVersion(session.id, session.currentVersion),
    ctx.repos.training.getExecution(session.id),
  ]);
  const logged = effectiveSetLogs(execution?.setLogs ?? []).map((log) => ({
    prescriptionId: log.prescriptionId,
    setNumber: log.setNumber,
  }));
  const executionState: SessionVersion['executionState'] = !execution
    ? 'not_started'
    : execution.log.finishedAt
      ? 'finished'
      : logged.length > 0
        ? 'in_progress'
        : 'started_no_sets';
  const issues = [
    ...publishIssues(content, context),
    ...lockIssues(base!.content, content, logged),
    ...(executionState === 'finished' && !input.reason?.trim()
      ? [issue('reason', 'La sesión está terminada: indica el motivo del cambio.')]
      : []),
  ];
  if (issues.length > 0) return { ok: false, reason: 'invalid', issues };
  if (sameContent(base!.content, content)) {
    return { ok: false, reason: 'invalid', issues: [issue('content', 'No hay cambios.')] };
  }

  const saved = await ctx.repos.training.saveDraft({
    sessionId: session.id,
    expectedRevision: input.expectedRevision,
    content,
    updatedAt: now(),
  });
  if (saved.result === 'conflict')
    return { ok: false, reason: 'conflict', revision: saved.revision };
  if (saved.result !== 'saved' && saved.result !== 'unchanged')
    return { ok: false, reason: 'not_found' };

  const result = await ctx.repos.training.publish(
    publishInputFor(ctx, session, saved.revision, content, {
      changes: changeSummary(base!.content, content),
      executionState,
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    }),
  );
  if (result.result === 'published' || result.result === 'already_published') {
    return {
      ok: true,
      version: result.version.number,
      alreadyPublished: result.result === 'already_published',
    };
  }
  return result.result === 'conflict'
    ? { ok: false, reason: 'conflict', revision: result.revision }
    : { ok: false, reason: 'not_found' };
}
