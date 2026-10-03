/**
 * Mapping from the user's workbook vocabulary to platform taxonomies (§18.1 migration).
 * Everything derived here is a *suggestion* and imported exercises carry needs_review = true.
 */
import { normalizeName } from '@tp/domain';

export interface BlockHint {
  categories: string[];
  pattern?: string;
  primaryMuscles?: string[];
  profile?: string;
}

/** "Bloque de sesión" values of the Banco sheet. Matched by normalized prefix, longest first. */
export const BLOCK_HINTS: [string, BlockHint][] = [
  ['Fuerza · Dominante de rodilla', { categories: ['strength'], pattern: 'knee_dominant' }],
  ['Fuerza · Dominante de cadera', { categories: ['strength'], pattern: 'hip_dominant' }],
  ['Fuerza · Empuje', { categories: ['strength'] }],
  ['Fuerza · Tracción', { categories: ['strength'] }],
  [
    'Hipertrofia · Bíceps',
    { categories: ['hypertrophy'], pattern: 'isolation', primaryMuscles: ['biceps_brachii'] },
  ],
  [
    'Hipertrofia · Tríceps',
    { categories: ['hypertrophy'], pattern: 'isolation', primaryMuscles: ['triceps_brachii'] },
  ],
  ['Hipertrofia · Cuádriceps', { categories: ['hypertrophy'], primaryMuscles: ['quadriceps'] }],
  ['Hipertrofia · Espalda', { categories: ['hypertrophy'], primaryMuscles: ['latissimus_dorsi'] }],
  ['Hipertrofia · Glúteos', { categories: ['hypertrophy'], primaryMuscles: ['gluteus_maximus'] }],
  ['Hipertrofia · Hombro', { categories: ['hypertrophy'], primaryMuscles: ['lateral_deltoid'] }],
  ['Hipertrofia · Pecho', { categories: ['hypertrophy'], primaryMuscles: ['pectoralis_major'] }],
  [
    'Core · Lateral',
    {
      categories: ['core'],
      pattern: 'core_anti_lateral_flexion',
      primaryMuscles: ['obliques'],
      profile: 'core',
    },
  ],
  [
    'Core · Pilar',
    {
      categories: ['core'],
      pattern: 'core_anti_extension',
      primaryMuscles: ['rectus_abdominis'],
      profile: 'core',
    },
  ],
  [
    'Core · Rotación',
    {
      categories: ['core'],
      pattern: 'core_anti_rotation',
      primaryMuscles: ['obliques'],
      profile: 'core',
    },
  ],
  [
    'Acondicionamiento',
    { categories: ['endurance'], pattern: 'conditioning', profile: 'conditioning' },
  ],
  [
    'Activación · Técnica de carrera',
    { categories: ['sprint', 'coordination'], pattern: 'sprint_cod', profile: 'sprint' },
  ],
  [
    'Activación',
    {
      categories: ['mobility', 'motor_control'],
      pattern: 'mobility_activation',
      profile: 'mobility',
    },
  ],
  [
    'Calentamiento completo',
    { categories: ['mobility'], pattern: 'mobility_activation', profile: 'mobility' },
  ],
  ['Agilidad reactiva', { categories: ['agility'], pattern: 'sprint_cod', profile: 'cod' }],
  ['Cambio de dirección', { categories: ['cod'], pattern: 'sprint_cod', profile: 'cod' }],
  [
    'Velocidad y aceleración',
    { categories: ['sprint', 'acceleration'], pattern: 'sprint_cod', profile: 'sprint' },
  ],
  [
    'Pliometría',
    { categories: ['plyometrics'], pattern: 'jump_plyometric', profile: 'plyometric' },
  ],
  ['Potencia', { categories: ['power'] }],
  [
    'Batería preventiva · Tipo 1',
    { categories: ['mobility'], pattern: 'mobility_activation', profile: 'mobility' },
  ],
  ['Batería preventiva · Tipo 2', { categories: ['motor_control', 'stability'], profile: 'core' }],
  ['Batería preventiva · Tipo 3', { categories: ['strength'] }],
  ['Batería preventiva · Tipo 4', { categories: ['sport_specific'] }],
  ['Personalizado · Isometría', { categories: ['isometric'], profile: 'isometric' }],
  [
    'Personalizado · Pre-pliometría',
    { categories: ['plyometrics'], pattern: 'jump_plyometric', profile: 'plyometric' },
  ],
  [
    'Personalizado · Desaceleración',
    { categories: ['cod'], pattern: 'sprint_cod', profile: 'cod' },
  ],
  ['Personalizado · Bisagra de cadera', { categories: ['strength'], pattern: 'hip_dominant' }],
  ['Personalizado · Core', { categories: ['core'], profile: 'core' }],
  ['Personalizado · Oscilatorio', { categories: ['stability'] }],
  [
    'Personalizado · Activación',
    { categories: ['motor_control'], pattern: 'mobility_activation', profile: 'mobility' },
  ],
  ['Personalizado · Salud', { categories: ['strength'] }],
];

export function blockHint(block: string): BlockHint | null {
  const nb = normalizeName(block);
  const sorted = [...BLOCK_HINTS].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, hint] of sorted) if (nb.startsWith(normalizeName(prefix))) return hint;
  return null;
}

