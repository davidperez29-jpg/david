import { localDateOf } from '../time';
import { type EffortTargetV2 } from './effort';
import { effectiveSetLogs, type SessionLogV2, type SetLogV2 } from './execution';
import { describeLoad, type LoadSpec } from './load';
import {
  type EffortTarget,
  type ExercisePrescription,
  type LoadPrescription,
  type RepTarget,
} from './prescription';
import {
  canonicalJson,
  resolveSets,
  type SessionContent,
  type SessionItem,
  type TrainingSession,
} from './session-v2';
import {
  type ExerciseFeedback,
  type PlannedSession,
  type SessionLog,
  type SetRecord,
} from './session';

/**
 * Capa de compatibilidad (temporal, hasta V4): proyecta el modelo v2 al modelo de la Fase 1
 * (`PlannedSession` y `SessionLog`) para que las pantallas existentes sigan funcionando sin
 * reescribirse. También convierte la semilla de la Fase 1 al modelo v2 (`fromLegacySession`).
 */

// ── Fase 1 → v2 (semilla) ────────────────────────────────────────────────────

export function loadFromLegacy(load: LoadPrescription): LoadSpec {
  switch (load.kind) {
    case 'kg':
      return { kind: 'external', kg: load.kg, basis: 'total' };
    case 'bodyweight':
      return { kind: 'bodyweight' };
    case 'percent_1rm':
      // La Fase 1 no guardaba la referencia: la semilla no tiene ningún %1RM.
      throw new Error('La semilla no debe contener %1RM sin referencia.');
    case 'autoregulated':
      return { kind: 'self_selected' };
    case 'text':
      return { kind: 'other', text: load.text };
  }
}

export function effortFromLegacy(effort: EffortTarget): EffortTargetV2 {
  switch (effort.kind) {
    case 'rir':
      return { kind: 'rir', rir: effort.rir };
    case 'rpe':
      // Los datos demo describen la escala basada en RIR (DATA_MODEL.md §12).
      return { kind: 'rpe', rpe: effort.rpe, scale: 'rir_based' };
    case 'character':
      return { kind: 'character', performed: effort.performed, possible: effort.possible };
    case 'none':
      return { kind: 'none' };
  }
}

export function itemFromLegacy(rx: ExercisePrescription, variantName?: string): SessionItem {
  return {
    id: rx.id,
    variantId: rx.variantId,
    ...(variantName ? { variantName } : {}),
    order: rx.order,
    block: rx.block,
    blockMode: 'sequential',
    sets: rx.sets,
    defaults: {
      reps: rx.reps,
      load: loadFromLegacy(rx.load),
      effort: effortFromLegacy(rx.effort),
      restSeconds: rx.restSeconds,
      ...(rx.tempo ? { tempo: rx.tempo } : {}),
    },
    perSet: [],
    ...(rx.notes ? { clientNote: rx.notes } : {}),
  };
}

export function fromLegacySession(
  session: PlannedSession,
  variantName: (variantId: string) => string | undefined = () => undefined,
): SessionContent {
  return {
    schema: 1,
    plannedDate: session.date,
    dayOrder: session.dayOrder ?? 1,
    ...(session.label ? { label: session.label } : {}),
    title: session.title,
    focus: session.focus,
    estimatedMinutes: session.estimatedMinutes,
    ...(session.coachNote ? { coachNote: session.coachNote } : {}),
    items: session.exercises.map((rx) => itemFromLegacy(rx, variantName(rx.variantId))),
  };
}

// ── v2 → Fase 1 (pantallas existentes) ───────────────────────────────────────

export function loadToLegacy(load: LoadSpec): LoadPrescription {
  if (load.kind === 'external' && load.basis === 'total') return { kind: 'kg', kg: load.kg };
  if (load.kind === 'percent_1rm' && load.resolution) return { kind: 'kg', kg: load.resolution.kg };
  if (load.kind === 'bodyweight') return { kind: 'bodyweight' };
  if (load.kind === 'self_selected') return { kind: 'autoregulated' };
  if (load.kind === 'other') return { kind: 'text', text: load.text };
  return { kind: 'text', text: describeLoad(load) };
}

/** El modelo de la Fase 1 no admite rangos ni combinaciones: se proyectan como «sin escala». */
export function effortToLegacy(effort: EffortTargetV2): EffortTarget {
  if (effort.kind === 'rir' && typeof effort.rir === 'number')
    return { kind: 'rir', rir: effort.rir };
  if (effort.kind === 'rpe' && typeof effort.rpe === 'number')
    return { kind: 'rpe', rpe: effort.rpe };
  if (effort.kind === 'character') {
    return { kind: 'character', performed: effort.performed, possible: effort.possible };
  }
  return { kind: 'none' };
}

const same = <T>(values: readonly T[]) =>
  values.every((value) => canonicalJson(value) === canonicalJson(values[0]));

