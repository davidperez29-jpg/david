import { normalizeForSearch } from '../text';

/**
 * Taxonomía de la biblioteca de ejercicios. Cada dimensión es independiente de las demás:
 * etiquetas (objetivo, capacidad, método), patrones de movimiento, material, región corporal,
 * entorno, ejecución y complejidad. Los identificadores son estables: nunca se reutilizan ni
 * se renombran (el nombre visible sí puede cambiar).
 */

/** Propietario de un elemento: el sistema (catálogo global) o un entrenador concreto. */
export type Owner = { kind: 'system' } | { kind: 'trainer'; trainerId: string };

export const SYSTEM: Owner = { kind: 'system' };

export interface TagCategory {
  id: string;
  name: string;
  owner: Owner;
  order: number;
}

export interface Tag {
  id: string;
  categoryId: string;
  name: string;
  owner: Owner;
  /** Las etiquetas archivadas dejan de ofrecerse, pero conservan su id en los datos históricos. */
  archived?: boolean;
}

/** Elemento de una dimensión jerárquica (patrones, material, regiones). */
export interface TaxonomyNode {
  id: string;
  parentId: string | null;
  name: string;
  /** Nombre corto para mostrar dentro de su grupo (p. ej., «Horizontal» dentro de «Empuje»). */
  shortName?: string;
  owner: Owner;
}

export const LATERALITIES = ['bilateral', 'unilateral', 'alternating'] as const;
export type Laterality = (typeof LATERALITIES)[number];
export const LATERALITY_LABELS: Record<Laterality, string> = {
  bilateral: 'Bilateral',
  unilateral: 'Unilateral',
  alternating: 'Alternante',
};

export const COMPLEXITIES = ['basic', 'intermediate', 'advanced'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];
export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  basic: 'Básica',
  intermediate: 'Intermedia',
  advanced: 'Avanzada',
};

export const SYSTEM_TAG_CATEGORIES: readonly TagCategory[] = [
  { id: 'capacity', name: 'Capacidades y objetivos', owner: SYSTEM, order: 1 },
  { id: 'method', name: 'Métodos y contracciones', owner: SYSTEM, order: 2 },
  { id: 'control', name: 'Control y estabilidad', owner: SYSTEM, order: 3 },
];

const tag = (categoryId: string, id: string, name: string): Tag => ({
  id,
  categoryId,
  name,
  owner: SYSTEM,
});

export const SYSTEM_TAGS: readonly Tag[] = [
  tag('capacity', 'max-strength', 'Fuerza máxima'),
  tag('capacity', 'one-rm', '1RM'),
  tag('capacity', 'power', 'Potencia'),
  tag('capacity', 'explosive-strength', 'Fuerza explosiva'),
  tag('capacity', 'hypertrophy', 'Hipertrofia'),
  tag('capacity', 'strength-endurance', 'Fuerza-resistencia'),
  tag('capacity', 'general-strength', 'Fuerza general'),
  tag('method', 'plyometric', 'Pliometría'),
  tag('method', 'eccentric', 'Excéntrico'),
  tag('method', 'concentric', 'Concéntrico'),
  tag('method', 'isometric', 'Isométrico'),
  tag('method', 'oscillatory', 'Oscilatorio'),
  tag('method', 'contrast', 'Contraste'),
  tag('method', 'ballistic', 'Balístico'),
  tag('control', 'stability', 'Estabilidad'),
  tag('control', 'core', 'Core'),
  tag('control', 'motor-control', 'Control motor'),
  tag('control', 'balance', 'Equilibrio'),
  tag('control', 'coordination', 'Coordinación'),
];

const node = (
  id: string,
  parentId: string | null,
  name: string,
  shortName?: string,
): TaxonomyNode => ({
  id,
  parentId,
  name,
  ...(shortName ? { shortName } : {}),
  owner: SYSTEM,
});

/** Patrones de movimiento: cinco grupos con sus subtipos. Ampliable con nuevos nodos. */
export const SYSTEM_PATTERNS: readonly TaxonomyNode[] = [
  node('push', null, 'Empuje'),
  node('push.horizontal', 'push', 'Empuje horizontal', 'Horizontal'),
  node('push.vertical', 'push', 'Empuje vertical', 'Vertical'),
  node('push.diagonal', 'push', 'Empuje diagonal', 'Diagonal'),
  node('pull', null, 'Tracción'),
  node('pull.horizontal', 'pull', 'Tracción horizontal', 'Horizontal'),
  node('pull.vertical', 'pull', 'Tracción vertical', 'Vertical'),
  node('pull.diagonal', 'pull', 'Tracción diagonal', 'Diagonal'),
  node('lower', null, 'Tren inferior'),
  node('lower.knee', 'lower', 'Dominante de rodilla'),
  node('lower.hip', 'lower', 'Dominante de cadera'),
  node('lower.mixed', 'lower', 'Patrón mixto de tren inferior', 'Patrón mixto'),
  node('trunk-anti', null, 'Core y tronco: anti-movimiento'),
  node('trunk-anti.extension', 'trunk-anti', 'Anti-extensión'),
  node('trunk-anti.rotation', 'trunk-anti', 'Anti-rotación'),
  node('trunk-anti.flexion', 'trunk-anti', 'Anti-flexión'),
  node('trunk-anti.lateral-flexion', 'trunk-anti', 'Anti-flexión lateral'),
  node('trunk-dynamic', null, 'Core y tronco: movimiento dinámico'),
  node('trunk-dynamic.flexion', 'trunk-dynamic', 'Flexión de tronco', 'Flexión'),
  node('trunk-dynamic.extension', 'trunk-dynamic', 'Extensión de tronco', 'Extensión'),
  node('trunk-dynamic.rotation', 'trunk-dynamic', 'Rotación de tronco', 'Rotación'),
  node(
    'trunk-dynamic.lateral-flexion',
    'trunk-dynamic',
    'Flexión lateral de tronco',
    'Flexión lateral',
  ),
];

