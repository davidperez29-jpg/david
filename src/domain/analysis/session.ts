import {
  daysBetween,
  type IsoDate,
  type IsoDateTime,
  isoWeekKey,
  localDateOf,
  startOfIsoWeek,
  addDays,
} from '../time';
import { describeEffort } from '../training/effort';
import {
  effectiveSetLogs,
  type ExecutionStatusV2,
  type SessionLogV2,
  type SetLogV2,
  summarizeExecutionV2,
} from '../training/execution';
import { describeLoad, type LoadSpec } from '../training/load';
import { describePerformed } from '../training/performance';
import { formatSetsAndReps } from '../training/prescription';
import { asPerformed, describeTarget } from '../training/review';
import {
  resolveSets,
  type SessionContent,
  type SessionItem,
  type ResolvedSet,
  type SessionVersion,
  type SetTarget,
} from '../training/session-v2';
import {
  checkProposal,
  compareEffort,
  compareLoad,
  compareQuantity,
  type Comparison,
  type Condition,
  type ProposalCheck,
} from './compare';
import { analyzeDuration, type DurationAnalysis } from './duration';
import {
  type Perspective,
  type ReferenceBasis,
  type SessionReference,
  sessionReference,
} from './reference';

/**
 * Análisis de una sesión (A8, B3.1; docs/BLOCK3_SPEC.md §5, §6 y §9.3). Función pura:
 * la misma entrada da siempre el mismo resultado, y no guarda nada.
 *
 * - Cuenta solo las **series efectivas** (un reenvío o una corrección cuentan una vez).
 * - Cada serie registrada se compara con su referencia: la versión de su registro (original)
 *   o la vigente (vigente). Lo no registrado, con la referencia de la sesión (P-117, P-121).
 * - Cumplimiento por dimensiones **separadas**, con sus denominadores; sin índice global (P-90).
 * - Volumen magnitud a magnitud, sin mezclar repeticiones, segundos, metros ni tipos de carga.
 */
export const ANALYSIS_FORMULAS = {
  completedSets: { id: 'training.completed-sets', version: '1.0.0' },
  prescribedVolume: { id: 'training.prescribed-volume', version: '1.0.0' },
  totalReps: { id: 'training.total-reps', version: '2.0.0' },
  durationTotal: { id: 'training.duration-total', version: '1.0.0' },
  distanceTotal: { id: 'training.distance-total', version: '1.0.0' },
  volumeLoad: { id: 'training.volume-load', version: '2.0.0' },
  prescribedVolumeLoad: { id: 'training.prescribed-volume-load', version: '1.0.0' },
  repDeviation: { id: 'training.rep-deviation', version: '1.0.0' },
  loadDeviation: { id: 'training.load-deviation', version: '1.0.0' },
  effortDeviation: { id: 'training.effort-deviation', version: '1.0.0' },
  prescribedCondition: { id: 'training.prescribed-condition', version: '1.0.0' },
  complianceProfile: { id: 'training.compliance-profile', version: '1.0.0' },
  exerciseStatus: { id: 'training.exercise-status', version: '1.0.0' },
  proposedValueMatch: { id: 'training.proposed-value-match', version: '1.0.0' },
  scheduleOffset: { id: 'training.schedule-offset', version: '1.0.0' },
  sessionElapsed: { id: 'training.session-elapsed', version: '1.0.0' },
  calculatedDuration: { id: 'training.session-calculated-duration', version: '1.0.0' },
  gapWarning: { id: 'training.session-gap-warning', version: '1.0.0' },
  dayTotals: { id: 'training.executed-day-totals', version: '1.0.0' },
} as const;

export type SetStatus = 'done' | 'not_done' | 'unregistered';
export type ExerciseStatus = 'complete' | 'partial' | 'not_done' | 'unregistered';

