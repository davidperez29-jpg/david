import { normalizeForSearch } from '../text';
import { type Exercise, type ExerciseVariant, VISIBILITY_LABELS } from './exercise';
import {
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  isWithin,
  LATERALITY_LABELS,
  type Taxonomy,
} from './taxonomy';

/** Dimensiones por las que se puede filtrar. Son independientes y combinables. */
export const FACETS = [
  'tag',
  'pattern',
  'equipment',
  'region',
  'laterality',
  'environment',
  'complexity',
  'origin',
] as const;
export type Facet = (typeof FACETS)[number];

export const FACET_LABELS: Record<Facet, string> = {
  tag: 'Etiquetas',
  pattern: 'Patrón de movimiento',
  equipment: 'Material',
  region: 'Región corporal',
  laterality: 'Ejecución',
  environment: 'Entorno',
  complexity: 'Complejidad',
  origin: 'Origen',
};

export interface FacetFilter {
  facet: Facet;
  id: string;
}

/**
 * - `all` (AND): el ejercicio cumple todos los filtros seleccionados.
 * - `any` (OR): cumple al menos uno.
 * El texto de búsqueda, si lo hay, siempre debe coincidir.
 */
export type MatchMode = 'all' | 'any';
export type SortOrder = 'name' | 'complexity' | 'exercise';

export interface LibraryQuery {
  text?: string;
  filters: readonly FacetFilter[];
  mode: MatchMode;
  sort?: SortOrder;
  /** `primary`: los filtros de patrón solo cuentan el patrón principal del ejercicio. */
  patternRole?: 'any' | 'primary';
}

/** ¿Cumple la variante un filtro concreto? Las dimensiones jerárquicas incluyen los subtipos. */
export function matchesFilter(
  variant: ExerciseVariant,
  filter: FacetFilter,
  taxonomy: Taxonomy,
  patternRole: LibraryQuery['patternRole'] = 'any',
): boolean {
  switch (filter.facet) {
    case 'tag':
      return variant.tagIds.includes(filter.id);
    case 'pattern':
      return variant.patterns.some(
        (p) =>
          (patternRole === 'any' || p.role === 'primary') &&
          isWithin(taxonomy.patterns, p.id, filter.id),
      );
    case 'equipment':
      return variant.equipmentIds.some((id) => isWithin(taxonomy.equipment, id, filter.id));
    case 'region':
      return variant.regionIds.some((id) => isWithin(taxonomy.regions, id, filter.id));
    case 'environment':
      return variant.environmentIds.includes(filter.id);
    case 'laterality':
      return variant.laterality === filter.id;
    case 'complexity':
      return variant.complexity === filter.id;
    case 'origin':
      return variant.visibility === filter.id;
  }
}

/** Nombre visible de un valor de filtro (para chips y resúmenes). */
export function filterLabel(filter: FacetFilter, taxonomy: Taxonomy): string {
  const find = (items: readonly { id: string; name: string }[]) =>
    items.find((i) => i.id === filter.id)?.name ?? filter.id;
  switch (filter.facet) {
    case 'tag':
      return find(taxonomy.tags);
    case 'pattern':
      return find(taxonomy.patterns);
    case 'equipment':
      return find(taxonomy.equipment);
    case 'region':
      return find(taxonomy.regions);
    case 'environment':
      return find(taxonomy.environments);
    case 'laterality':
      return LATERALITY_LABELS[filter.id as keyof typeof LATERALITY_LABELS] ?? filter.id;
    case 'complexity':
      return COMPLEXITY_LABELS[filter.id as keyof typeof COMPLEXITY_LABELS] ?? filter.id;
    case 'origin':
      return VISIBILITY_LABELS[filter.id as keyof typeof VISIBILITY_LABELS] ?? filter.id;
  }
}

function searchableText(
  variant: ExerciseVariant,
  exercise: Exercise | undefined,
  taxonomy: Taxonomy,
): string[] {
  const names = (ids: string[], items: readonly { id: string; name: string }[]) =>
    ids.map((id) => items.find((i) => i.id === id)?.name ?? '');
  return [
    variant.name,
    exercise?.name ?? '',
    ...names(variant.tagIds, taxonomy.tags),
    ...names(
      variant.patterns.map((p) => p.id),
      taxonomy.patterns,
    ),
    LATERALITY_LABELS[variant.laterality],
    ...names(variant.environmentIds, taxonomy.environments),
    ...names(variant.equipmentIds, taxonomy.equipment),
    ...names(variant.regionIds, taxonomy.regions),
  ];
}

export function searchLibrary(
  variants: readonly ExerciseVariant[],
  exercises: readonly Exercise[],
  query: LibraryQuery,
  taxonomy: Taxonomy,
): ExerciseVariant[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  // Búsqueda por palabras: cada palabra debe aparecer en algún dato del ejercicio
  // («salto unilateral» encuentra saltos con ejecución unilateral).
  const words = normalizeForSearch(query.text ?? '')
    .split(' ')
    .filter(Boolean);

  const results = variants.filter((variant) => {
    if (words.length > 0) {
      const text = searchableText(variant, exerciseById.get(variant.exerciseId), taxonomy).map(
        normalizeForSearch,
      );
      if (!words.every((word) => text.some((value) => value.includes(word)))) return false;
    }
    if (query.filters.length === 0) return true;
    const check = (filter: FacetFilter) =>
      matchesFilter(variant, filter, taxonomy, query.patternRole);
    return query.mode === 'all' ? query.filters.every(check) : query.filters.some(check);
  });

  const byName = (a: ExerciseVariant, b: ExerciseVariant) => a.name.localeCompare(b.name, 'es');
  switch (query.sort ?? 'name') {
    case 'complexity':
      return results.sort(
        (a, b) =>
          COMPLEXITIES.indexOf(a.complexity) - COMPLEXITIES.indexOf(b.complexity) || byName(a, b),
      );
    case 'exercise':
      return results.sort((a, b) => {
        const ea = exerciseById.get(a.exerciseId)?.name ?? '';
        const eb = exerciseById.get(b.exerciseId)?.name ?? '';
        return (
          ea.localeCompare(eb, 'es') || Number(b.isPrimary) - Number(a.isPrimary) || byName(a, b)
        );
      });
    default:
      return results.sort(byName);
  }
}

/** Añade o quita un filtro (los resultados se recalculan sin recargar la página). */
export function toggleFilter(filters: readonly FacetFilter[], filter: FacetFilter): FacetFilter[] {
  const exists = filters.some((f) => f.facet === filter.facet && f.id === filter.id);
  return exists
    ? filters.filter((f) => !(f.facet === filter.facet && f.id === filter.id))
    : [...filters, filter];
}
