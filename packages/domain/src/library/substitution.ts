/**
 * Exercise substitution (§29, MASTER_SPECIFICATION §13.8). Pure scoring: the trainer decides.
 *
 * Hard filters remove candidates that cannot be done (missing equipment, not tolerated,
 * restricted pattern, same exercise). Soft criteria score the rest and every point comes with
 * a human-readable reason so the suggestion is never a black box. Weights are practical
 * defaults (evidence level F) and are configurable.
 */
export type SubstitutionReason =
  'pain' | 'missing_equipment' | 'too_difficult' | 'space' | 'preference' | 'fatigue';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type LoadLevel = 'none' | 'low' | 'moderate' | 'high';
export type Space = 'minimal' | 'small' | 'large' | 'track_field';

export interface ExerciseFacts {
  id: string;
  name: string;
  movementPatternId: string | null;
  categoryIds: string[];
  methodIds: string[];
  primaryMuscleGroups: string[];
  secondaryMuscleGroups: string[];
  /** Required (non-optional) equipment ids. */
  equipmentIds: string[];
  level: Level | null;
  technicalComplexity: number | null;
  axialLoad: LoadLevel | null;
  impactLevel: LoadLevel | null;
  spaceRequired: Space | null;
  laterality: string | null;
}

export interface SubstitutionContext {
  reason: SubstitutionReason;
  /** Equipment available where the client trains; null = unknown (no equipment filter). */
  availableEquipmentIds: string[] | null;
  notToleratedExerciseIds: string[];
  restrictedPatternIds: string[];
  /** Exercises the original links to in the progression graph. */
  regressionIds: string[];
  progressionIds: string[];
  variantIds: string[];
  /** Exercises used recently by the client (penalised when looking for variety). */
  recentlyUsedIds: string[];
  clientLevel: Level | null;
}

export interface SubstitutionWeights {
  samePattern: number;
  sharedPrimaryMuscle: number;
  sharedSecondaryMuscle: number;
  sharedCategory: number;
  sharedMethod: number;
  graphRegression: number;
  graphVariant: number;
  lowerStressWhenPain: number;
  lowerComplexityWhenDifficult: number;
  smallerSpace: number;
  levelFit: number;
  recentPenalty: number;
}

export const DEFAULT_SUBSTITUTION_WEIGHTS: SubstitutionWeights = {
  samePattern: 30,
  sharedPrimaryMuscle: 12,
  sharedSecondaryMuscle: 4,
  sharedCategory: 6,
  sharedMethod: 8,
  graphRegression: 15,
  graphVariant: 12,
  lowerStressWhenPain: 10,
  lowerComplexityWhenDifficult: 10,
  smallerSpace: 10,
  levelFit: 5,
  recentPenalty: 6,
};

export interface SubstitutionSuggestion {
  exerciseId: string;
  name: string;
  score: number;
  reasons: string[];
}

export interface Exclusion {
  exerciseId: string;
  reason: 'same_exercise' | 'missing_equipment' | 'not_tolerated' | 'restricted_pattern';
}