export interface AnalyzedSet {
  prescriptionId: string;
  setNumber: number;
  status: SetStatus;
  /** Versión con la que se compara; `null` si la referencia no está determinada o no existe. */
  referenceVersion: number | null;
  referenceBasis: ReferenceBasis | null;
  /** Versión con la que se registró (`null` sin registro). */
  loggedVersion: number | null;
  prescribed: string | null;
  performed: string | null;
  /** Solo en series hechas con referencia. */
  quantity: Comparison | null;
  load: Comparison | null;
  effort: Comparison[];
  /** P-120 (solo series hechas): igual o distinto de lo que proponía el formulario. */
  proposal: ProposalCheck | null;
  /** Serie que la clienta registró con «por lado» en las repeticiones. */
  perSide: boolean;
  corrected: boolean;
  /** Lo que decía antes de cada corrección, el más reciente primero. */
  previous: string[];
  note: string | null;
  performedAt: IsoDateTime | null;
  clockAdjusted: boolean;
  /** Vigente: serie registrada que ya no está en la versión vigente (no se compara). */
  outsideReference: boolean;
}

export interface AnalyzedExercise {
  prescriptionId: string;
  slot: string;
  name: string;
  /** Prescripción común del ejercicio en la referencia (o en la versión de sus registros). */
  prescribed: string;
  /** `null` si todas sus series están fuera de la referencia (vigente). */
  status: ExerciseStatus | null;
  sets: AnalyzedSet[];
}

export type ConditionCounts = Record<Condition, number>;

export interface ComplianceProfile {
  structural: {
    exercises: Record<ExerciseStatus, number> & { total: number };
    sets: { done: number; notDone: number; unregistered: number; total: number };
  };
  quantitative: { reps: ConditionCounts; seconds: ConditionCounts; meters: ConditionCounts };
  intensity: ConditionCounts;
  effort: { rir: ConditionCounts; rpe: ConditionCounts };
  /** P-120, sobre las series hechas (todas: es un dato del registro, no de la perspectiva). */
  proposal: { equal: number; different: number; done: number };
}

export interface Interval {
  min: number;
  max: number;
}

export type TonnageExclusion =
  'per_side_basis' | 'reps_per_side' | 'self_selected' | 'percent_unresolved' | 'not_by_reps';

export interface ExecutedVolume {
  /** Series hechas, por tipo. */
  sets: { reps: number; seconds: number; meters: number };
  /** `null`: no hay ninguna serie de ese tipo (ni prescrita ni hecha); nunca un cero inventado. */
  reps: number | null;
  repsPerSide: number | null;
  seconds: number | null;
  meters: number | null;
  tonnageKg: number | null;
  /** Series hechas que entran en el tonelaje. */
  tonnageSets: number;
  /** Series hechas con kg que no entran, por motivo. */
  tonnageExcluded: Partial<Record<TonnageExclusion, number>>;
}

export interface PrescribedVolume {
  sets: { reps: number; seconds: number; meters: number };
  reps: Interval | null;
  repsPerSide: Interval | null;
  seconds: number | null;
  meters: number | null;
  tonnageKg: Interval | null;
  tonnageSets: number;
  tonnageExcluded: Partial<Record<TonnageExclusion, number>>;
  /** Las series sin registrar no se pueden enumerar: la referencia no está determinada. */
  unregisteredUnknown: boolean;
}

export interface VersionInfo {
  number: number;
  publishedAt: IsoDateTime;
  plannedDate: IsoDate;
  reason: string | null;
  executionState: SessionVersion['executionState'];
}

export interface SessionAnalysis {
  perspective: Perspective;
  /** Referencia de lo NO registrado (las registradas llevan la suya). */
  reference: SessionReference;
  status: ExecutionStatusV2;
  finishReason: 'all_done' | 'ended_early' | null;
  pendingSetsConfirmed: number | null;
  versions: VersionInfo[];
  currentVersion: number;
  startedVersion: number | null;
  startVersionObserved: boolean;
  versionsUsed: number[];
  /** Fecha prevista de la versión vigente, y si cambió entre versiones. */
  plannedDate: IsoDate;
  plannedDateChanged: boolean;
  executedOn: IsoDate | null;
  executionTimeZone: string | null;
  /** La fecha de ejecución sale de una hora de inicio ajustada (ADR-28). */
  executedOnFromAdjustedTime: boolean;
  daysFromPlanned: number | null;
  executedWeek: { key: string; start: IsoDate; end: IsoDate } | null;
  exercises: AnalyzedExercise[];
  profile: ComplianceProfile;
  executed: ExecutedVolume;
  prescribed: PrescribedVolume;
  duration: DurationAnalysis;
  comment: string | null;
  corrections: number;
  outsideReferenceSets: number;
}

