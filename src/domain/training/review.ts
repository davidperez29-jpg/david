import { type Silhouette } from '../library/exercise';
import { type IsoDateTime } from '../time';
import { describeEffort } from './effort';
import { effectiveSetLogs, type ExecutionStatusV2, type SetLogV2 } from './execution';
import { describeLoad } from './load';
import { describePerformed, type PerformedSet, setDifferences } from './performance';
import { formatRepTarget, formatSetsAndReps } from './prescription';
import { resolveSets, type SessionContent, type SetTarget } from './session-v2';

/**
 * Prescrito frente a realizado (B6 del cliente y A7 del entrenador). Cada serie registrada se
 * compara con la versión con la que se registró; cada pendiente, con la vigente (V1_SPEC §5.4).
 * Solo descripciones y diferencias en lenguaje claro: sin tonelaje ni porcentajes.
 */

export interface ExecutionReviewSet {
  setNumber: number;
  versionNumber: number;
  prescribed: string;
  performed: string | null;
  status: 'done' | 'not_done' | 'pending';
  differences: string[];
  corrected: boolean;
  /** Lo que decía antes de cada corrección (el más reciente primero). */
  previous: string[];
  performedAt: IsoDateTime | null;
  clockAdjusted: boolean;
  note: string | null;
}

export interface ExecutionReviewItem {
  id: string;
  slot: string;
  name: string;
  silhouette: Silhouette;
  prescribed: string;
  doneSets: number;
  plannedSets: number;
  sets: ExecutionReviewSet[];
}

export interface ExecutionReview {
  status: ExecutionStatusV2;
  startedVersion: number | null;
  currentVersion: number;
  versionsUsed: number[];
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  finishReason: 'all_done' | 'ended_early' | null;
  /** De inicio a fin (si terminó) y la parte en pausa. */
  elapsedSeconds: number | null;
  pausedSeconds: number;
  completedSets: number;
  plannedSets: number;
  notDoneSets: number;
  pendingSets: number;
  comment: string | null;
  items: ExecutionReviewItem[];
  /** Series registradas con una versión en la que ya no están en la vigente (§5.4). */
  outsideCurrentVersion: { prescriptionId: string; setNumber: number; performed: string }[];
}

/** «10 × 16 kg · RIR 2 · descanso aparte». */
export function describeTarget(target: SetTarget): string {
  const load = describeLoad(target.load);
  return [
    load === 'Sin carga'
      ? formatRepTarget(target.reps)
      : `${formatRepTarget(target.reps)} × ${load}`,
    describeEffort(target.effort),
  ]
    .filter(Boolean)
    .join(' · ');
}

const asPerformed = (log: SetLogV2): PerformedSet => ({
  completed: log.completed,
  ...(log.reps !== undefined ? { reps: log.reps } : {}),
  ...(log.durationS !== undefined ? { durationS: log.durationS } : {}),
  ...(log.distanceM !== undefined ? { distanceM: log.distanceM } : {}),
  ...(log.load ? { load: log.load } : {}),
  ...(log.rir !== undefined ? { rir: log.rir } : {}),
  ...(log.rpe !== undefined ? { rpe: log.rpe } : {}),
});

const targetIn = (
  content: SessionContent | undefined,
  prescriptionId: string,
  setNumber: number,
) => {
  const item = content?.items.find((i) => i.id === prescriptionId);
  return item ? resolveSets(item).find((s) => s.setNumber === setNumber) : undefined;
};

export interface ReviewInput {
  status: ExecutionStatusV2;
  currentVersion: number;
  /** Contenido de cada versión que interviene (la vigente y las de las series registradas). */
  versions: ReadonlyMap<number, SessionContent>;
  log: {
    startedVersion: number;
    startedAt: IsoDateTime;
    finishedAt?: IsoDateTime;
    finishReason?: 'all_done' | 'ended_early';
    pausedSeconds: number;
    comment?: string;
  } | null;
  /** Todos los registros (también los sustituidos por una corrección). */
  setLogs: readonly SetLogV2[];
  /** Nombre y silueta de cada variante. */
  exercise: (variantId: string, fallbackName?: string) => { name: string; silhouette: Silhouette };
}

