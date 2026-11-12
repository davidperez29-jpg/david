import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import {
  COMMAND_HTTP_STATUS,
  type ClientCommand,
  type CommandErrorCode,
  type CommandResponse,
  type ExecutionReviewVM,
  type ExecutionStateVM,
  type PerformedSetVM,
  type PlayerVM,
} from '@/contracts/execution';
import { canAccessClient, canLogExecution, canReadExecution } from '@/domain/access';
import { formatSeconds } from '@/domain/format';
import { issue, type Issue } from '@/domain/issues';
import { firstName, isSafeExternalUrl } from '@/domain/text';
import { describeEffort } from '@/domain/training/effort';
import {
  currentSetRefs,
  effectiveSetLogs,
  type SetLogV2,
  summarizeExecutionV2,
} from '@/domain/training/execution';
import { describeLoad } from '@/domain/training/load';
import { performedFieldsFor, performedSetIssues } from '@/domain/training/performance';
import { formatRepTarget, formatTempo } from '@/domain/training/prescription';
import { reviewExecution } from '@/domain/training/review';
import {
  canonicalJson,
  resolveSets,
  type SessionContent,
  type TrainingSession,
} from '@/domain/training/session-v2';
import { type ClientContext, type RequestContext } from '../context';
import {
  type CommandMeta,
  type ExecutionWriteResult,
  type Repositories,
} from '../repositories/ports';
import { loadSessionVariants } from './library';
import { slotOf } from './session-views';

/**
 * Ejecución de una sesión por el cliente (bloque 2; V1_SPEC §5.5–5.8 y §8.4, docs/EXECUTION.md).
 *
 * - El cliente del registro sale SIEMPRE del actor, nunca del cuerpo de la petición.
 * - Una sesión que no existe, no es suya o no está publicada responde `not_found`.
 * - La validación de lo realizado frente a lo prescrito es la del dominio; la idempotencia y lo
 *   que depende del estado guardado, la transacción del repositorio.
 */

const MESSAGES: Record<CommandErrorCode, string> = {
  bad_request: 'La petición no tiene la forma esperada.',
  not_found: 'La sesión no existe o no es tuya.',
  not_started: 'La sesión aún no se ha empezado.',
  already_started: 'La sesión ya estaba empezada.',
  closed: 'La sesión ya está terminada: no admite más cambios.',
  set_already_logged: 'Esa serie ya estaba registrada.',
  not_effective: 'Ese registro ya se había corregido: corrige el más reciente.',
  command_id_reused: 'Ese identificador de comando ya se usó con otro contenido.',
  unknown_version: 'Esa versión de la sesión no existe.',
  unknown_set_in_version: 'Esa serie no existe en la versión indicada.',
  confirmation_required: 'Quedan series sin registrar: confirma que terminas igualmente.',
  invalid: 'Hay datos fuera de rango o que no corresponden a lo prescrito.',
};

export interface CommandOutcome {
  status: number;
  body: CommandResponse;
}

const fail = (
  error: CommandErrorCode,
  extra: Partial<Extract<CommandResponse, { ok: false }>> = {},
): CommandOutcome => ({
  status: COMMAND_HTTP_STATUS[error],
  body: { ok: false, error, message: MESSAGES[error], ...extra },
});

async function loadSelf(ctx: ClientContext) {
  const client = await ctx.repos.clients.getById(ctx.actor.clientId);
  if (!client || !canAccessClient(ctx.actor, client)) {
    throw new Error('La petición no corresponde a ningún cliente accesible.');
  }
  return client;
}

export const toPerformedSetVM = (log: SetLogV2): PerformedSetVM => ({
  clientSetId: log.clientSetId,
  prescriptionId: log.prescriptionId,
  setNumber: log.setNumber,
  versionNumber: log.versionNumber,
  completed: log.completed,
  ...(log.reps !== undefined ? { reps: log.reps } : {}),
  ...(log.durationS !== undefined ? { durationS: log.durationS } : {}),
  ...(log.distanceM !== undefined ? { distanceM: log.distanceM } : {}),
  ...(log.load ? { load: log.load } : {}),
  ...(log.rir !== undefined ? { rir: log.rir } : {}),
  ...(log.rpe !== undefined ? { rpe: log.rpe } : {}),
  ...(log.note ? { note: log.note } : {}),
  performedAt: log.performedAt,
  clockAdjusted: log.clockAdjusted,
  ...(log.supersedes ? { supersedes: log.supersedes } : {}),
});

