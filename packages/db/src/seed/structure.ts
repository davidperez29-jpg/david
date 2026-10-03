import { and, eq, isNull } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../client';
import {
  exerciseCategories,
  movementPatterns,
  muscles,
  outcomes,
  populations,
  prescriptionProfiles,
  prescriptionVariables,
} from '../schema';

/**
 * Structural catalogues for Phase 2 (taxonomies and programming variables). These are
 * descriptive vocabularies, not scientific claims. Global (organization_id NULL) and
 * editable/extendable per organization.
 */

/** Movement patterns used by the user's methodology workbooks (17), §18.1. */
export const MOVEMENT_PATTERNS: [string, string, string][] = [
  ['knee_dominant', 'Dominante de rodilla', 'lower'],
  ['hip_dominant', 'Dominante de cadera', 'lower'],
  ['horizontal_push', 'Empuje horizontal', 'upper'],
  ['vertical_push', 'Empuje vertical', 'upper'],
  ['horizontal_pull', 'Tracción horizontal', 'upper'],
  ['vertical_pull', 'Tracción vertical', 'upper'],
  ['core_anti_extension', 'Core antiextensión', 'trunk'],
  ['core_anti_rotation', 'Core antirrotación / rotación', 'trunk'],
  ['core_anti_lateral_flexion', 'Core antiflexión lateral', 'trunk'],
  ['carry', 'Transporte (carry)', 'full_body'],
  ['jump_plyometric', 'Salto / pliometría', 'power'],
  ['throw', 'Lanzamiento', 'power'],
  ['triple_extension', 'Triple extensión (olímpicos y derivados)', 'power'],
  ['sprint_cod', 'Sprint / cambio de dirección', 'locomotion'],
  ['mobility_activation', 'Movilidad / activación', 'mobility'],
  ['isolation', 'Aislamiento', 'accessory'],
  ['conditioning', 'Acondicionamiento', 'conditioning'],
];

/** Anatomical muscles with the group used for weekly set counts (groups from the workbooks). */
export const MUSCLES: [string, string, string, 'lower' | 'upper' | 'trunk'][] = [
  ['quadriceps', 'Cuádriceps', 'quadriceps', 'lower'],
  ['gluteus_maximus', 'Glúteo mayor', 'glutes', 'lower'],
  ['gluteus_medius', 'Glúteo medio', 'glutes', 'lower'],
  ['hamstrings', 'Isquiosurales', 'hamstrings', 'lower'],
  ['adductors', 'Aductores', 'adductors', 'lower'],
  ['hip_flexors', 'Flexores de cadera (psoas-ilíaco)', 'hip_flexors', 'lower'],
  ['gastrocnemius', 'Gastrocnemio', 'calves', 'lower'],
  ['soleus', 'Sóleo', 'calves', 'lower'],
  ['tibialis_anterior', 'Tibial anterior', 'lower_leg', 'lower'],
  ['foot_intrinsics', 'Musculatura intrínseca del pie', 'foot', 'lower'],
  ['pectoralis_major', 'Pectoral mayor', 'chest', 'upper'],
  ['latissimus_dorsi', 'Dorsal ancho', 'back', 'upper'],
  ['trapezius', 'Trapecio', 'back', 'upper'],
  ['rhomboids', 'Romboides', 'back', 'upper'],
  ['anterior_deltoid', 'Deltoides anterior', 'deltoids', 'upper'],
  ['lateral_deltoid', 'Deltoides medio', 'deltoids', 'upper'],
  ['posterior_deltoid', 'Deltoides posterior', 'deltoids', 'upper'],
  ['rotator_cuff', 'Manguito rotador', 'rotator_cuff', 'upper'],
  ['serratus_anterior', 'Serrato anterior', 'scapular', 'upper'],
  ['biceps_brachii', 'Bíceps braquial', 'biceps', 'upper'],
  ['triceps_brachii', 'Tríceps braquial', 'triceps', 'upper'],
  ['forearm', 'Musculatura del antebrazo', 'forearm', 'upper'],
  ['rectus_abdominis', 'Recto abdominal', 'core', 'trunk'],
  ['obliques', 'Oblicuos', 'core', 'trunk'],
  ['transversus_abdominis', 'Transverso del abdomen', 'core', 'trunk'],
  ['erector_spinae', 'Erectores espinales', 'lower_back', 'trunk'],
];