/** Meso sheet "Patrón de movimiento" values → pattern slugs. */
export const MESO_PATTERNS: Record<string, string> = {
  'Dominante de rodilla': 'knee_dominant',
  'Dominante de cadera': 'hip_dominant',
  'Empuje horizontal': 'horizontal_push',
  'Empuje vertical': 'vertical_push',
  'Tracción horizontal': 'horizontal_pull',
  'Tracción vertical': 'vertical_pull',
  'Core antiextensión': 'core_anti_extension',
  'Core antirrotación / rotación': 'core_anti_rotation',
  'Core antiflexión lateral': 'core_anti_lateral_flexion',
  'Transporte (carry)': 'carry',
  'Salto / pliometría': 'jump_plyometric',
  Lanzamiento: 'throw',
  'Triple extensión (olímpicos)': 'triple_extension',
  'Sprint / cambio de dirección': 'sprint_cod',
  'Movilidad / activación': 'mobility_activation',
  Aislamiento: 'isolation',
  Acondicionamiento: 'conditioning',
};

/** Meso muscle groups (11) → a representative muscle of the platform group. */
export const MESO_GROUPS: Record<string, string> = {
  Cuádriceps: 'quadriceps',
  Glúteo: 'gluteus_maximus',
  Isquiosurales: 'hamstrings',
  Aductores: 'adductors',
  'Gemelo-sóleo': 'gastrocnemius',
  Pectoral: 'pectoralis_major',
  'Espalda (dorsal-trapecio)': 'latissimus_dorsi',
  Deltoides: 'lateral_deltoid',
  Bíceps: 'biceps_brachii',
  Tríceps: 'triceps_brachii',
  Core: 'rectus_abdominis',
};

export const MESO_QUALITIES: Record<string, string[]> = {
  'Movilidad y activación': ['mobility'],
  'Core y prevención': ['core'],
  'Pliometría / reactiva': ['plyometrics'],
  'Potencia / fuerza rápida': ['power'],
  'Fuerza máxima': ['strength'],
  Hipertrofia: ['hypertrophy'],
  'Fuerza excéntrica-isométrica': ['eccentric'],
  'Adaptación / resistencia de fuerza': ['strength'],
  Acondicionamiento: ['endurance'],
};

export const BATTERY_MODES: Record<string, string[]> = {
  Excéntrico: ['eccentric'],
  'Excéntrico progresivo': ['eccentric'],
  Isométrico: ['isometric'],
  'Concéntrico controlado': ['concentric'],
  'Concéntrico-excéntrico': ['concentric', 'eccentric'],
};

/** Equipment deduced from words in the exercise name (flagged for review). Whole-word, accent-insensitive. */
export const EQUIPMENT_KEYWORDS: [RegExp, string][] = [
  [/\b(barra|barbell)\b/, 'barbell'],
  [/\b(mancuerna|mancuernas|dumbbell|db)\b/, 'dumbbells'],
  [/\b(kettlebell|kettlebells|kb|pesa rusa)\b/, 'kettlebells'],
  [/\b(polea|poleas|cable)\b/, 'cable_station'],
  [/\b(goma|gomas|banda|bandas|elastico|elasticos|miniband)\b/, 'resistance_bands'],
  [/\b(cadena|cadenas)\b/, 'chains'],
  [/\b(trx|suspension)\b/, 'suspension_trainer'],
  [/\b(balon medicinal|medicine ball|fitball)\b/, 'medicine_ball'],
  [/\b(cajon|box)\b/, 'plyo_box'],
  [/\b(step)\b/, 'step'],
  [/\b(landmine)\b/, 'landmine'],
  [/\b(trineo|sled)\b/, 'sled'],
  [/\b(dominada|dominadas|chin up|pull up)\b/, 'pull_up_bar'],
  [/\b(prensa)\b/, 'leg_press'],
  [/\b(banco|banca)\b/, 'bench'],
  [/\b(conos|cono)\b/, 'cones'],
  [/\b(foam roller|rodillo)\b/, 'foam_roller'],
];

export function equipmentFromName(name: string): string[] {
  const n = normalizeName(name);
  return [...new Set(EQUIPMENT_KEYWORDS.filter(([re]) => re.test(n)).map(([, slug]) => slug))];
}

const FAMILY_REGION: Record<string, 'lower' | 'upper' | 'trunk' | 'full_body' | undefined> = {
  knee_dominant: 'lower',
  hip_dominant: 'lower',
  horizontal_push: 'upper',
  vertical_push: 'upper',
  horizontal_pull: 'upper',
  vertical_pull: 'upper',
  core_anti_extension: 'trunk',
  core_anti_rotation: 'trunk',
  core_anti_lateral_flexion: 'trunk',
  carry: 'full_body',
  triple_extension: 'full_body',
  throw: 'full_body',
};
export const regionForPattern = (slug: string | null) =>
  slug ? (FAMILY_REGION[slug] ?? null) : null;

export function profileFor(
  pattern: string | null,
  categories: string[],
  contraction: string[],
): string {
  if (contraction.includes('isometric') && contraction.length === 1) return 'isometric';
  if (pattern === 'jump_plyometric' || categories.includes('plyometrics')) return 'plyometric';
  if (categories.includes('sprint') || categories.includes('acceleration')) return 'sprint';
  if (categories.includes('cod') || categories.includes('agility')) return 'cod';
  if (pattern === 'conditioning' || categories.includes('endurance')) return 'conditioning';
  if (pattern === 'mobility_activation' || categories.includes('mobility')) return 'mobility';
  if (pattern?.startsWith('core_') || categories.includes('core')) return 'core';
  return 'loaded_dynamic';
}