/** Estado de la ejecución de una sesión publicada (lo que el servidor confirma). */
export async function executionStateOf(
  repos: Repositories,
  session: TrainingSession,
  today: string,
  timeZone: string,
): Promise<ExecutionStateVM> {
  const [version, execution] = await Promise.all([
    repos.training.getVersion(session.id, session.currentVersion!),
    repos.training.getExecution(session.id),
  ]);
  if (!version) throw new Error(`Falta la versión vigente de la sesión ${session.id}.`);
  const summary = summarizeExecutionV2({
    plannedDate: session.plannedDate,
    content: version.content,
    log: execution?.log ?? null,
    setLogs: execution?.setLogs ?? [],
    today,
    timeZone,
  });
  const log = execution?.log;
  return {
    sessionId: session.id,
    currentVersion: version.number,
    startedVersion: log?.startedVersion ?? null,
    status: summary.status,
    startedAt: log?.startedAt ?? null,
    pausedAt: log?.pausedAt ?? null,
    finishedAt: log?.finishedAt ?? null,
    finishReason: log?.finishReason ?? null,
    comment: log?.comment ?? null,
    sets: effectiveSetLogs(execution?.setLogs ?? []).map(toPerformedSetVM),
    completedSets: summary.completedSets,
    plannedSets: summary.plannedSets,
  };
}

/** Sesión del cliente que puede ejecutar (propia y publicada), o `null`. */
async function ownPublished(ctx: ClientContext, sessionId: string) {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session) return null;
  const client = await loadSelf(ctx);
  return canLogExecution(ctx.actor, session, client) ? session : null;
}

const payloadHash = (sessionId: string, command: ClientCommand) =>
  createHash('sha256').update(canonicalJson({ sessionId, command }), 'utf8').digest('hex');