/** Display names of muscle groups (used to count weekly sets per group). */
export const MUSCLE_GROUP_NAMES: Record<string, string> = {
  quadriceps: 'Cuádriceps',
  glutes: 'Glúteos',
  hamstrings: 'Isquiosurales',
  adductors: 'Aductores',
  hip_flexors: 'Flexores de cadera',
  calves: 'Gemelo-sóleo',
  lower_leg: 'Tibial anterior',
  foot: 'Pie',
  chest: 'Pectoral',
  back: 'Espalda',
  deltoids: 'Deltoides',
  rotator_cuff: 'Manguito rotador',
  scapular: 'Escápula',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearm: 'Antebrazo',
  core: 'Core',
  lower_back: 'Zona lumbar',
};

/** Exercise categories (§15). An exercise may carry several. */
export const EXERCISE_CATEGORIES: [string, string][] = [
  ['strength', 'Fuerza'],
  ['hypertrophy', 'Hipertrofia'],
  ['power', 'Potencia'],
  ['plyometrics', 'Pliometría'],
  ['isometric', 'Isométricos'],
  ['eccentric', 'Excéntricos'],
  ['eccentric_overload', 'Sobrecarga excéntrica'],
  ['ballistic', 'Balísticos'],
  ['mobility', 'Movilidad'],
  ['motor_control', 'Control motor'],
  ['core', 'Core'],
  ['stability', 'Estabilidad'],
  ['balance', 'Equilibrio'],
  ['coordination', 'Coordinación'],
  ['sprint', 'Sprint'],
  ['acceleration', 'Aceleración'],
  ['cod', 'Cambio de dirección'],
  ['agility', 'Agilidad'],
  ['endurance', 'Resistencia'],
  ['aerobic_capacity', 'Capacidad aeróbica'],
  ['reconditioning', 'Reacondicionamiento'],
  ['sport_specific', 'Específico deportivo'],
  ['accommodating_resistance', 'Resistencias acomodadas'],
  ['olympic_lifts', 'Olímpicos y derivados'],
];

