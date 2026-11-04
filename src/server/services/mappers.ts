import 'server-only';
import {
  type AssessmentSeriesVM,
  type ExerciseInSessionVM,
  type ProvenanceVM,
  type RehabCaseVM,
  type SessionCardVM,
  type SessionDetailVM,
  type SessionPreviewItemVM,
} from '@/contracts/shared';
import {
  compareResults,
  findAssessmentTest,
  groupByTest,
  type AssessmentResult,
} from '@/domain/assessment';
import { type Exercise, isSafeExternalUrl } from '@/domain/exercises';
import { formatSeconds } from '@/domain/format';
import { type Provenance, UNIT_SYMBOLS } from '@/domain/measurement';
import { currentPhase, isPhaseComplete, phaseProgress, type RehabCase } from '@/domain/rehab';
import { type IsoDate } from '@/domain/time';
import {
  defaultLoadKgFor,
  defaultRepsFor,
  describeTempo,
  formatEffort,
  formatLoad,
  formatRepTarget,
  formatSetsAndReps,
  formatTempo,
} from '@/domain/training/prescription';
import {
  completedSetCount,
  plannedSetCount,
  type PlannedSession,
  type SessionLog,
  sessionStatus,
} from '@/domain/training/session';

export function toSessionCard(
  session: PlannedSession,
  log: SessionLog | undefined,
  today: IsoDate,
): SessionCardVM {
  return {
    id: session.id,
    date: session.date,
    title: session.title,
    focus: session.focus,
    estimatedMinutes: session.estimatedMinutes,
    exerciseCount: session.exercises.length,
    plannedSets: plannedSetCount(session),
    completedSets: completedSetCount(log),
    status: sessionStatus(session, log, today),
  };
}

export function toPreview(
  session: PlannedSession,
  exercises: ReadonlyMap<string, Exercise>,
): SessionPreviewItemVM[] {
  return session.exercises.map((rx) => ({
    name: exercises.get(rx.exerciseId)?.name ?? 'Ejercicio',
    pattern: exercises.get(rx.exerciseId)?.pattern ?? 'accessory',
    setsAndReps: formatSetsAndReps(rx.sets, rx.reps),
  }));
}

export function toSessionDetail(
  session: PlannedSession,
  log: SessionLog | undefined,
  exercises: ReadonlyMap<string, Exercise>,
  today: IsoDate,
): SessionDetailVM {
  const ordered = [...session.exercises].sort((a, b) => a.order - b.order);
  const items: ExerciseInSessionVM[] = ordered.map((rx) => {
    const exercise = exercises.get(rx.exerciseId);
    const positionInBlock = ordered.filter(
      (other) => other.block === rx.block && other.order <= rx.order,
    ).length;
    const videoUrl = exercise?.media.videoUrl;
    return {
      prescriptionId: rx.id,
      slot: `${rx.block}${positionInBlock}`,
      order: rx.order,
      exerciseId: rx.exerciseId,
      name: exercise?.name ?? 'Ejercicio',
      pattern: exercise?.pattern ?? 'accessory',
      summary: exercise?.summary ?? '',
      steps: exercise?.steps ?? [],
      cues: exercise?.cues ?? [],
      videoUrl: videoUrl && isSafeExternalUrl(videoUrl) ? videoUrl : null,
      sets: rx.sets,
      setsAndReps: formatSetsAndReps(rx.sets, rx.reps),
      repTargetLabel: formatRepTarget(rx.reps),
      repUnit:
        rx.reps.kind === 'seconds' ? 'seconds' : rx.reps.kind === 'meters' ? 'meters' : 'reps',
      loadLabel: formatLoad(rx.load),
      effortLabel: formatEffort(rx.effort),
      restSeconds: rx.restSeconds,
      restLabel: formatSeconds(rx.restSeconds),
      tempo: rx.tempo
        ? { code: formatTempo(rx.tempo), description: describeTempo(rx.tempo) }
        : null,
      notes: rx.notes ?? null,
      defaultReps: defaultRepsFor(rx.reps),
      defaultLoadKg: defaultLoadKgFor(rx.load),
      tracksLoadKg: rx.load.kind === 'kg',
    };
  });
  return {
    id: session.id,
    date: session.date,
    title: session.title,
    focus: session.focus,
    estimatedMinutes: session.estimatedMinutes,
    coachNote: session.coachNote ?? null,
    status: sessionStatus(session, log, today),
    exercises: items,
  };
}

export function toProvenanceVM(p: Provenance): ProvenanceVM {
  return {
    origin: p.origin,
    method: p.method,
    instrument: p.instrument ?? null,
    formula: p.formula ? `${p.formula.id} v${p.formula.version}` : null,
    importedFrom: p.importedFrom ?? null,
    measuredOn: p.measuredAt.slice(0, 10),
  };
}

export function toAssessmentSeries(results: readonly AssessmentResult[]): AssessmentSeriesVM[] {
  return [...groupByTest(results)].map(([testId, points]) => {
    const test = findAssessmentTest(testId);
    const betterWhen = test?.betterWhen ?? 'higher';
    const last = points.at(-1);
    const previous = points.at(-2);
    return {
      testId,
      testName: test?.name ?? testId,
      outcomeName: test?.outcome.name ?? '',
      unit: last ? UNIT_SYMBOLS[last.measurement.unit] : null,
      betterWhen,
      points: points.map((point) => ({
        date: point.date,
        value: point.measurement.value,
        provenance: toProvenanceVM(point.measurement.provenance),
      })),
      comparison: previous && last ? compareResults(previous, last, betterWhen) : null,
    };
  });
}

export function toRehabCaseVM(rehabCase: RehabCase, clientName: string): RehabCaseVM {
  const current = currentPhase(rehabCase);
  return {
    id: rehabCase.id,
    clientId: rehabCase.clientId,
    clientName,
    title: rehabCase.title,
    startedOn: rehabCase.startedOn,
    phases: [...rehabCase.phases]
      .sort((a, b) => a.order - b.order)
      .map((phase) => ({
        id: phase.id,
        order: phase.order,
        name: phase.name,
        goal: phase.goal,
        state: isPhaseComplete(phase) ? 'done' : phase.id === current?.id ? 'current' : 'upcoming',
        ...phaseProgress(phase),
        criteria: phase.criteria.map((criterion) => ({
          id: criterion.id,
          description: criterion.description,
          status: criterion.status,
          definedBy: criterion.definedBy,
          checkedOn: criterion.checkedOn ?? null,
        })),
      })),
  };
}

export function indexBy<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function logsBySession(logs: readonly SessionLog[]): Map<string, SessionLog> {
  return new Map(logs.map((log) => [log.sessionId, log]));
}