export interface SessionAnalysisInput {
  perspective: Perspective;
  versions: readonly SessionVersion[];
  currentVersion: number;
  execution: { log: SessionLogV2; setLogs: readonly SetLogV2[] } | null;
  /** La versión de inicio se observó (no se dedujo al migrar): `startVersionObserved`. */
  startObserved: boolean;
  today: IsoDate;
  /** Zona de la aplicación (estado de la sesión y fin del día previsto). */
  timeZone: string;
  now: IsoDateTime;
  exerciseName: (variantId: string, fallback?: string) => string;
}

const CONDITIONS: readonly Condition[] = [
  'matches',
  'differs',
  'within',
  'below',
  'above',
  'no_data',
  'not_applicable',
  'not_comparable',
  'not_evaluable',
];
const emptyCounts = (): ConditionCounts =>
  Object.fromEntries(CONDITIONS.map((c) => [c, 0])) as ConditionCounts;

const key = (prescriptionId: string, setNumber: number) => `${prescriptionId}#${setNumber}`;
const round = (value: number) => Math.round(value * 1000) / 1000;

function slotIn(item: SessionItem, content: SessionContent): string {
  const position = content.items.filter(
    (o) => o.block === item.block && o.order <= item.order,
  ).length;
  return `${item.block}${position}`;
}

const itemText = (item: SessionItem) =>
  [
    formatSetsAndReps(item.sets, item.defaults.reps),
    describeLoad(item.defaults.load),
    describeEffort(item.defaults.effort),
  ]
    .filter(Boolean)
    .join(' · ');

const resolvedCache = new WeakMap<SessionContent, Map<string, ResolvedSet>>();

/** Objetivo de una serie en una versión (memorizado por contenido: las versiones no cambian). */
const targetOf = (
  content: SessionContent | undefined,
  prescriptionId: string,
  setNumber: number,
): ResolvedSet | undefined => {
  if (!content) return undefined;
  let byKey = resolvedCache.get(content);
  if (!byKey) {
    byKey = new Map(
      content.items.flatMap((i) => resolveSets(i).map((t) => [key(i.id, t.setNumber), t] as const)),
    );
    resolvedCache.set(content, byKey);
  }
  return byKey.get(key(prescriptionId, setNumber));
};

/** kg externos por repetición de lo prescrito y si entran en el tonelaje (training.volume-load 2.0.0). */
function prescribedKg(
  load: LoadSpec,
): { kg: Interval; implements: number } | TonnageExclusion | null {
  switch (load.kind) {
    case 'external':
    case 'external_range': {
      if (load.basis === 'per_side') return 'per_side_basis';
      const kg =
        load.kind === 'external'
          ? { min: load.kg, max: load.kg }
          : { min: load.minKg, max: load.maxKg };
      return { kg, implements: load.basis === 'per_implement' ? (load.implements ?? 2) : 1 };
    }
    case 'percent_1rm':
      return load.resolution
        ? { kg: { min: load.resolution.kg, max: load.resolution.kg }, implements: 1 }
        : 'percent_unresolved';
    default:
      return null;
  }
}

function repsInterval(target: SetTarget): Interval | null {
  const reps = target.reps;
  if (reps.kind === 'fixed') return { min: reps.reps, max: reps.reps };
  if (reps.kind === 'range') return { min: reps.min, max: reps.max };
  return null;
}

const addInterval = (a: Interval | null, b: Interval): Interval =>
  a ? { min: round(a.min + b.min), max: round(a.max + b.max) } : b;

const bump = (record: Partial<Record<TonnageExclusion, number>>, reason: TonnageExclusion) => {
  record[reason] = (record[reason] ?? 0) + 1;
};