/** Programming variables (§12.4). `typed` = stored in a typed column of session_exercises. */
export const PRESCRIPTION_VARIABLES: {
  key: string;
  name: string;
  unit: string | null;
  type: 'integer' | 'number' | 'range' | 'text' | 'enum' | 'tempo' | 'json';
  min?: string;
  max?: string;
  typed: boolean;
  enumValues?: string[];
}[] = [
  { key: 'sets', name: 'Series', unit: null, type: 'integer', min: '1', max: '20', typed: true },
  {
    key: 'reps',
    name: 'Repeticiones',
    unit: null,
    type: 'range',
    min: '1',
    max: '100',
    typed: true,
  },
  {
    key: 'reps_per_cluster',
    name: 'Repeticiones por bloque (cluster)',
    unit: null,
    type: 'integer',
    min: '1',
    max: '20',
    typed: true,
  },
  {
    key: 'intra_cluster_rest',
    name: 'Pausa intra-cluster',
    unit: 's',
    type: 'integer',
    min: '0',
    max: '120',
    typed: true,
  },
  {
    key: 'duration',
    name: 'Tiempo',
    unit: 's',
    type: 'integer',
    min: '1',
    max: '7200',
    typed: true,
  },
  { key: 'distance', name: 'Distancia', unit: 'm', type: 'number', min: '0', typed: true },
  {
    key: 'contacts',
    name: 'Contactos',
    unit: null,
    type: 'integer',
    min: '0',
    max: '500',
    typed: true,
  },
  { key: 'load', name: 'Carga', unit: 'kg', type: 'number', min: '0', typed: true },
  { key: 'pct_1rm', name: '%1RM', unit: '%', type: 'number', min: '0', max: '110', typed: true },
  {
    key: 'rir',
    name: 'Repeticiones en reserva (RIR)',
    unit: null,
    type: 'range',
    min: '0',
    max: '10',
    typed: true,
  },
  { key: 'rpe', name: 'RPE', unit: null, type: 'number', min: '1', max: '10', typed: true },
  { key: 'effort_character', name: 'Carácter del esfuerzo', unit: null, type: 'text', typed: true },
  {
    key: 'velocity_target',
    name: 'Velocidad objetivo',
    unit: 'm/s',
    type: 'number',
    min: '0',
    max: '5',
    typed: true,
  },
  {
    key: 'velocity_loss',
    name: 'Pérdida de velocidad',
    unit: '%',
    type: 'integer',
    min: '0',
    max: '60',
    typed: true,
  },
  { key: 'tempo', name: 'Tempo (exc-pausa-con-pausa)', unit: null, type: 'tempo', typed: true },
  { key: 'rest', name: 'Descanso', unit: 's', type: 'integer', min: '0', max: '900', typed: true },
  {
    key: 'rom',
    name: 'Rango de movimiento',
    unit: null,
    type: 'enum',
    typed: true,
    enumValues: ['full', 'partial_lengthened', 'partial_shortened', 'specified'],
  },
  { key: 'intensity_note', name: 'Intensidad (otra)', unit: null, type: 'text', typed: true },
  {
    key: 'band_tension',
    name: 'Tensión de banda (banda + posición + RIR)',
    unit: null,
    type: 'json',
    typed: true,
  },
  { key: 'chain_load', name: 'Carga de cadena', unit: 'kg', type: 'number', min: '0', typed: true },
  {
    key: 'pct_mvc',
    name: '%CVM (isométrico)',
    unit: '%',
    type: 'number',
    min: '0',
    max: '100',
    typed: false,
  },
  {
    key: 'joint_angle',
    name: 'Ángulo articular',
    unit: '°',
    type: 'number',
    min: '0',
    max: '180',
    typed: false,
  },
  {
    key: 'pct_vmax',
    name: '%Velocidad máxima',
    unit: '%',
    type: 'number',
    min: '0',
    max: '100',
    typed: false,
  },
  {
    key: 'box_height',
    name: 'Altura de caída / cajón',
    unit: 'cm',
    type: 'number',
    min: '0',
    max: '120',
    typed: false,
  },
  { key: 'sled_load', name: 'Carga de trineo', unit: 'kg', type: 'number', min: '0', typed: false },
  {
    key: 'heart_rate_zone',
    name: 'Zona de frecuencia cardiaca',
    unit: null,
    type: 'text',
    typed: false,
  },
  {
    key: 'work_rest_ratio',
    name: 'Relación trabajo:pausa',
    unit: null,
    type: 'text',
    typed: false,
  },
  {
    key: 'cod_angle',
    name: 'Ángulo de cambio de dirección',
    unit: '°',
    type: 'number',
    min: '0',
    max: '180',
    typed: false,
  },
];

/** Default visible variables per kind of exercise (§12.5). */
export const PRESCRIPTION_PROFILES: [string, string, string[]][] = [
  ['loaded_dynamic', 'Fuerza / hipertrofia', ['sets', 'reps', 'load', 'pct_1rm', 'rir', 'rest']],
  ['vbt', 'Fuerza con VBT', ['sets', 'reps', 'load', 'velocity_target', 'velocity_loss', 'rest']],
  ['isometric', 'Isométrico', ['sets', 'duration', 'pct_mvc', 'joint_angle', 'rest']],
  ['plyometric', 'Pliometría', ['sets', 'contacts', 'box_height', 'rest']],
  ['sprint', 'Sprint / aceleración', ['reps', 'distance', 'pct_vmax', 'rest']],
  ['cod', 'Cambio de dirección / agilidad', ['reps', 'cod_angle', 'distance', 'rest']],
  [
    'conditioning',
    'Resistencia / acondicionamiento',
    ['duration', 'distance', 'heart_rate_zone', 'work_rest_ratio', 'rpe'],
  ],
  ['mobility', 'Movilidad / control motor', ['sets', 'reps', 'duration', 'rom']],
  ['core', 'Core / estabilidad', ['sets', 'reps', 'duration', 'load', 'rest']],
  [
    'accommodating',
    'Resistencias acomodadas',
    ['sets', 'reps', 'load', 'band_tension', 'chain_load', 'rir', 'rest'],
  ],
];

