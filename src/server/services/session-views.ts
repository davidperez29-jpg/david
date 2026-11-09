import 'server-only';
import { type ExecutionVM, type TrainerPrescriptionItemVM } from '@/contracts/sessions';
import { formatSeconds } from '@/domain/format';
import { type ExerciseVariant } from '@/domain/library/exercise';
import { type IsoDate } from '@/domain/time';
import { describeEffort } from '@/domain/training/effort';
import { summarizeExecutionV2 } from '@/domain/training/execution';
import { describeLoad } from '@/domain/training/load';
import { formatRepTarget, formatSetsAndReps, formatTempo } from '@/domain/training/prescription';
import {
  canonicalJson,
  resolveSets,
  type SessionContent,
  type SessionItem,
  type SetTarget,
  type TrainingSession,
} from '@/domain/training/session-v2';
import { type Repositories } from '../repositories/ports';

/** Conversión de la prescripción v2 a modelos de vista (entrenador y cliente). */

const setText = (set: SetTarget) =>
  [
    `${formatRepTarget(set.reps)} × ${describeLoad(set.load)}`,
    describeEffort(set.effort),
    set.restSeconds > 0 ? `descanso ${formatSeconds(set.restSeconds)}` : 'sin descanso',
  ]
    .filter(Boolean)
    .join(' · ');

/** Posición «A1, A2, B1…»: letra del bloque y lugar dentro de él. */
export function slotOf(item: SessionItem, items: readonly SessionItem[]): string {
  const position = items.filter(
    (other) => other.block === item.block && other.order <= item.order,
  ).length;
  return `${item.block}${position}`;
}

/**
 * Ejercicios de una versión. `privateNote` solo se incluye para el entrenador: los contratos del
 * cliente usan `PrescriptionItemVM`, que no la tiene, y el servicio del cliente la quita.
 */
export function toPrescriptionItems(
  content: SessionContent,
  variants: ReadonlyMap<string, ExerciseVariant>,
): TrainerPrescriptionItemVM[] {
  const items = [...content.items].sort((a, b) => a.order - b.order);
  return items.map((item) => {
    const variant = variants.get(item.variantId);
    const common = item.defaults;
    const exceptions = resolveSets(item).filter(
      (set) =>
        canonicalJson({ ...set, setNumber: 0 }) !== canonicalJson({ ...common, setNumber: 0 }),
    );
    return {
      id: item.id,
      slot: slotOf(item, items),
      name: item.variantName ?? variant?.name ?? 'Ejercicio',
      silhouette: variant?.silhouette ?? 'squat',
      sets: item.sets,
      setsAndReps: formatSetsAndReps(item.sets, common.reps),
      loadLabel: describeLoad(common.load),
      effortLabel: describeEffort(common.effort),
      restLabel: formatSeconds(common.restSeconds),
      tempoLabel: common.tempo ? formatTempo(common.tempo) : null,
      clientNote: item.clientNote ?? null,
      privateNote: item.privateNote ?? null,
      setExceptions: exceptions.map((set) => `Serie ${set.setNumber}: ${setText(set)}`),
    };
  });
}

/** Lo que el cliente puede ver de un ejercicio: sin la nota privada. */
export function forClient(items: TrainerPrescriptionItemVM[]) {
  return items.map(({ privateNote: _privateNote, ...item }) => item);
}

/** Versión vigente y ejecución de una sesión publicada. */
export async function publishedState(
  repos: Repositories,
  session: TrainingSession,
  today: IsoDate,
  timeZone: string,
) {
  if (session.status !== 'published' || session.currentVersion === null) return null;
  const [version, execution] = await Promise.all([
    repos.training.getVersion(session.id, session.currentVersion),
    repos.training.getExecution(session.id),
  ]);
  if (!version) throw new Error(`Falta la versión vigente de la sesión ${session.id}.`);
  const summary: ExecutionVM = summarizeExecutionV2({
    plannedDate: session.plannedDate,
    content: version.content,
    log: execution?.log ?? null,
    setLogs: execution?.setLogs ?? [],
    today,
    timeZone,
  });
  return { version, execution, summary, lastActivityAt: execution?.log.lastActivityAt ?? null };
}
