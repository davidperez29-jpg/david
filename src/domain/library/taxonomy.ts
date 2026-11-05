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
  /** Qué agrupa la dimensión (se muestra como ayuda). */
  description?: string;
  owner: Owner;
  order: number;
  /** Las categorías archivadas dejan de mostrarse, pero su id no se reutiliza. */
  archived?: boolean;
}

export interface Tag {
  id: string;
  categoryId: string;
  name: string;
  owner: Owner;
  /** Las etiquetas archivadas dejan de ofrecerse, pero conservan su id en los datos históricos. */
  archived?: boolean;
  /** Si se archivó por haberse dividido o renombrado, etiquetas que la sustituyen. */
  replacedBy?: string[];
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

/**
 * Cuatro dimensiones independientes y combinables. Un ejercicio puede tener varias etiquetas de
 * cada una. Los ids son estables: «capacity» y «method» conservan su id aunque cambie su nombre,
 * y «control» se archivó al integrarse sus etiquetas en «Cualidades y objetivos».
 */
export const SYSTEM_TAG_CATEGORIES: readonly TagCategory[] = [
  {
    id: 'capacity',
    name: 'Cualidades y objetivos',
    description: 'Qué cualidad se desarrolla o qué objetivo persigue el ejercicio.',
    owner: SYSTEM,
    order: 1,
  },
  {
    id: 'method',
    name: 'Métodos y formas de entrenamiento',
    description: 'Cómo se organiza o se ejecuta el entrenamiento.',
    owner: SYSTEM,
    order: 2,
  },
  {
    id: 'muscle-action',
    name: 'Acciones musculares y ejecución',
    description: 'Tipo de acción muscular que se enfatiza.',
    owner: SYSTEM,
    order: 3,
  },
  {
    id: 'application',
    name: 'Aplicaciones y evaluación',
    description: 'Usos concretos del ejercicio, como la evaluación o la programación por %1RM.',
    owner: SYSTEM,
    order: 4,
  },
  { id: 'control', name: 'Control y estabilidad', owner: SYSTEM, order: 99, archived: true },
];

const tag = (categoryId: string, id: string, name: string): Tag => ({
  id,
  categoryId,
  name,
  owner: SYSTEM,
});

export const SYSTEM_TAGS: readonly Tag[] = [
  // A. Cualidades y objetivos
  tag('capacity', 'power', 'Potencia'),
  tag('capacity', 'explosive-strength', 'Fuerza explosiva'),
  tag('capacity', 'max-strength', 'Fuerza máxima'),
  tag('capacity', 'hypertrophy', 'Hipertrofia'),
  tag('capacity', 'strength-endurance', 'Fuerza-resistencia'),
  tag('capacity', 'general-strength', 'Fuerza general'),
  tag('capacity', 'stability', 'Estabilidad'),
  tag('capacity', 'core', 'Core'),
  tag('capacity', 'coordination', 'Coordinación'),
  tag('capacity', 'balance', 'Equilibrio'),
  tag('capacity', 'motor-control', 'Control motor'),
  // B. Métodos y formas de entrenamiento
  tag('method', 'plyometric', 'Pliometría'),
  tag('method', 'contrast', 'Contraste'),
  tag('method', 'oscillatory', 'Entrenamiento oscilatorio'),
  tag('method', 'ballistic', 'Balístico'),
  tag('method', 'max-velocity-intent', 'Intención de máxima velocidad'),
  // C. Acciones musculares y características de ejecución
  tag('muscle-action', 'concentric', 'Concéntrico'),
  tag('muscle-action', 'eccentric', 'Excéntrico'),
  tag('muscle-action', 'isometric', 'Isométrico'),
  tag('muscle-action', 'ssc', 'Ciclo estiramiento-acortamiento'),
  // D. Aplicaciones y evaluación
  tag('application', 'one-rm-test', 'Test o evaluación de 1RM'),
  tag('application', 'percent-1rm', 'Trabajo con porcentajes de 1RM'),
  // Archivada: «1RM» mezclaba evaluación y programación; se dividió en las dos anteriores.
  {
    ...tag('application', 'one-rm', '1RM'),
    archived: true,
    replacedBy: ['one-rm-test', 'percent-1rm'],
  },
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

/**
 * Patrones de movimiento. Cada ejercicio se asocia a subtipos (hojas), con un patrón principal y,
 * si procede, secundarios. Se distinguen conceptos biomecánicamente distintos:
 * - «Dominante de cadera» (tren inferior) es un patrón global bajo carga (bisagra, puente);
 *   «Flexión/extensión de cadera» es el movimiento de la articulación con el tronco estable.
 * - Los movimientos de tronco (flexión, extensión…) no equivalen a los de cadera.
 * - La ejecución unilateral o bilateral NO es un patrón: es la dimensión «Ejecución», que se
 *   combina con los saltos y los aterrizajes (p. ej., «Salto vertical» + «Unilateral»).
 */
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
  node('trunk-anti.lateral-flexion', 'trunk-anti', 'Anti-flexión lateral'),
  node('trunk-anti.flexion', 'trunk-anti', 'Anti-flexión'),
  node('trunk-dynamic', null, 'Core y tronco: movimiento'),
  node('trunk-dynamic.extension', 'trunk-dynamic', 'Extensión de tronco', 'Extensión'),
  node('trunk-dynamic.rotation', 'trunk-dynamic', 'Rotación de tronco', 'Rotación'),
  node(
    'trunk-dynamic.lateral-flexion',
    'trunk-dynamic',
    'Flexión lateral de tronco',
    'Flexión lateral',
  ),
  node('trunk-dynamic.flexion', 'trunk-dynamic', 'Flexión de tronco', 'Flexión'),
  node('hip-motion', null, 'Cadera: flexión y extensión'),
  node('hip-motion.flexion', 'hip-motion', 'Flexión de cadera', 'Flexión'),
  node('hip-motion.extension', 'hip-motion', 'Extensión de cadera', 'Extensión'),
  node('locomotion', null, 'Locomoción'),
  node('locomotion.running', 'locomotion', 'Carrera'),
  node('locomotion.acceleration', 'locomotion', 'Aceleración'),
  node('locomotion.deceleration', 'locomotion', 'Desaceleración'),
  node('locomotion.change-of-direction', 'locomotion', 'Cambio de dirección'),
  node('locomotion.lateral', 'locomotion', 'Desplazamiento lateral'),
  node('locomotion.multidirectional', 'locomotion', 'Desplazamiento multidireccional'),
  node('jump', null, 'Saltos'),
  node('jump.vertical', 'jump', 'Salto vertical', 'Vertical'),
  node('jump.horizontal', 'jump', 'Salto horizontal', 'Horizontal'),
  node('jump.lateral', 'jump', 'Salto lateral', 'Lateral'),
  node('landing', null, 'Aterrizajes'),
  node('landing.vertical', 'landing', 'Aterrizaje en el sitio', 'En el sitio'),
  node('landing.forward', 'landing', 'Aterrizaje hacia delante', 'Hacia delante'),
  node('landing.lateral', 'landing', 'Aterrizaje lateral', 'Lateral'),
  node('landing.multidirectional', 'landing', 'Aterrizaje multidireccional', 'Multidireccional'),
  node('carry', null, 'Transporte de cargas'),
  node('carry.farmer', 'carry', 'Farmer carry (carga a ambos lados)', 'Farmer carry'),
  node('carry.suitcase', 'carry', 'Suitcase carry (carga a un lado)', 'Suitcase carry'),
  node('carry.front-rack', 'carry', 'Front rack carry (carga delante)', 'Front rack carry'),
  node(
    'carry.overhead',
    'carry',
    'Overhead carry (carga por encima de la cabeza)',
    'Overhead carry',
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

/** ¿Es una hoja (sin subtipos)? A los ejercicios se les asignan hojas, no grupos. */
export function isLeaf(nodes: readonly TaxonomyNode[], id: string): boolean {
  return nodes.some((n) => n.id === id) && !nodes.some((n) => n.parentId === id);
}

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