/** Population taxonomy for applicability checks (§10.5). Descriptive only. */
export const POPULATIONS: {
  slug: string;
  name: string;
  ageMin?: number;
  ageMax?: number;
  status:
    'untrained' | 'recreational' | 'trained' | 'highly_trained' | 'elite' | 'mixed' | 'unknown';
  sport?: string;
}[] = [
  {
    slug: 'adults_untrained',
    name: 'Adultos sanos no entrenados',
    ageMin: 18,
    ageMax: 64,
    status: 'untrained',
  },
  {
    slug: 'adults_recreational',
    name: 'Adultos sanos físicamente activos',
    ageMin: 18,
    ageMax: 64,
    status: 'recreational',
  },
  {
    slug: 'adults_resistance_trained',
    name: 'Adultos entrenados en fuerza',
    ageMin: 18,
    ageMax: 64,
    status: 'trained',
  },
  { slug: 'older_adults', name: 'Adultos mayores (≥ 65)', ageMin: 65, status: 'mixed' },
  { slug: 'youth', name: 'Jóvenes (< 18, según maduración)', ageMax: 17, status: 'mixed' },
  { slug: 'team_sport_athletes', name: 'Deportistas de equipo', status: 'trained' },
  { slug: 'football_players', name: 'Futbolistas', status: 'trained', sport: 'football' },
  {
    slug: 'handball_players',
    name: 'Jugadores/as de balonmano',
    status: 'trained',
    sport: 'handball',
  },
  { slug: 'endurance_athletes', name: 'Deportistas de resistencia', status: 'trained' },
  { slug: 'sprinters', name: 'Velocistas', status: 'highly_trained', sport: 'sprint_athletics' },
  { slug: 'powerlifters', name: 'Powerlifters de competición', status: 'highly_trained' },
  {
    slug: 'overhead_athletes',
    name: 'Deportistas de lanzamiento por encima de la cabeza',
    status: 'trained',
  },
  {
    slug: 'collegiate_athletes',
    name: 'Deportistas universitarios (NCAA)',
    ageMin: 18,
    ageMax: 25,
    status: 'highly_trained',
  },
  {
    slug: 'adults_general',
    name: 'Adultos sanos (nivel de actividad mixto o no especificado)',
    ageMin: 18,
    status: 'mixed',
  },
  {
    slug: 'athletes_mixed',
    name: 'Deportistas entrenados (deporte mixto o no especificado)',
    ageMin: 18,
    status: 'trained',
  },
  // Clinical populations: evidence is shown for context only, never used for automatic prescription.
  { slug: 'tendinopathy_patients', name: 'Personas con tendinopatía', status: 'mixed' },
  {
    slug: 'athletes_patellar_tendinopathy',
    name: 'Deportistas con tendinopatía rotuliana',
    status: 'trained',
  },
  {
    slug: 'msk_patients',
    name: 'Pacientes con patología musculoesquelética (solo contexto clínico)',
    ageMin: 18,
    status: 'mixed',
  },
];