/** Aplica un comando del cliente. Devuelve el código HTTP y la respuesta tipada. */
export async function executeClientCommand(
  ctx: ClientContext,
  sessionId: string,
  command: ClientCommand,
  receivedAt: string = new Date().toISOString(),
): Promise<CommandOutcome> {
  const session = await ownPublished(ctx, sessionId);
  if (!session || session.currentVersion === null) return fail('not_found');
  const repos = ctx.repos;
  const state = () => executionStateOf(repos, session, ctx.today, ctx.timeZone);
  const meta: CommandMeta = {
    commandId: command.commandId,
    payloadHash: payloadHash(sessionId, command),
    sessionId,
    clientId: ctx.actor.clientId,
    receivedAt,
    device: command.device,
  };

  let result: ExecutionWriteResult;
  switch (command.type) {
    case 'start': {
      if (command.versionNumber > session.currentVersion) return fail('unknown_version');
      const version = await repos.training.getVersion(sessionId, command.versionNumber);
      if (!version) return fail('unknown_version');
      result = await repos.execution.start(meta, {
        logId: randomUUID(),
        startedVersion: version.number,
      });
      break;
    }
    case 'log_set': {
      const version = await repos.training.getVersion(sessionId, command.versionNumber);
      if (!version) return fail('unknown_version', { state: await state() });
      const item = version.content.items.find((i) => i.id === command.prescriptionId);
      const target = item ? resolveSets(item)[command.setNumber - 1] : undefined;
      if (!item || !target) return fail('unknown_set_in_version', { state: await state() });
      const issues = performedSetIssues(target, command);
      if (issues.length > 0) return fail('invalid', { issues });
      const fields = performedFieldsFor(target);
      result = await repos.execution.logSet(meta, {
        versionNumber: version.number,
        prescriptionId: item.id,
        variantId: item.variantId,
        setNumber: command.setNumber,
        completed: command.completed,
        reps: command.reps ?? null,
        durationS: command.durationS ?? null,
        distanceM: command.distanceM ?? null,
        load: command.completed ? (command.load ?? null) : null,
        rir: command.rir ?? null,
        rpe: command.rpe ?? null,
        rpeScale: fields.rpe,
        note: command.note ?? null,
        supersedes: command.supersedes,
      });
      break;
    }
    case 'pause':
      result = await repos.execution.pause(meta);
      break;
    case 'resume':
      result = await repos.execution.resume(meta);
      break;
    case 'finish': {
      const issues: Issue[] =
        command.comment && command.comment.length > 500
          ? [issue('comment', 'El comentario no puede superar 500 caracteres.')]
          : [];
      if (issues.length > 0) return fail('invalid', { issues });
      const version = (await repos.training.getVersion(sessionId, session.currentVersion))!;
      result = await repos.execution.finish(meta, {
        currentSets: currentSetRefs(version.content),
        confirmEndEarly: command.confirmEndEarly,
        comment: command.comment,
      });
      break;
    }
  }

  switch (result.result) {
    case 'applied':
    case 'already_applied':
      return { status: 200, body: { ok: true, result: result.result, state: await state() } };
    // Empezar una sesión ya empezada (por ejemplo, desde otro dispositivo): ya está como se pide.
    case 'already_started':
      return { status: 200, body: { ok: true, result: 'already_applied', state: await state() } };
    case 'set_already_logged':
    case 'not_effective':
      return fail(result.result, {
        state: await state(),
        ...(result.effective ? { effective: toPerformedSetVM(result.effective) } : {}),
      });
    case 'confirmation_required':
      return fail('confirmation_required', {
        state: await state(),
        pendingSets: result.pendingSets,
      });
    default:
      return fail(result.result, { state: await state() });
  }
}

/** Estado de la ejecución para el propio cliente (`GET …/estado`). */
export async function getClientExecutionState(
  ctx: ClientContext,
  sessionId: string,
): Promise<ExecutionStateVM | null> {
  const session = await ctx.repos.training.getSession(sessionId);
  if (!session) return null;
  const client = await loadSelf(ctx);
  if (!canReadExecution(ctx.actor, session, client) || session.currentVersion === null) return null;
  return executionStateOf(ctx.repos, session, ctx.today, ctx.timeZone);
}