/** Volumen prescrito de las series con referencia (training.prescribed-volume y prescribed-volume-load). */
function prescribedVolume(
  targets: readonly SetTarget[],
  unregisteredUnknown: boolean,
): PrescribedVolume {
  const out: PrescribedVolume = {
    sets: { reps: 0, seconds: 0, meters: 0 },
    reps: null,
    repsPerSide: null,
    seconds: null,
    meters: null,
    tonnageKg: null,
    tonnageSets: 0,
    tonnageExcluded: {},
    unregisteredUnknown,
  };
  for (const target of targets) {
    const reps = repsInterval(target);
    const kg = prescribedKg(target.load);
    if (reps) {
      out.sets.reps += 1;
      if (target.reps.perSide) out.repsPerSide = addInterval(out.repsPerSide, reps);
      else out.reps = addInterval(out.reps, reps);
      if (kg === null) continue;
      if (typeof kg === 'string') bump(out.tonnageExcluded, kg);
      else if (target.reps.perSide) bump(out.tonnageExcluded, 'reps_per_side');
      else {
        out.tonnageSets += 1;
        out.tonnageKg = addInterval(out.tonnageKg, {
          min: round(reps.min * kg.kg.min * kg.implements),
          max: round(reps.max * kg.kg.max * kg.implements),
        });
      }
    } else if (target.reps.kind === 'seconds') {
      out.sets.seconds += 1;
      out.seconds = (out.seconds ?? 0) + target.reps.seconds;
      if (kg !== null) bump(out.tonnageExcluded, 'not_by_reps');
    } else if (target.reps.kind === 'meters') {
      out.sets.meters += 1;
      out.meters = (out.meters ?? 0) + target.reps.meters;
      if (kg !== null) bump(out.tonnageExcluded, 'not_by_reps');
    }
  }
  return out;
}

/** Volumen registrado de las series hechas (training.total-reps 2.0.0, duration-total, distance-total, volume-load 2.0.0). */
export function executedVolume(
  done: readonly { log: SetLogV2; ownTarget: SetTarget | undefined }[],
  /** Qué magnitudes tiene la sesión (prescritas o hechas): las demás quedan en `null`. */
  kindsPresent: {
    reps: boolean;
    repsPerSide: boolean;
    seconds: boolean;
    meters: boolean;
    tonnage: boolean;
  },
): ExecutedVolume {
  const out: ExecutedVolume = {
    sets: { reps: 0, seconds: 0, meters: 0 },
    reps: kindsPresent.reps ? 0 : null,
    repsPerSide: kindsPresent.repsPerSide ? 0 : null,
    seconds: kindsPresent.seconds ? 0 : null,
    meters: kindsPresent.meters ? 0 : null,
    tonnageKg: kindsPresent.tonnage ? 0 : null,
    tonnageSets: 0,
    tonnageExcluded: {},
  };
  for (const { log, ownTarget } of done) {
    if (!log.completed) continue;
    const perSide = Boolean(ownTarget?.reps.perSide);
    if (log.reps !== undefined) {
      out.sets.reps += 1;
      if (perSide) out.repsPerSide = (out.repsPerSide ?? 0) + log.reps;
      else out.reps = (out.reps ?? 0) + log.reps;
    } else if (log.distanceM !== undefined) {
      out.sets.meters += 1;
      out.meters = (out.meters ?? 0) + log.distanceM;
    } else if (log.durationS !== undefined) {
      out.sets.seconds += 1;
      out.seconds = (out.seconds ?? 0) + log.durationS;
    }
    const load = log.load;
    const hasKg =
      load?.kind === 'external' || (load?.kind === 'self_selected' && load.kg !== undefined);
    if (!hasKg) continue;
    if (load?.kind === 'self_selected') {
      bump(out.tonnageExcluded, 'self_selected');
      continue;
    }
    if (log.reps === undefined) {
      bump(out.tonnageExcluded, 'not_by_reps');
      continue;
    }
    const prescribed = ownTarget ? prescribedKg(ownTarget.load) : null;
    if (prescribed === 'per_side_basis') {
      bump(out.tonnageExcluded, 'per_side_basis');
      continue;
    }
    if (perSide) {
      bump(out.tonnageExcluded, 'reps_per_side');
      continue;
    }
    const implementsCount =
      prescribed && typeof prescribed !== 'string' ? prescribed.implements : 1;
    out.tonnageSets += 1;
    out.tonnageKg = round(
      (out.tonnageKg ?? 0) + log.reps * (load as { kg: number }).kg * implementsCount,
    );
  }
  return out;
}