const LOAD_RANK: Record<LoadLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };
const SPACE_RANK: Record<Space, number> = { minimal: 0, small: 1, large: 2, track_field: 3 };
const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function suggestSubstitutes(
  original: ExerciseFacts,
  candidates: ExerciseFacts[],
  ctx: SubstitutionContext,
  opts: {
    limit?: number;
    weights?: SubstitutionWeights;
    groupLabel?: (slug: string) => string;
  } = {},
): { suggestions: SubstitutionSuggestion[]; excluded: Exclusion[] } {
  const w = opts.weights ?? DEFAULT_SUBSTITUTION_WEIGHTS;
  const excluded: Exclusion[] = [];
  const out: SubstitutionSuggestion[] = [];
  const intersects = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

  for (const c of candidates) {
    if (c.id === original.id) {
      excluded.push({ exerciseId: c.id, reason: 'same_exercise' });
      continue;
    }
    if (ctx.notToleratedExerciseIds.includes(c.id)) {
      excluded.push({ exerciseId: c.id, reason: 'not_tolerated' });
      continue;
    }
    if (c.movementPatternId && ctx.restrictedPatternIds.includes(c.movementPatternId)) {
      excluded.push({ exerciseId: c.id, reason: 'restricted_pattern' });
      continue;
    }
    if (
      ctx.availableEquipmentIds &&
      c.equipmentIds.some((e) => !ctx.availableEquipmentIds!.includes(e))
    ) {
      excluded.push({ exerciseId: c.id, reason: 'missing_equipment' });
      continue;
    }

    let score = 0;
    const reasons: string[] = [];
    const add = (pts: number, why: string) => {
      if (pts === 0) return;
      score += pts;
      reasons.push(why);
    };

    if (original.movementPatternId && c.movementPatternId === original.movementPatternId)
      add(w.samePattern, 'Mismo patrón de movimiento');
    const prim = intersects(original.primaryMuscleGroups, c.primaryMuscleGroups);
    if (prim.length)
      add(w.sharedPrimaryMuscle * prim.length, `Mismos músculos principales (${prim.join(', ')})`);
    const sec = intersects(
      [...original.primaryMuscleGroups, ...original.secondaryMuscleGroups],
      c.secondaryMuscleGroups,
    );
    if (sec.length) add(w.sharedSecondaryMuscle, 'Implica músculos secundarios comunes');
    if (intersects(original.categoryIds, c.categoryIds).length)
      add(w.sharedCategory, 'Misma categoría');
    if (intersects(original.methodIds, c.methodIds).length)
      add(w.sharedMethod, 'Mismo método de entrenamiento');
    if (
      ctx.regressionIds.includes(c.id) &&
      (ctx.reason === 'pain' || ctx.reason === 'too_difficult' || ctx.reason === 'fatigue')
    ) {
      add(w.graphRegression, 'Regresión definida para este ejercicio');
    }
    if (ctx.variantIds.includes(c.id)) add(w.graphVariant, 'Variante definida para este ejercicio');
    if (ctx.progressionIds.includes(c.id) && ctx.reason !== 'preference')
      add(-w.graphRegression, 'Es una progresión (más exigente)');

    if (ctx.reason === 'pain') {
      const lower =
        (c.axialLoad &&
          original.axialLoad &&
          LOAD_RANK[c.axialLoad] < LOAD_RANK[original.axialLoad]) ||
        (c.impactLevel &&
          original.impactLevel &&
          LOAD_RANK[c.impactLevel] < LOAD_RANK[original.impactLevel]);
      if (lower) add(w.lowerStressWhenPain, 'Menor carga axial o impacto');
      const higher =
        (c.axialLoad &&
          original.axialLoad &&
          LOAD_RANK[c.axialLoad] > LOAD_RANK[original.axialLoad]) ||
        (c.impactLevel &&
          original.impactLevel &&
          LOAD_RANK[c.impactLevel] > LOAD_RANK[original.impactLevel]);
      if (higher) add(-w.lowerStressWhenPain, 'Mayor carga axial o impacto');
    }
    if (ctx.reason === 'too_difficult' || ctx.reason === 'fatigue') {
      if (c.technicalComplexity != null && original.technicalComplexity != null) {
        if (c.technicalComplexity < original.technicalComplexity)
          add(w.lowerComplexityWhenDifficult, 'Técnicamente más sencillo');
        if (c.technicalComplexity > original.technicalComplexity)
          add(-w.lowerComplexityWhenDifficult, 'Técnicamente más complejo');
      }
    }
    if (
      ctx.reason === 'space' &&
      c.spaceRequired &&
      original.spaceRequired &&
      SPACE_RANK[c.spaceRequired] < SPACE_RANK[original.spaceRequired]
    ) {
      add(w.smallerSpace, 'Necesita menos espacio');
    }
    if (ctx.clientLevel && c.level) {
      const diff = LEVEL_RANK[c.level] - LEVEL_RANK[ctx.clientLevel];
      if (diff <= 0) add(w.levelFit, 'Nivel adecuado para el cliente');
      else add(-w.levelFit * diff, 'Nivel superior al del cliente');
    }
    if (ctx.recentlyUsedIds.includes(c.id) && ctx.reason === 'preference')
      add(-w.recentPenalty, 'Usado recientemente');

    // Without a shared pattern or primary muscle the candidate does not replace the stimulus.
    const relevant =
      (original.movementPatternId && c.movementPatternId === original.movementPatternId) ||
      prim.length > 0 ||
      ctx.variantIds.includes(c.id) ||
      ctx.regressionIds.includes(c.id);
    if (!relevant) continue;
    out.push({ exerciseId: c.id, name: c.name, score, reasons });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
  return { suggestions: out.slice(0, opts.limit ?? 8), excluded };
}
