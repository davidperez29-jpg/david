import { type Complexity, type Laterality, type Owner, type Taxonomy } from './taxonomy';

/**
 * Visibilidad de un ejercicio:
 * - `global`: catálogo de TrainPro, visible para todos los entrenadores; no editable.
 * - `trainer`: creado por un entrenador para su trabajo; se podrá compartir con su equipo.
 * - `private`: solo lo ve el entrenador que lo creó.
 * Los clientes nunca navegan por la biblioteca: ven los ejercicios a través de sus sesiones.
 */
export type Visibility = 'global' | 'trainer' | 'private';

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  global: 'Catálogo global',
  trainer: 'Mis ejercicios',
  private: 'Privado',
};

/** Silueta que se muestra mientras no haya imagen o vídeo propio. Independiente de la clasificación. */
export const SILHOUETTES = [
  'squat',
  'hinge',
  'lunge',
  'press-overhead',
  'press-bench',
  'pull-up',
  'row',
  'pallof',
  'carry',
  'plank',
  'dead-bug',
  'jump',
  'sprint',
  'calf-raise',
  'mobility',
] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

/** Ejercicio principal: agrupa variantes que comparten un movimiento de base (p. ej., «Sentadilla»). */
export interface Exercise {
  id: string;
  name: string;
  summary: string;
  owner: Owner;
  visibility: Visibility;
}

export interface ExerciseMedia {
  videoUrl?: string;
  imageUrl?: string;
  links: { label: string; url: string }[];
}

/**
 * Variante concreta y prescribible (p. ej., «Sentadilla frontal»). Tiene su propia clasificación:
 * no hereda etiquetas, patrones ni material del ejercicio principal.
 */
export interface ExerciseVariant {
  id: string;
  exerciseId: string;
  name: string;
  owner: Owner;
  visibility: Visibility;
  /** Forma de referencia del ejercicio principal. Cada principal tiene exactamente una. */
  isPrimary: boolean;
  description: string;
  /** Objetivo y aplicaciones habituales. */
  objective: string;
  /** Instrucciones técnicas propias. Si está vacío, se muestran las de la variante de referencia. */
  steps: string[];
  cues: string[];
  commonMistakes: string[];
  technicalNotes: string[];
  tagIds: string[];
  patternIds: string[];
  regionIds: string[];
  equipmentIds: string[];
  environmentIds: string[];
  laterality: Laterality;
  complexity: Complexity;
  silhouette: Silhouette;
  media: ExerciseMedia;
  /**
   * Por qué tiene estas etiquetas: variante, carga, intención, velocidad, rango o contracción.
   * Las etiquetas describen usos de programación; no se deducen del nombre del ejercicio.
   */
  classificationNote?: string;
}

/** Relación dirigida: `toVariantId` es una progresión de `fromVariantId` (y esta, su regresión). */
export interface ProgressionLink {
  fromVariantId: string;
  toVariantId: string;
  owner: Owner;
  note?: string;
}

/** Información personalizada de un entrenador sobre cualquier variante (también del catálogo global). */
export interface TrainerExerciseNote {
  trainerId: string;
  variantId: string;
  text: string;
}

export interface Favorite {
  trainerId: string;
  variantId: string;
}

export function progressionsOf(variantId: string, links: readonly ProgressionLink[]): string[] {
  return links.filter((l) => l.fromVariantId === variantId).map((l) => l.toVariantId);
}

export function regressionsOf(variantId: string, links: readonly ProgressionLink[]): string[] {
  return links.filter((l) => l.toVariantId === variantId).map((l) => l.fromVariantId);
}

export function primaryVariant(
  exerciseId: string,
  variants: readonly ExerciseVariant[],
): ExerciseVariant | undefined {
  return variants.find((v) => v.exerciseId === exerciseId && v.isPrimary);
}

/** Instrucciones a mostrar: las de la variante o, si no tiene, las de la variante de referencia. */
export function effectiveSteps(
  variant: ExerciseVariant,
  variants: readonly ExerciseVariant[],
): {
  steps: string[];
  inheritedFrom: ExerciseVariant | null;
} {
  if (variant.steps.length > 0) return { steps: variant.steps, inheritedFrom: null };
  const primary = primaryVariant(variant.exerciseId, variants);
  return primary && primary.id !== variant.id
    ? { steps: primary.steps, inheritedFrom: primary }
    : { steps: [], inheritedFrom: null };
}

export interface Library {
  exercises: readonly Exercise[];
  variants: readonly ExerciseVariant[];
  links: readonly ProgressionLink[];
}

/** Integridad de la biblioteca frente a la taxonomía (se comprueba en los tests de los datos). */
export function libraryIssues(library: Library, taxonomy: Taxonomy): string[] {
  const issues: string[] = [];
  const has = (items: readonly { id: string }[]) => new Set(items.map((i) => i.id));
  const tags = has(taxonomy.tags);
  const patterns = has(taxonomy.patterns);
  const regions = has(taxonomy.regions);
  const equipment = has(taxonomy.equipment);
  const environments = has(taxonomy.environments);
  const exercises = has(library.exercises);
  const variantIds = new Set<string>();

  for (const v of library.variants) {
    if (variantIds.has(v.id)) issues.push(`Variante duplicada: ${v.id}.`);
    variantIds.add(v.id);
    if (!exercises.has(v.exerciseId)) issues.push(`${v.id}: ejercicio principal inexistente.`);
    const check = (label: string, ids: string[], valid: Set<string>) =>
      ids
        .filter((id) => !valid.has(id))
        .forEach((id) => issues.push(`${v.id}: valor desconocido en ${label} «${id}».`));
    check('etiquetas', v.tagIds, tags);
    check('patrones', v.patternIds, patterns);
    check('regiones', v.regionIds, regions);
    check('material', v.equipmentIds, equipment);
    check('entornos', v.environmentIds, environments);
    if (v.equipmentIds.length === 0)
      issues.push(`${v.id}: sin material (usa «Peso corporal» si no necesita).`);
  }
  for (const e of library.exercises) {
    const primaries = library.variants.filter((v) => v.exerciseId === e.id && v.isPrimary).length;
    if (primaries !== 1)
      issues.push(
        `${e.id}: debe tener exactamente una variante de referencia (tiene ${primaries}).`,
      );
  }
  const edges = new Set<string>();
  for (const link of library.links) {
    const key = `${link.fromVariantId}>${link.toVariantId}`;
    if (link.fromVariantId === link.toVariantId)
      issues.push(`Progresión de una variante hacia sí misma: ${link.fromVariantId}.`);
    if (edges.has(key)) issues.push(`Progresión duplicada: ${key}.`);
    if (edges.has(`${link.toVariantId}>${link.fromVariantId}`))
      issues.push(`Progresión circular: ${key}.`);
    if (!variantIds.has(link.fromVariantId) || !variantIds.has(link.toVariantId))
      issues.push(`Progresión con variantes inexistentes: ${key}.`);
    edges.add(key);
  }
  return issues;
}
