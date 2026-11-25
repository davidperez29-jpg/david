import { type IsoDate } from '../time';
import { type ExecutionStatusV2 } from '../training/execution';
import { type PeriodSession } from './period';
import { type AnalyzedSet } from './session';

/**
 * A10 · Evolución de un ejercicio (B3.2; docs/BLOCK3_SPEC.md §9.6), training.exercise-evolution
 * 1.0.0: sesión a sesión, en orden de ejecución, las series de una variante con lo prescrito, lo
 * registrado y su condición.
 *
 * - Solo dentro de la **misma modalidad** (tipo de serie y carga con su base): si cambia, la
 *   evolución se corta en otro tramo y se avisa; no se compara a través del corte.
 * - Sin estimación del 1RM, sin tendencias ni predicciones.
 */
export const EXERCISE_FORMULA = { id: 'training.exercise-evolution', version: '1.0.0' } as const;

export interface EvolutionSession {
  sessionId: string;
  title: string;
  label: string | null;
  executedOn: IsoDate;
  status: ExecutionStatusV2;
  /** Series de esta variante en la sesión (todas: hechas, no realizadas y sin registrar). */
  sets: AnalyzedSet[];
  doneSets: number;
  plannedSets: number;
  versions: number[];
  /** Hay series de la variante con modalidades distintas dentro de la misma sesión. */
  mixedModality: boolean;
}

export interface EvolutionSegment {
  modality: { key: string; text: string } | null;
  sessions: EvolutionSession[];
}

export interface ExerciseEvolution {
  variantId: string;
  segments: EvolutionSegment[];
  sessions: number;
}

export function exerciseEvolution(input: {
  variantId: string;
  /** Sesiones ejecutadas del periodo. */
  sessions: readonly PeriodSession[];
}): ExerciseEvolution {
  const rows: (EvolutionSession & { modality: EvolutionSegment['modality'] })[] = [];
  const ordered = [...input.sessions]
    .filter((s) => s.analysis.executedOn !== null)
    .sort(
      (a, b) =>
        a.analysis.executedOn!.localeCompare(b.analysis.executedOn!) ||
        a.sessionId.localeCompare(b.sessionId),
    );
  for (const s of ordered) {
    const sets = s.analysis.exercises.flatMap((e) =>
      e.sets.filter((set) => set.variantId === input.variantId),
    );
    if (!sets.some((set) => set.status === 'done')) continue;
    const modalities = new Map(
      sets.filter((x) => x.modality).map((x) => [x.modality!.key, x.modality!]),
    );
    rows.push({
      sessionId: s.sessionId,
      title: s.title,
      label: s.label,
      executedOn: s.analysis.executedOn!,
      status: s.analysis.status,
      sets,
      doneSets: sets.filter((x) => x.status === 'done').length,
      plannedSets: sets.filter((x) => !x.outsideReference).length,
      versions: [
        ...new Set(sets.flatMap((x) => (x.loggedVersion !== null ? [x.loggedVersion] : []))),
      ].sort((a, b) => a - b),
      mixedModality: modalities.size > 1,
      modality: modalities.size === 1 ? [...modalities.values()][0]! : null,
    });
  }
  const segments: EvolutionSegment[] = [];
  for (const { modality, ...session } of rows) {
    const last = segments.at(-1);
    if (last && last.modality?.key === modality?.key && modality !== null) {
      last.sessions.push(session);
    } else {
      segments.push({ modality, sessions: [session] });
    }
  }
  return { variantId: input.variantId, segments, sessions: rows.length };
}