export const OUTCOMES: [string, string, string][] = [
  ['max_strength_1rm', 'Fuerza máxima (1RM)', 'strength'],
  ['isometric_strength', 'Fuerza isométrica', 'strength'],
  ['muscle_hypertrophy', 'Hipertrofia muscular', 'muscle'],
  ['jump_height', 'Altura de salto', 'power'],
  ['reactive_strength', 'Fuerza reactiva (RSI)', 'power'],
  ['power_output', 'Potencia', 'power'],
  ['sprint_short', 'Sprint corto / aceleración', 'speed'],
  ['max_sprint_speed', 'Velocidad máxima', 'speed'],
  ['cod_performance', 'Cambio de dirección', 'speed'],
  ['agility', 'Agilidad reactiva', 'speed'],
  ['vo2max', 'VO₂max', 'endurance'],
  ['running_economy', 'Economía de carrera', 'endurance'],
  ['repeated_sprint_ability', 'Capacidad de sprints repetidos', 'endurance'],
  ['physical_function', 'Función física', 'health'],
  ['balance', 'Equilibrio', 'health'],
  ['range_of_motion', 'Rango de movimiento', 'mobility'],
  ['body_composition', 'Composición corporal', 'body_composition'],
  ['tendon_properties', 'Propiedades del tendón', 'tissue'],
  ['pain', 'Dolor', 'clinical'],
  ['injury_incidence', 'Incidencia de lesiones', 'clinical'],
  ['adherence', 'Adherencia', 'behaviour'],
  ['eccentric_strength', 'Fuerza excéntrica', 'strength'],
  ['load_velocity_relationship', 'Relación carga-velocidad y velocidad en el 1RM', 'strength'],
  [
    'lv_1rm_prediction_validity',
    'Validez de la predicción del 1RM por perfil carga-velocidad',
    'assessment',
  ],
  [
    'effort_prediction_accuracy',
    'Precisión en la estimación del esfuerzo (RIR/RPE)',
    'autoregulation',
  ],
  ['perceived_exertion_rir', 'Esfuerzo percibido / repeticiones en reserva', 'monitoring'],
  ['neuromuscular_fatigue', 'Fatiga neuromuscular (pérdida de velocidad)', 'neuromuscular'],
  ['muscle_activation', 'Activación muscular (EMG)', 'neuromuscular'],
  ['joint_kinematics', 'Cinemática articular (p. ej., valgo de rodilla)', 'biomechanics'],
];

async function insertGlobal<T extends PgTable>(
  db: Database,
  table: T,
  slugCol: string,
  rows: Record<string, unknown>[],
) {
  const t = table as unknown as Record<string, unknown> & PgTable;
  for (const row of rows) {
    const existing = await db
      .select()
      .from(t)
      .where(
        and(isNull(t['organizationId'] as never), eq(t[slugCol] as never, row[slugCol] as never)),
      );
    if (existing.length === 0) await db.insert(t).values(row as never);
  }
}

export async function seedStructure(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const d = tx as unknown as Database;
    await insertGlobal(
      d,
      movementPatterns,
      'slug',
      MOVEMENT_PATTERNS.map(([slug, name, family], i) => ({
        slug,
        name,
        family,
        sortOrder: (i + 1) * 10,
      })),
    );
    await insertGlobal(
      d,
      muscles,
      'slug',
      MUSCLES.map(([slug, name, groupSlug, region]) => ({ slug, name, groupSlug, region })),
    );
    await insertGlobal(
      d,
      exerciseCategories,
      'slug',
      EXERCISE_CATEGORIES.map(([slug, name], i) => ({ slug, name, sortOrder: (i + 1) * 10 })),
    );
    await insertGlobal(
      d,
      prescriptionVariables,
      'key',
      PRESCRIPTION_VARIABLES.map((v, i) => ({
        key: v.key,
        name: v.name,
        unit: v.unit,
        valueType: v.type,
        minValue: v.min ?? null,
        maxValue: v.max ?? null,
        enumValues: v.enumValues ?? null,
        isTypedColumn: v.typed,
        sortOrder: (i + 1) * 10,
      })),
    );
    await insertGlobal(
      d,
      prescriptionProfiles,
      'slug',
      PRESCRIPTION_PROFILES.map(([slug, name, variableKeys]) => ({ slug, name, variableKeys })),
    );
    await insertGlobal(
      d,
      populations,
      'slug',
      POPULATIONS.map((p) => ({
        slug: p.slug,
        name: p.name,
        ageMin: p.ageMin ?? null,
        ageMax: p.ageMax ?? null,
        trainingStatus: p.status,
        sportSlug: p.sport ?? null,
      })),
    );
    await insertGlobal(
      d,
      outcomes,
      'slug',
      OUTCOMES.map(([slug, name, domain]) => ({ slug, name, domain })),
    );
  });
}