/** Datos del reproductor: la versión vigente (sin nota privada) y el estado confirmado. */
export async function getPlayer(ctx: ClientContext, sessionId: string): Promise<PlayerVM | null> {
  const session = await ownPublished(ctx, sessionId);
  if (!session || session.currentVersion === null) return null;
  const [version, state, client] = await Promise.all([
    ctx.repos.training.getVersion(sessionId, session.currentVersion),
    executionStateOf(ctx.repos, session, ctx.today, ctx.timeZone),
    loadSelf(ctx),
  ]);
  if (!version) return null;
  const trainer = await ctx.repos.trainers.getById(client.trainerId);
  // ¿Hay otra sesión suya empezada y sin terminar? (la más reciente)
  let otherActive: PlayerVM['otherActive'] = null;
  let latest = '';
  for (const other of await ctx.repos.training.listSessions(client.id)) {
    if (other.id === sessionId || !canLogExecution(ctx.actor, other, client)) continue;
    const execution = await ctx.repos.training.getExecution(other.id);
    if (!execution || execution.log.finishedAt || execution.log.lastActivityAt <= latest) continue;
    const otherVersion = await ctx.repos.training.getVersion(other.id, other.currentVersion!);
    latest = execution.log.lastActivityAt;
    otherActive = {
      id: other.id,
      name: [otherVersion?.content.label, otherVersion?.content.title].filter(Boolean).join(' · '),
    };
  }
  const content = version.content;
  const variants = await loadSessionVariants(
    ctx,
    content.items.map((i) => i.variantId),
  );
  const ordered = [...content.items].sort((a, b) => a.order - b.order);
  return {
    sessionId,
    clientFirstName: firstName(client.displayName),
    trainerFirstName: firstName(trainer?.displayName ?? 'tu entrenador'),
    today: ctx.today,
    plannedDate: content.plannedDate,
    label: content.label ?? null,
    title: content.title,
    focus: content.focus,
    estimatedMinutes: content.estimatedMinutes ?? null,
    coachNote: content.coachNote ?? null,
    version: version.number,
    // Sin notas privadas: nunca salen hacia el cliente.
    otherActive,
    content: {
      ...content,
      items: content.items.map(({ privateNote: _privateNote, ...rest }) => rest),
    },
    state,
    items: ordered.map((item) => {
      const variant = variants.byId.get(item.variantId);
      const video = variant?.media.videoUrl;
      return {
        id: item.id,
        variantId: item.variantId,
        slot: slotOf(item, ordered),
        name: item.variantName ?? variant?.name ?? 'Ejercicio',
        silhouette: variant?.silhouette ?? 'squat',
        summary: variant?.description ?? '',
        steps: variant ? variants.stepsOf(variant) : [],
        cues: variant?.cues ?? [],
        videoUrl: video && isSafeExternalUrl(video) ? video : null,
        clientNote: item.clientNote ?? null,
        // La nota privada (item.privateNote) nunca sale hacia el cliente.
        sets: resolveSets(item).map(({ setNumber, ...target }) => ({
          setNumber,
          target,
          repsLabel: formatRepTarget(target.reps),
          loadLabel: describeLoad(target.load),
          effortLabel: describeEffort(target.effort),
          restLabel: target.restSeconds > 0 ? formatSeconds(target.restSeconds) : 'Sin descanso',
          tempoLabel: target.tempo ? formatTempo(target.tempo) : null,
          note: target.note ?? null,
        })),
      };
    }),
  };
}

/**
 * Revisión de lo prescrito frente a lo realizado de una sesión publicada (para el cliente en B2 y
 * para el entrenador en A7), o `null` si aún no se ha empezado o el actor no puede leerla.
 */
export async function reviewSessionExecution(
  ctx: RequestContext<Parameters<typeof canReadExecution>[0]>,
  session: TrainingSession,
  client: { id: string; trainerId: string },
): Promise<ExecutionReviewVM | null> {
  if (!canReadExecution(ctx.actor, session, client) || session.currentVersion === null) return null;
  const execution = await ctx.repos.training.getExecution(session.id);
  if (!execution) return null;
  const numbers = new Set([
    session.currentVersion,
    ...execution.setLogs.map((l) => l.versionNumber),
  ]);
  const versions = new Map<number, SessionContent>();
  for (const number of numbers) {
    const version = await ctx.repos.training.getVersion(session.id, number);
    if (version) versions.set(number, version.content);
  }
  const current = versions.get(session.currentVersion)!;
  const variants = await loadSessionVariants(
    ctx,
    [...versions.values()].flatMap((c) => c.items.map((i) => i.variantId)),
  );
  const summary = summarizeExecutionV2({
    plannedDate: session.plannedDate,
    content: current,
    log: execution.log,
    setLogs: execution.setLogs,
    today: ctx.today,
    timeZone: ctx.timeZone,
  });
  const log = execution.log;
  return reviewExecution({
    status: summary.status,
    currentVersion: session.currentVersion,
    versions,
    log: {
      startedVersion: log.startedVersion,
      startedAt: log.startedAt,
      ...(log.finishedAt ? { finishedAt: log.finishedAt } : {}),
      ...(log.finishReason ? { finishReason: log.finishReason } : {}),
      pausedSeconds: log.pausedSeconds,
      ...(log.comment ? { comment: log.comment } : {}),
    },
    setLogs: execution.setLogs,
    exercise: (variantId, fallbackName) => {
      const variant = variants.byId.get(variantId);
      return {
        name: fallbackName ?? variant?.name ?? 'Ejercicio',
        silhouette: variant?.silhouette ?? 'squat',
      };
    },
  });
}