/** Objetivo de repeticiones de un ejercicio cuyas series pueden variar. */
function repsSummary(targets: readonly RepTarget[]): RepTarget {
  if (same(targets)) return targets[0]!;
  const reps = targets.flatMap((t) =>
    t.kind === 'fixed' ? [t.reps] : t.kind === 'range' ? [t.min, t.max] : [],
  );
  if (reps.length === 0) return targets[0]!;
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return min === max ? { kind: 'fixed', reps: min } : { kind: 'range', min, max };
}

export function itemToLegacy(item: SessionItem): ExercisePrescription {
  const sets = resolveSets(item);
  const loads = sets.map((s) => s.load);
  const efforts = sets.map((s) => s.effort);
  return {
    id: item.id,
    variantId: item.variantId,
    block: item.block,
    order: item.order,
    sets: item.sets,
    reps: repsSummary(sets.map((s) => s.reps)),
    load: same(loads) ? loadToLegacy(loads[0]!) : { kind: 'text', text: 'Variable por serie' },
    restSeconds: item.defaults.restSeconds,
    ...(item.defaults.tempo ? { tempo: item.defaults.tempo } : {}),
    effort: same(efforts) ? effortToLegacy(efforts[0]!) : { kind: 'none' },
    ...(item.clientNote ? { notes: item.clientNote } : {}),
  };
}

export function toLegacySession(
  session: Pick<TrainingSession, 'id' | 'clientId'>,
  content: SessionContent,
): PlannedSession {
  return {
    id: session.id,
    clientId: session.clientId,
    date: content.plannedDate,
    dayOrder: content.dayOrder,
    ...(content.label ? { label: content.label } : {}),
    title: content.title,
    focus: content.focus,
    estimatedMinutes: content.estimatedMinutes ?? 0,
    ...(content.coachNote ? { coachNote: content.coachNote } : {}),
    exercises: content.items.map(itemToLegacy),
  };
}

function performedKg(log: SetLogV2): number | null {
  return log.load?.kind === 'external' ? log.load.kg : null;
}

/**
 * Registro de la Fase 1 a partir de la ejecución v2:
 * - una entrada por serie efectiva (sin duplicados ni correcciones sustituidas);
 * - las series pendientes de la versión vigente, como «no completadas» (así las mostraba la
 *   Fase 1 en la pestaña Registro);
 * - el RIR o RPE «del ejercicio» de la Fase 1 sale del de cada serie cuando todas coinciden.
 */
export function toLegacyLog(
  session: PlannedSession,
  log: SessionLogV2,
  setLogs: readonly SetLogV2[],
): SessionLog {
  const effective = effectiveSetLogs(setLogs);
  const byKey = new Map(effective.map((s) => [`${s.prescriptionId}#${s.setNumber}`, s]));
  const sets: SetRecord[] = session.exercises.flatMap((rx) =>
    Array.from({ length: rx.sets }, (_, index) => {
      const found = byKey.get(`${rx.id}#${index + 1}`);
      return found
        ? {
            prescriptionId: rx.id,
            setNumber: index + 1,
            reps: found.reps ?? 0,
            loadKg: found.completed ? performedKg(found) : null,
            completed: found.completed,
          }
        : { prescriptionId: rx.id, setNumber: index + 1, reps: 0, loadKg: null, completed: false };
    }),
  );
  // Series registradas que ya no están en la versión vigente: siguen contando como realizadas.
  for (const extra of effective) {
    if (
      !sets.some(
        (s) => s.prescriptionId === extra.prescriptionId && s.setNumber === extra.setNumber,
      )
    ) {
      sets.push({
        prescriptionId: extra.prescriptionId,
        setNumber: extra.setNumber,
        reps: extra.reps ?? 0,
        loadKg: extra.completed ? performedKg(extra) : null,
        completed: extra.completed,
      });
    }
  }
  const feedback: ExerciseFeedback[] = session.exercises.flatMap((rx): ExerciseFeedback[] => {
    const done = effective.filter((s) => s.prescriptionId === rx.id && s.completed);
    const rirs = done.flatMap((s) => (s.rir !== undefined ? [s.rir] : []));
    const rpes = done.flatMap((s) => (s.rpe !== undefined ? [s.rpe] : []));
    if (rirs.length > 0 && rirs.length === done.length && same(rirs)) {
      return [{ prescriptionId: rx.id, rir: rirs[0]! }];
    }
    if (rpes.length > 0 && rpes.length === done.length && same(rpes)) {
      return [{ prescriptionId: rx.id, rpe: rpes[0]! }];
    }
    return [];
  });
  return {
    id: log.id,
    sessionId: log.sessionId,
    clientId: log.clientId,
    date: localDateOf(log.startedAt, log.startTimeZone),
    startedAt: log.startedAt,
    ...(log.finishedAt ? { finishedAt: log.finishedAt } : {}),
    sets,
    ...(log.perceivedEffort !== undefined ? { perceivedEffort: log.perceivedEffort } : {}),
    ...(feedback.length > 0 ? { exerciseFeedback: feedback } : {}),
    ...(log.comment ? { comment: log.comment } : {}),
  };
}