export function reviewExecution(input: ReviewInput): ExecutionReview {
  const current = input.versions.get(input.currentVersion);
  if (!current) throw new Error(`Falta la versión vigente ${input.currentVersion}.`);
  const effective = effectiveSetLogs(input.setLogs);
  const byId = new Map(input.setLogs.map((l) => [l.clientSetId, l]));
  const key = (prescriptionId: string, setNumber: number) => `${prescriptionId}#${setNumber}`;
  const effectiveByKey = new Map(effective.map((l) => [key(l.prescriptionId, l.setNumber), l]));

  /** Registros anteriores de la cadena de correcciones (el más reciente primero). */
  const previousOf = (log: SetLogV2) => {
    const out: string[] = [];
    for (let at = log.supersedes ? byId.get(log.supersedes) : undefined; at;) {
      out.push(describePerformed(asPerformed(at)));
      at = at.supersedes ? byId.get(at.supersedes) : undefined;
    }
    return out;
  };

  const ordered = [...current.items].sort((a, b) => a.order - b.order);
  const items: ExecutionReviewItem[] = ordered.map((item) => {
    const position = ordered.filter((o) => o.block === item.block && o.order <= item.order).length;
    const exercise = input.exercise(item.variantId, item.variantName);
    const sets = resolveSets(item).map((currentTarget): ExecutionReviewSet => {
      const log = effectiveByKey.get(key(item.id, currentTarget.setNumber));
      const target =
        (log && targetIn(input.versions.get(log.versionNumber), item.id, log.setNumber)) ??
        currentTarget;
      const performed = log ? asPerformed(log) : null;
      return {
        setNumber: currentTarget.setNumber,
        versionNumber: log?.versionNumber ?? input.currentVersion,
        prescribed: describeTarget(target),
        performed: performed ? describePerformed(performed) : null,
        status: !log ? 'pending' : log.completed ? 'done' : 'not_done',
        differences: performed
          ? setDifferences(target, performed).filter((d) => d !== 'No realizada')
          : [],
        corrected: !!log?.supersedes,
        previous: log ? previousOf(log) : [],
        performedAt: log?.performedAt ?? null,
        clockAdjusted: log?.clockAdjusted ?? false,
        note: log?.note ?? null,
      };
    });
    return {
      id: item.id,
      slot: `${item.block}${position}`,
      name: exercise.name,
      silhouette: exercise.silhouette,
      prescribed: [
        formatSetsAndReps(item.sets, item.defaults.reps),
        describeLoad(item.defaults.load),
        describeEffort(item.defaults.effort),
      ]
        .filter(Boolean)
        .join(' · '),
      doneSets: sets.filter((s) => s.status === 'done').length,
      plannedSets: sets.length,
      sets,
    };
  });

  const all = items.flatMap((i) => i.sets);
  const inCurrent = new Set(
    ordered.flatMap((i) => resolveSets(i).map((s) => key(i.id, s.setNumber))),
  );
  const log = input.log;
  return {
    status: input.status,
    startedVersion: log?.startedVersion ?? null,
    currentVersion: input.currentVersion,
    versionsUsed: [...new Set(effective.map((l) => l.versionNumber))].sort((a, b) => a - b),
    startedAt: log?.startedAt ?? null,
    finishedAt: log?.finishedAt ?? null,
    finishReason: log?.finishReason ?? null,
    elapsedSeconds:
      log?.finishedAt !== undefined
        ? Math.max(0, Math.round((Date.parse(log.finishedAt) - Date.parse(log.startedAt)) / 1000))
        : null,
    pausedSeconds: log?.pausedSeconds ?? 0,
    completedSets: all.filter((s) => s.status === 'done').length,
    plannedSets: all.length,
    notDoneSets: all.filter((s) => s.status === 'not_done').length,
    pendingSets: all.filter((s) => s.status === 'pending').length,
    comment: log?.comment ?? null,
    items,
    outsideCurrentVersion: effective
      .filter((l) => !inCurrent.has(key(l.prescriptionId, l.setNumber)))
      .map((l) => ({
        prescriptionId: l.prescriptionId,
        setNumber: l.setNumber,
        performed: describePerformed(asPerformed(l)),
      })),
  };
}