export const SYSTEM_EQUIPMENT: readonly TaxonomyNode[] = [
  node('bodyweight', null, 'Peso corporal'),
  node('barbell', null, 'Barra'),
  node('dumbbell', null, 'Mancuernas'),
  node('kettlebell', null, 'Kettlebell'),
  node('cable', null, 'Poleas'),
  node('machine', null, 'Máquinas'),
  node('band', null, 'Bandas elásticas'),
  node('medicine-ball', null, 'Balón medicinal'),
  node('box', null, 'Cajón'),
  node('other', null, 'Otros materiales'),
  node('bench', 'other', 'Banco'),
  node('rack', 'other', 'Rack'),
  node('pull-up-bar', 'other', 'Barra fija'),
  node('cones', 'other', 'Conos'),
  node('step', 'other', 'Escalón'),
  node('wall', 'other', 'Pared'),
];

export const SYSTEM_REGIONS: readonly TaxonomyNode[] = [
  node('upper', null, 'Tren superior'),
  node('shoulder', 'upper', 'Hombro'),
  node('lower', null, 'Tren inferior'),
  node('hip', 'lower', 'Cadera'),
  node('knee', 'lower', 'Rodilla'),
  node('ankle', 'lower', 'Tobillo'),
  node('trunk', null, 'Tronco'),
  node('full-body', null, 'Cuerpo completo'),
];

export const SYSTEM_ENVIRONMENTS: readonly TaxonomyNode[] = [
  node('gym', null, 'Gimnasio'),
  node('field', null, 'Campo'),
  node('home', null, 'Domicilio'),
  node('other', null, 'Otros'),
];

export interface Taxonomy {
  tagCategories: readonly TagCategory[];
  tags: readonly Tag[];
  patterns: readonly TaxonomyNode[];
  equipment: readonly TaxonomyNode[];
  regions: readonly TaxonomyNode[];
  environments: readonly TaxonomyNode[];
}

export const SYSTEM_TAXONOMY: Taxonomy = {
  tagCategories: SYSTEM_TAG_CATEGORIES,
  tags: SYSTEM_TAGS,
  patterns: SYSTEM_PATTERNS,
  equipment: SYSTEM_EQUIPMENT,
  regions: SYSTEM_REGIONS,
  environments: SYSTEM_ENVIRONMENTS,
};

/** ¿`id` es `ancestorId` o uno de sus descendientes? (p. ej., «pull.horizontal» está en «pull»). */
export function isWithin(nodes: readonly TaxonomyNode[], id: string, ancestorId: string): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  for (
    let current = byId.get(id);
    current && !seen.has(current.id);
    current = byId.get(current.parentId ?? '')
  ) {
    if (current.id === ancestorId) return true;
    seen.add(current.id);
  }
  return false;
}

/** Elementos visibles para un entrenador: los del sistema y los suyos propios. */
export function visibleTo<T extends { owner: Owner }>(items: readonly T[], trainerId: string): T[] {
  return items.filter((item) => item.owner.kind === 'system' || item.owner.trainerId === trainerId);
}

/**
 * Evita etiquetas duplicadas: devuelve la etiqueta existente (del sistema o del propio
 * entrenador) cuyo nombre coincide sin tildes ni mayúsculas, o `null` si el nombre está libre.
 */
export function findTagConflict(tags: readonly Tag[], name: string, trainerId: string): Tag | null {
  const wanted = normalizeForSearch(name);
  if (wanted === '') return null;
  return visibleTo(tags, trainerId).find((t) => normalizeForSearch(t.name) === wanted) ?? null;
}

/** Reglas de integridad de la taxonomía (se comprueban en los tests). */
export function taxonomyIssues(taxonomy: Taxonomy): string[] {
  const issues: string[] = [];
  const checkUnique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(`${label}: id duplicado «${id}».`);
      seen.add(id);
    }
  };
  checkUnique(
    'Categorías',
    taxonomy.tagCategories.map((c) => c.id),
  );
  checkUnique(
    'Etiquetas',
    taxonomy.tags.map((t) => t.id),
  );
  const categories = new Set(taxonomy.tagCategories.map((c) => c.id));
  for (const t of taxonomy.tags) {
    if (!categories.has(t.categoryId))
      issues.push(`La etiqueta «${t.id}» usa una categoría inexistente.`);
  }
  for (const [label, nodes] of [
    ['Patrones', taxonomy.patterns],
    ['Material', taxonomy.equipment],
    ['Regiones', taxonomy.regions],
    ['Entornos', taxonomy.environments],
  ] as const) {
    checkUnique(
      label,
      nodes.map((n) => n.id),
    );
    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      if (n.parentId !== null && !ids.has(n.parentId))
        issues.push(`${label}: «${n.id}» tiene un padre inexistente.`);
    }
  }
  return issues;
}