/** Totales del día: suma magnitud a magnitud (training.executed-day-totals 1.0.0). */
export function addExecutedVolumes(volumes: readonly ExecutedVolume[]): ExecutedVolume {
  const plus = (a: number | null, b: number | null) =>
    a === null && b === null ? null : round((a ?? 0) + (b ?? 0));
  return volumes.reduce<ExecutedVolume>(
    (acc, v) => {
      const excluded = { ...acc.tonnageExcluded };
      for (const [reason, n] of Object.entries(v.tonnageExcluded) as [TonnageExclusion, number][]) {
        excluded[reason] = (excluded[reason] ?? 0) + n;
      }
      return {
        sets: {
          reps: acc.sets.reps + v.sets.reps,
          seconds: acc.sets.seconds + v.sets.seconds,
          meters: acc.sets.meters + v.sets.meters,
        },
        reps: plus(acc.reps, v.reps),
        repsPerSide: plus(acc.repsPerSide, v.repsPerSide),
        seconds: plus(acc.seconds, v.seconds),
        meters: plus(acc.meters, v.meters),
        tonnageKg: plus(acc.tonnageKg, v.tonnageKg),
        tonnageSets: acc.tonnageSets + v.tonnageSets,
        tonnageExcluded: excluded,
      };
    },
    {
      sets: { reps: 0, seconds: 0, meters: 0 },
      reps: null,
      repsPerSide: null,
      seconds: null,
      meters: null,
      tonnageKg: null,
      tonnageSets: 0,
      tonnageExcluded: {},
    },
  );
}

function exerciseStatus(sets: readonly AnalyzedSet[]): ExerciseStatus | null {
  const own = sets.filter((s) => !s.outsideReference);
  if (own.length === 0) return null;
  const done = own.filter((s) => s.status === 'done').length;
  const notDone = own.filter((s) => s.status === 'not_done').length;
  if (done === own.length) return 'complete';
  if (done === 0 && notDone === 0) return 'unregistered';
  if (done === 0) return 'not_done';
  return 'partial';
}

export function analyzeSession(input: SessionAnalysisInput): SessionAnalysis {
  const versions = new Map(input.versions.map((v) => [v.number, v]));
  const current = versions.get(input.currentVersion);
  if (!current) throw new Error(`Falta la versión vigente ${input.currentVersion}.`);
  const log = input.execution?.log ?? null;
  const allSetLogs = input.execution?.setLogs ?? [];
  const effective = effectiveSetLogs(allSetLogs);
  const effectiveByKey = new Map(effective.map((l) => [key(l.prescriptionId, l.setNumber), l]));
  const byId = new Map(allSetLogs.map((l) => [l.clientSetId, l]));

  const reference = sessionReference({
    perspective: input.perspective,
    versions: input.versions,
    currentVersion: input.currentVersion,
    execution: input.execution,
    startObserved: input.startObserved,
    timeZone: input.timeZone,
    now: input.now,
  });
  const referenceContent =
    reference.kind === 'determined' ? versions.get(reference.version)?.content : undefined;
  const ownContent = (l: SetLogV2) => versions.get(l.versionNumber)?.content;

  const previousOf = (l: SetLogV2) => {
    const out: string[] = [];
    for (let at = l.supersedes ? byId.get(l.supersedes) : undefined; at;) {
      out.push(describePerformed(asPerformed(at)));
      at = at.supersedes ? byId.get(at.supersedes) : undefined;
    }
    return out;
  };

  /** Una serie: registrada (con su versión o la vigente) o sin registrar (con la de la sesión). */
  const analyzeSet = (
    prescriptionId: string,
    setNumber: number,
    unregisteredTarget: SetTarget | undefined,
  ): AnalyzedSet => {
    const l = effectiveByKey.get(key(prescriptionId, setNumber));
    const ownTarget = l ? targetOf(ownContent(l), prescriptionId, setNumber) : undefined;
    let target: SetTarget | undefined;
    let referenceVersion: number | null = null;
    let referenceBasis: ReferenceBasis | null = null;
    if (l) {
      if (input.perspective === 'original') {
        target = ownTarget;
        referenceVersion = ownTarget ? l.versionNumber : null;
        referenceBasis = ownTarget ? 'set_version' : null;
      } else {
        target = targetOf(current.content, prescriptionId, setNumber);
        referenceVersion = target ? input.currentVersion : null;
        referenceBasis = target ? 'current' : null;
      }
    } else if (unregisteredTarget && reference.kind === 'determined') {
      target = unregisteredTarget;
      referenceVersion = reference.version;
      referenceBasis = reference.basis;
    }
    const performed = l
      ? { ...asPerformed(l), ...(l.rpeScale ? { rpeScale: l.rpeScale } : {}) }
      : null;
    const done = l?.completed === true;
    return {
      prescriptionId,
      setNumber,
      status: !l ? 'unregistered' : l.completed ? 'done' : 'not_done',
      referenceVersion,
      referenceBasis,
      loggedVersion: l?.versionNumber ?? null,
      prescribed: target ? describeTarget(target) : null,
      performed: performed ? describePerformed(performed) : null,
      quantity: done && target && performed ? compareQuantity(target, performed) : null,
      load: done && target && performed ? compareLoad(target, performed) : null,
      effort: done && target && performed ? compareEffort(target, performed) : [],
      proposal: done && ownTarget && performed ? checkProposal(ownTarget, performed) : null,
      perSide: Boolean(ownTarget?.reps.perSide),
      corrected: Boolean(l?.supersedes),
      previous: l ? previousOf(l) : [],
      note: l?.note ?? null,
      performedAt: l?.performedAt ?? null,
      clockAdjusted: l ? (l.clockAdjustment ?? null) !== null || l.clockAdjusted : false,
      outsideReference: Boolean(l) && input.perspective === 'current' && !target,
    };
  };

  // Ejercicios: primero los de la referencia, en su orden; después, los que solo aparecen en
  // registros de otras versiones, en el orden de su versión.
  const exercises: AnalyzedExercise[] = [];
  const listed = new Set<string>();
  const baseContent = input.perspective === 'current' ? current.content : referenceContent;
  if (baseContent) {
    for (const item of [...baseContent.items].sort((a, b) => a.order - b.order)) {
      const sets = resolveSets(item).map((t) => {
        listed.add(key(item.id, t.setNumber));
        return analyzeSet(item.id, t.setNumber, t);
      });
      exercises.push({
        prescriptionId: item.id,
        slot: slotIn(item, baseContent),
        name: input.exerciseName(item.variantId, item.variantName),
        prescribed: itemText(item),
        status: null,
        sets,
      });
    }
  }
  const extra = effective
    .filter((l) => !listed.has(key(l.prescriptionId, l.setNumber)))
    .sort((a, b) => {
      const ia = ownContent(a)?.items.find((i) => i.id === a.prescriptionId);
      const ib = ownContent(b)?.items.find((i) => i.id === b.prescriptionId);
      return (
        a.versionNumber - b.versionNumber ||
        (ia?.order ?? 0) - (ib?.order ?? 0) ||
        a.setNumber - b.setNumber
      );
    });
  for (const l of extra) {
    let exercise = exercises.find((e) => e.prescriptionId === l.prescriptionId);
    if (!exercise) {
      const content = ownContent(l);
      const item = content?.items.find((i) => i.id === l.prescriptionId);
      exercise = {
        prescriptionId: l.prescriptionId,
        slot: item && content ? slotIn(item, content) : '—',
        name: input.exerciseName(l.variantId, item?.variantName),
        prescribed: item ? itemText(item) : '',
        status: null,
        sets: [],
      };
      exercises.push(exercise);
    }
    exercise.sets.push(analyzeSet(l.prescriptionId, l.setNumber, undefined));
    exercise.sets.sort((a, b) => a.setNumber - b.setNumber);
  }
  for (const exercise of exercises) exercise.status = exerciseStatus(exercise.sets);

  // Perfil por dimensiones (training.compliance-profile 1.0.0).
  const sets = exercises.flatMap((e) => e.sets);
  const inReference = sets.filter((s) => !s.outsideReference);
  const profile: ComplianceProfile = {
    structural: {
      exercises: {
        complete: exercises.filter((e) => e.status === 'complete').length,
        partial: exercises.filter((e) => e.status === 'partial').length,
        not_done: exercises.filter((e) => e.status === 'not_done').length,
        unregistered: exercises.filter((e) => e.status === 'unregistered').length,
        total: exercises.filter((e) => e.status !== null).length,
      },
      sets: {
        done: inReference.filter((s) => s.status === 'done').length,
        notDone: inReference.filter((s) => s.status === 'not_done').length,
        unregistered: inReference.filter((s) => s.status === 'unregistered').length,
        total: inReference.length,
      },
    },
    quantitative: { reps: emptyCounts(), seconds: emptyCounts(), meters: emptyCounts() },
    intensity: emptyCounts(),
    effort: { rir: emptyCounts(), rpe: emptyCounts() },
    proposal: { equal: 0, different: 0, done: 0 },
  };
  for (const s of sets) {
    if (s.quantity) {
      const measure = s.quantity.measure as 'reps' | 'seconds' | 'meters';
      profile.quantitative[measure][s.quantity.condition] += 1;
    }
    if (s.load) profile.intensity[s.load.condition] += 1;
    for (const e of s.effort) profile.effort[e.measure === 'rpe' ? 'rpe' : 'rir'][e.condition] += 1;
    if (s.proposal) {
      profile.proposal.done += 1;
      profile.proposal[s.proposal.overall] += 1;
    }
  }

  // Volumen.
  const referenceTargets = exercises.flatMap((e) =>
    e.sets
      .filter((s) => !s.outsideReference && s.referenceVersion !== null)
      .map((s) =>
        targetOf(versions.get(s.referenceVersion!)?.content, s.prescriptionId, s.setNumber),
      )
      .filter((t): t is ResolvedSet => t !== undefined),
  );
  const unregisteredUnknown = input.perspective === 'original' && reference.kind === 'undetermined';
  const prescribed = prescribedVolume(referenceTargets, unregisteredUnknown);
  const doneSets = effective
    .filter((l) => l.completed)
    .map((l) => ({ log: l, ownTarget: targetOf(ownContent(l), l.prescriptionId, l.setNumber) }));
  const executed = executedVolume(doneSets, {
    reps:
      prescribed.reps !== null ||
      doneSets.some((d) => d.log.reps !== undefined && !d.ownTarget?.reps.perSide),
    repsPerSide:
      prescribed.repsPerSide !== null ||
      doneSets.some((d) => d.log.reps !== undefined && Boolean(d.ownTarget?.reps.perSide)),
    seconds:
      prescribed.sets.seconds > 0 ||
      doneSets.some((d) => d.log.durationS !== undefined && d.log.distanceM === undefined),
    meters: prescribed.sets.meters > 0 || doneSets.some((d) => d.log.distanceM !== undefined),
    tonnage: prescribed.tonnageSets > 0,
  });

  // Estado, fechas y versiones.
  const summary = summarizeExecutionV2({
    plannedDate: current.content.plannedDate,
    content: current.content,
    log,
    setLogs: allSetLogs,
    today: input.today,
    timeZone: input.timeZone,
  });
  const executedOn = log ? localDateOf(log.startedAt, log.startTimeZone) : null;
  const plannedDates = new Set(input.versions.map((v) => v.content.plannedDate));

  return {
    perspective: input.perspective,
    reference,
    status: summary.status,
    finishReason: log?.finishReason ?? null,
    pendingSetsConfirmed: log?.pendingSetsConfirmed ?? null,
    versions: [...input.versions]
      .sort((a, b) => a.number - b.number)
      .map((v) => ({
        number: v.number,
        publishedAt: v.publishedAt,
        plannedDate: v.content.plannedDate,
        reason: v.reason ?? null,
        executionState: v.executionState,
      })),
    currentVersion: input.currentVersion,
    startedVersion: log?.startedVersion ?? null,
    startVersionObserved: input.startObserved,
    versionsUsed: [...new Set(effective.map((l) => l.versionNumber))].sort((a, b) => a - b),
    plannedDate: current.content.plannedDate,
    plannedDateChanged: plannedDates.size > 1,
    executedOn,
    executionTimeZone: log?.startTimeZone ?? null,
    executedOnFromAdjustedTime: log ? (log.startClockAdjustment ?? null) !== null : false,
    daysFromPlanned: executedOn ? daysBetween(current.content.plannedDate, executedOn) : null,
    executedWeek: executedOn
      ? {
          key: isoWeekKey(executedOn),
          start: startOfIsoWeek(executedOn),
          end: addDays(startOfIsoWeek(executedOn), 6),
        }
      : null,
    exercises,
    profile,
    executed,
    prescribed,
    duration: analyzeDuration({
      log,
      setLogs: allSetLogs,
      estimatedMinutes: current.content.estimatedMinutes ?? null,
    }),
    comment: log?.comment ?? null,
    corrections: effective.filter((l) => l.supersedes).length,
    outsideReferenceSets: sets.filter((s) => s.outsideReference).length,
  };
}
