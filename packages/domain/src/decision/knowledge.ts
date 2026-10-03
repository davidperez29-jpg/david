/**
 * Default knowledge of the decision engine (§13.3–13.5): qualities, goal → quality matrix,
 * quality → candidate methods, exercise slots per method and the default rule set. All weights
 * and thresholds are practical, configurable choices (evidence level F) that link to the claims
 * supporting them. Thresholds with no verified universal value default to `null`: the
 * organization must set them consciously (§13.4) — such rules are reported as pending.
 */
import { REFERRAL_TEXT } from '../clients/health';
import type { DecisionRule, Quality } from './types';

export const QUALITIES: Record<Quality, string> = {
  max_strength: 'Fuerza máxima',
  hypertrophy: 'Hipertrofia',
  power: 'Potencia',
  speed: 'Velocidad / aceleración',
  cod: 'Cambio de dirección',
  aerobic: 'Resistencia aeróbica',
  functional: 'Fuerza funcional / función física',
  mobility: 'Movilidad',
};
/** Tie-break order (more general qualities first). */
export const QUALITY_ORDER: Quality[] = [
  'max_strength',
  'power',
  'speed',
  'cod',
  'hypertrophy',
  'functional',
  'aerobic',
  'mobility',
];

/** Goal → base need per quality (0–1). Practical weights (F), editable in a later phase. */
export const GOAL_QUALITY: Record<string, Partial<Record<Quality, number>>> = {
  team_sport_performance: {
    max_strength: 0.6,
    power: 0.6,
    speed: 0.6,
    cod: 0.5,
    aerobic: 0.4,
    hypertrophy: 0.2,
  },
  hypertrophy: { hypertrophy: 0.9, max_strength: 0.4 },
  max_strength: { max_strength: 0.9, hypertrophy: 0.4, power: 0.2 },
  power: { power: 0.9, max_strength: 0.6, speed: 0.3 },
  sprint: { speed: 0.9, power: 0.6, max_strength: 0.5 },
  acceleration: { speed: 0.9, power: 0.6, max_strength: 0.5 },
  change_of_direction: { cod: 0.9, speed: 0.5, power: 0.4, max_strength: 0.4 },
  agility: { cod: 0.9, speed: 0.5, power: 0.4, max_strength: 0.4 },
  general_health: { functional: 0.7, aerobic: 0.6, max_strength: 0.4, mobility: 0.3 },
  functional_strength: { functional: 0.8, max_strength: 0.5 },
  strength_initiation: { functional: 0.6, max_strength: 0.5, hypertrophy: 0.4 },
  endurance_sport_performance: { aerobic: 0.7, max_strength: 0.5, power: 0.4 },
  body_composition: { hypertrophy: 0.6, aerobic: 0.6 },
  mobility: { mobility: 0.9, functional: 0.4 },
  reconditioning: { functional: 0.8, aerobic: 0.4, mobility: 0.4 },
  general_physical_preparation: { functional: 0.5, max_strength: 0.5, aerobic: 0.5, power: 0.3 },
  neuromuscular_capacity: { power: 0.7, max_strength: 0.6, speed: 0.4 },
};

/** Quality → candidate methods, in order of preference (filtered by population and rules). */
export const QUALITY_METHODS: Record<Quality, string[]> = {
  max_strength: [
    'fuerza-maxima',
    'fuerza-mayores',
    'fuerza-jovenes',
    'resistencia-variable',
    'nordic-hamstring',
  ],
  hypertrophy: ['hipertrofia'],
  power: ['potencia', 'pliometria', 'halterofilia-derivados', 'pape-complex-contrast'],
  speed: ['sprint-aceleracion'],
  cod: ['cod-agilidad'],
  aerobic: ['concurrente', 'sprint-repetido'],
  functional: ['fuerza-mayores', 'dosis-minima', 'core'],
  mobility: ['estiramientos-movilidad'],
};

/** Methods that only make sense for some people unless a rule prefers them. */
export const METHOD_ELIGIBILITY: Record<
  string,
  (p: { age: number | null; populations: string[] }) => boolean
> = {
  'fuerza-mayores': (p) => (p.age ?? 0) >= 65,
  'fuerza-jovenes': (p) => p.age != null && p.age < 18,
  'nordic-hamstring': (p) => p.populations.includes('team_sport_athletes'),
  'sprint-repetido': (p) => p.populations.includes('team_sport_athletes'),
  'dosis-minima': () => false,
  'resistencia-variable': (p) => p.populations.includes('adults_resistance_trained'),
};

/** Exercise slots (movement patterns) filled for each method. */
export const METHOD_SLOTS: Record<string, string[]> = {
  'fuerza-maxima': ['knee_dominant', 'hip_dominant', 'horizontal_push', 'horizontal_pull'],
  'fuerza-mayores': ['knee_dominant', 'hip_dominant', 'horizontal_pull', 'carry'],
  'fuerza-jovenes': ['knee_dominant', 'hip_dominant', 'horizontal_push', 'horizontal_pull'],
  hipertrofia: ['knee_dominant', 'hip_dominant', 'horizontal_push', 'vertical_pull', 'isolation'],
  potencia: ['triple_extension', 'throw'],
  pliometria: ['jump_plyometric'],
  'halterofilia-derivados': ['triple_extension'],
  'pape-complex-contrast': ['jump_plyometric'],
  'sprint-aceleracion': ['sprint_cod'],
  'cod-agilidad': ['sprint_cod'],
  'nordic-hamstring': ['hip_dominant'],
  core: ['core_anti_extension', 'core_anti_rotation'],
  'estiramientos-movilidad': ['mobility_activation'],
  'dosis-minima': ['knee_dominant', 'horizontal_push', 'horizontal_pull'],
  concurrente: ['conditioning'],
  'sprint-repetido': ['conditioning'],
  'resistencia-variable': ['knee_dominant'],
};

export const PATTERN_LABELS: Record<string, string> = {
  knee_dominant: 'Dominante de rodilla',
  hip_dominant: 'Dominante de cadera',
  horizontal_push: 'Empuje horizontal',
  horizontal_pull: 'Tracción horizontal',
  vertical_pull: 'Tracción vertical',
  vertical_push: 'Empuje vertical',
  isolation: 'Aislamiento',
  triple_extension: 'Triple extensión',
  throw: 'Lanzamiento',
  jump_plyometric: 'Salto / pliometría',
  sprint_cod: 'Sprint / cambio de dirección',
  carry: 'Transporte de carga',
  core_anti_extension: 'Core: antiextensión',
  core_anti_rotation: 'Core: antirrotación',
  mobility_activation: 'Movilidad / activación',
  conditioning: 'Acondicionamiento',
};

/** Goal → template family (Phase 6 templates). */
export const GOAL_TEMPLATE: Record<string, string> = {
  hypertrophy: 'hipertrofia',
  max_strength: 'fuerza',
  power: 'fuerza',
  general_health: 'salud',
  functional_strength: 'salud',
  reconditioning: 'salud',
  mobility: 'salud',
  body_composition: 'hipertrofia',
  team_sport_performance: 'equipo',
  sprint: 'equipo',
  acceleration: 'equipo',
  change_of_direction: 'equipo',
  agility: 'equipo',
  neuromuscular_capacity: 'equipo',
  endurance_sport_performance: 'resistencia',
  strength_initiation: 'iniciacion',
  general_physical_preparation: 'iniciacion',
};

/** Profiler traits: a metric compared with an organization threshold (or a verified reference). */
export const TRAITS: {
  trait: string;
  label: string;
  metric: string;
  testName: string;
  ruleKey: string;
  /** "below" = lower than threshold is the trait (e.g. CMJ low); "above" = higher (sprint time). */
  direction: 'below' | 'above';
}[] = [
  {
    trait: 'relative_strength_low',
    label: 'Fuerza relativa baja (sentadilla)',
    metric: 'derived.relative_strength_back_squat',
    testName: 'la fuerza relativa en sentadilla',
    ruleKey: 'profile.relative_strength_low',
    direction: 'below',
  },
  {
    trait: 'cmj_low',
    label: 'CMJ bajo',
    metric: 'metrics.cmj_height',
    testName: 'el CMJ',
    ruleKey: 'profile.cmj_low',
    direction: 'below',
  },
  {
    trait: 'sprint_slow',
    label: 'Sprint de 10 m lento',
    metric: 'metrics.sprint_10m',
    testName: 'el sprint de 10 m',
    ruleKey: 'profile.sprint_slow',
    direction: 'above',
  },
];

const F = 'F' as const;
const rule = (
  r: Omit<DecisionRule, 'version' | 'enabled' | 'evidenceLevel'> & Partial<DecisionRule>,
): DecisionRule => ({
  version: 1,
  enabled: true,
  evidenceLevel: F,
  ...r,
});
const threshold = (label: string, unit: string) => ({
  value: null,
  unit,
  label,
  source: 'Configurable por organización y población; no hay un umbral universal verificado.',
  evidenceLevel: F,
});
const PERFORMANCE_FAMILIES = ['sport_performance', 'power_speed', 'strength'];

export const DEFAULT_DECISION_RULES: DecisionRule[] = [
  // ── Screening gate ──────────────────────────────────────────────────────────
  rule({
    key: 'screening.refer',
    domain: 'screening',
    description: 'Cribado positivo: solo propuestas de baja intensidad y derivación.',
    condition: { '==': [{ var: 'screening' }, 'refer'] },
    parameters: {},
    action: { type: 'set_screening', status: 'refer', text: REFERRAL_TEXT },
    evidenceClaimKeys: [],
    limitations:
      'El cribado no es un diagnóstico; la decisión clínica corresponde a un profesional sanitario.',
  }),
  rule({
    key: 'screening.unknown',
    domain: 'screening',
    description: 'Sin cribado (o sin consentimiento de salud): prudencia.',
    condition: { '==': [{ var: 'screening' }, 'unknown'] },
    parameters: {},
    action: {
      type: 'set_screening',
      status: 'caution',
      text: 'Cribado previo no disponible (o sin consentimiento de datos de salud): completa el cribado antes de cargas altas.',
    },
    evidenceClaimKeys: [],
    limitations: 'Regla de prudencia (práctica).',
  }),
  rule({
    key: 'screening.pain',
    domain: 'screening',
    description: 'Dolor declarado reciente: evitar cargas altas en la zona afectada.',
    condition: { '==': [{ var: 'response.painFlag' }, true] },
    parameters: {},
    action: {
      type: 'set_screening',
      status: 'caution',
      text: 'Dolor declarado recientemente: evita cargas altas en la zona y valora sustituciones. Si el dolor persiste o es intenso, consulta con un profesional sanitario.',
    },
    evidenceClaimKeys: [],
    limitations: 'Descriptivo; no identifica la causa del dolor.',
  }),
  // ── Profiler (thresholds set by the organization) ────────────────────────────
  rule({
    key: 'profile.relative_strength_low',
    domain: 'needs',
    description:
      'Fuerza relativa en sentadilla por debajo del umbral fijado para su objetivo/deporte.',
    condition: {
      and: [
        { in: [{ var: 'goal.family' }, PERFORMANCE_FAMILIES] },
        { '<': [{ var: 'derived.relative_strength_back_squat' }, { param: 'threshold' }] },
      ],
    },
    parameters: { threshold: threshold('Umbral de fuerza relativa', '×PC') },
    action: {
      type: 'set_trait',
      trait: 'relative_strength_low',
      value: true,
      text: 'Fuerza relativa por debajo del umbral fijado',
    },
    evidenceClaimKeys: ['c_fuerza_rendimiento'],
    limitations: 'Umbral no normativo; el 1RM y la masa corporal tienen error de medida.',
  }),
  rule({
    key: 'profile.cmj_low',
    domain: 'needs',
    description: 'CMJ por debajo del umbral fijado para su población.',
    condition: { '<': [{ var: 'metrics.cmj_height' }, { param: 'threshold' }] },
    parameters: { threshold: threshold('Umbral de CMJ', 'cm') },
    action: {
      type: 'set_trait',
      trait: 'cmj_low',
      value: true,
      text: 'CMJ por debajo del umbral fijado',
    },
    evidenceClaimKeys: ['c_referencias_salto_futbol'],
    limitations: 'Las referencias publicadas dependen de edad, sexo, nivel y método de medida.',
  }),
  rule({
    key: 'profile.sprint_slow',
    domain: 'needs',
    description: 'Tiempo en 10 m por encima del umbral fijado (más lento).',
    condition: { '>': [{ var: 'metrics.sprint_10m' }, { param: 'threshold' }] },
    parameters: { threshold: threshold('Umbral de sprint 10 m', 's') },
    action: {
      type: 'set_trait',
      trait: 'sprint_slow',
      value: true,
      text: 'Sprint de 10 m más lento que el umbral fijado',
    },
    evidenceClaimKeys: [],
    limitations: 'Depende del sistema de cronometraje y la salida.',
  }),
  // ── Needs ───────────────────────────────────────────────────────────────────
  rule({
    key: 'needs.max_strength.relative_strength_low',
    domain: 'needs',
    description: 'Fuerza relativa baja para su objetivo → priorizar fuerza máxima.',
    condition: { '==': [{ var: 'traits.relative_strength_low' }, true] },
    parameters: {
      delta: {
        value: 0.3,
        label: 'Aumento de la necesidad',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'raise_need', quality: 'max_strength', delta: 0.3 },
    evidenceClaimKeys: ['c_strength_sprint_transfer', 'c_fuerza_rendimiento', 'c_load_spectrum'],
    limitations:
      'Asociación fuerza–rendimiento (no causalidad garantizada); muestras mayoritariamente de hombres jóvenes.',
  }),
  rule({
    key: 'needs.power.cmj_low',
    domain: 'needs',
    description:
      'CMJ bajo → priorizar potencia (pliometría y cargas moderadas a velocidad máxima).',
    condition: { '==': [{ var: 'traits.cmj_low' }, true] },
    parameters: {
      delta: {
        value: 0.3,
        label: 'Aumento de la necesidad',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'raise_need', quality: 'power', delta: 0.3 },
    evidenceClaimKeys: ['c_plyo_jump_dose', 'c_power_prescription'],
    limitations: 'El CMJ es un indicador; no resume toda la potencia del deportista.',
  }),
  rule({
    key: 'needs.speed.sprint_slow',
    domain: 'needs',
    description: 'Sprint lento → priorizar velocidad/aceleración.',
    condition: { '==': [{ var: 'traits.sprint_slow' }, true] },
    parameters: {
      delta: {
        value: 0.3,
        label: 'Aumento de la necesidad',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'raise_need', quality: 'speed', delta: 0.3 },
    evidenceClaimKeys: ['c_strength_sprint_transfer', 'c_resisted_sled'],
    limitations:
      'Grandes ganancias de fuerza se traducen en pequeñas mejoras de sprint en deportistas entrenados.',
  }),
  rule({
    key: 'needs.speed.sprint_ok',
    domain: 'needs',
    description: 'Sprint correcto → mantener (no es prioridad de desarrollo).',
    condition: { '==': [{ var: 'traits.sprint_slow' }, false] },
    parameters: {},
    action: { type: 'set_direction', quality: 'speed', direction: 'mantener' },
    evidenceClaimKeys: [],
    limitations: 'Valoración relativa al umbral fijado por el centro.',
  }),
  rule({
    key: 'needs.performance_decline',
    domain: 'needs',
    description:
      'Descenso de rendimiento confirmado (mayor que el error de medida) → revisar antes de subir carga.',
    condition: { '==': [{ var: 'flags.anyDecline' }, true] },
    parameters: {},
    action: {
      type: 'warn',
      text: 'Descenso de rendimiento mayor que el error de medida en algún test: revisa carga, recuperación y adherencia antes de aumentar.',
    },
    evidenceClaimKeys: [],
    limitations: 'Un solo test no explica la causa.',
  }),
  // ── Prioritization ──────────────────────────────────────────────────────────
  rule({
    key: 'prioritization.max_priorities',
    domain: 'prioritization',
    description: 'Máximo de cualidades en desarrollo; el resto se mantiene.',
    condition: { '==': [true, true] },
    parameters: {
      max: { value: 3, label: 'Máximo de prioridades', source: 'Práctica (F)', evidenceLevel: F },
    },
    action: { type: 'limit_priorities', max: 3 },
    evidenceClaimKeys: [],
    limitations: 'Criterio práctico de foco.',
  }),
  rule({
    key: 'prioritization.low_adherence',
    domain: 'prioritization',
    description: 'Adherencia baja → menos prioridades y sesiones más simples.',
    condition: { '<': [{ var: 'response.adherence28' }, { param: 'threshold' }] },
    parameters: {
      threshold: {
        value: 60,
        unit: '%',
        label: 'Adherencia por debajo de',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
      max: {
        value: 2,
        label: 'Prioridades con adherencia baja',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'limit_priorities', max: 2 },
    evidenceClaimKeys: ['c_adherence_factors', 'c_minimal_dose'],
    limitations: 'La adherencia depende de muchos factores; conviene preguntar el motivo.',
  }),
  rule({
    key: 'prioritization.time_limited',
    domain: 'prioritization',
    description: 'Poco tiempo semanal → menos prioridades.',
    condition: { '<': [{ var: 'availability.minutesPerWeek' }, { param: 'minutes' }] },
    parameters: {
      minutes: {
        value: 120,
        unit: 'min/sem',
        label: 'Minutos semanales por debajo de',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
      max: {
        value: 2,
        label: 'Prioridades con poco tiempo',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'limit_priorities', max: 2 },
    evidenceClaimKeys: ['c_minimal_dose'],
    limitations: 'Criterio práctico.',
  }),
  rule({
    key: 'prioritization.concurrent_conflict',
    domain: 'prioritization',
    description:
      'Resistencia aeróbica y fuerza/hipertrofia a la vez → avisar del posible conflicto.',
    condition: {
      and: [
        { '>=': [{ var: 'needs.aerobic' }, 0.5] },
        {
          or: [
            { '>=': [{ var: 'needs.hypertrophy' }, 0.5] },
            { '>=': [{ var: 'needs.max_strength' }, 0.5] },
          ],
        },
      ],
    },
    parameters: {},
    action: {
      type: 'warn',
      text: 'Objetivos concurrentes (resistencia + fuerza/hipertrofia): en general no comprometen la fuerza máxima, pero pueden atenuar la fuerza explosiva; separa las sesiones cuando sea posible.',
    },
    evidenceClaimKeys: ['c_concurrent', 'c_endurance_strength_re'],
    limitations: 'Efecto variable según volumen aeróbico y orden de las sesiones.',
  }),
  // ── Method selection ────────────────────────────────────────────────────────
  rule({
    key: 'methods.refer_low_intensity',
    domain: 'method_selection',
    description: 'Cribado positivo → sin métodos de alta intensidad o alto impacto.',
    condition: { '==': [{ var: 'screening' }, 'refer'] },
    parameters: {},
    action: {
      type: 'exclude_methods',
      methods: [
        'pliometria',
        'pape-complex-contrast',
        'halterofilia-derivados',
        'sprint-aceleracion',
        'potencia',
        'resistencia-variable',
        'fuerza-maxima',
        'sprint-repetido',
      ],
      reason: `${REFERRAL_TEXT} Solo propuestas de baja intensidad hasta su valoración.`,
    },
    evidenceClaimKeys: [],
    limitations: 'Regla de seguridad (práctica).',
  }),
  rule({
    key: 'methods.beginner_advanced_methods',
    domain: 'method_selection',
    description: 'Principiantes: sin PAPE/complejos ni derivados de halterofilia.',
    condition: { '==': [{ var: 'person.experience' }, 'beginner'] },
    parameters: {},
    action: {
      type: 'exclude_methods',
      methods: ['pape-complex-contrast', 'halterofilia-derivados', 'resistencia-variable'],
      reason:
        'Métodos para personas con experiencia y técnica estable (la potenciación es mayor en personas más fuertes y experimentadas).',
    },
    evidenceClaimKeys: ['c_pape_acute_effect'],
    limitations: 'La experiencia se declara en el perfil; la técnica la valora el entrenador.',
  }),
  rule({
    key: 'methods.older_adults',
    domain: 'method_selection',
    description: 'Mayores de 65: fuerza progresiva con la dosis orientativa para mayores.',
    condition: { '>=': [{ var: 'person.age' }, { param: 'age' }] },
    parameters: {
      age: {
        value: 65,
        unit: 'años',
        label: 'Edad desde',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: {
      type: 'prefer_method',
      method: 'fuerza-mayores',
      reason: 'Fuerza progresiva para mayores',
    },
    evidenceClaimKeys: ['c_older_rt_effective', 'c_older_rt_dose', 'c_older_power_function'],
    limitations: 'Dosis-respuesta orientativa en mayores sanos.',
  }),
  rule({
    key: 'methods.youth',
    domain: 'method_selection',
    description: 'Menores de 18: fuerza supervisada para jóvenes; sin complejos de potenciación.',
    condition: { '<': [{ var: 'person.age' }, { param: 'age' }] },
    parameters: {
      age: {
        value: 18,
        unit: 'años',
        label: 'Edad por debajo de',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: {
      type: 'prefer_method',
      method: 'fuerza-jovenes',
      reason: 'Fuerza supervisada para jóvenes',
    },
    evidenceClaimKeys: ['c_youth_rt', 'c_plyo_maturation'],
    limitations: 'La maduración modula la respuesta.',
  }),
  rule({
    key: 'methods.minimal_dose_time',
    domain: 'method_selection',
    description: 'Poco tiempo semanal → dosis mínima eficaz.',
    condition: { '<': [{ var: 'availability.minutesPerWeek' }, { param: 'minutes' }] },
    parameters: {
      minutes: {
        value: 120,
        unit: 'min/sem',
        label: 'Minutos semanales por debajo de',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: {
      type: 'prefer_method',
      method: 'dosis-minima',
      reason: 'Dosis mínima eficaz con poco tiempo',
    },
    evidenceClaimKeys: ['c_minimal_dose'],
    limitations: 'Ganancias probablemente menores que con más volumen.',
  }),
  rule({
    key: 'methods.team_sport_hamstrings',
    domain: 'method_selection',
    description: 'Deportes de equipo: curl nórdico de bajo volumen como complemento.',
    condition: { in: ['team_sport_athletes', { var: 'populations' }] },
    parameters: {},
    action: {
      type: 'prefer_method',
      method: 'nordic-hamstring',
      reason: 'Complemento de bajo volumen para isquiosurales',
    },
    evidenceClaimKeys: ['c_nhe_low_volume', 'c_nhe_injury_uncertain'],
    limitations:
      'El efecto sobre la incidencia de lesiones es incierto; se propone por la fuerza excéntrica.',
  }),
  // ── Dosing ──────────────────────────────────────────────────────────────────
  rule({
    key: 'dosing.beginner_conservative',
    domain: 'dosing',
    description: 'Principiantes: parte baja de los rangos al principio.',
    condition: { '==': [{ var: 'person.experience' }, 'beginner'] },
    parameters: {},
    action: {
      type: 'dose_note',
      text: 'Empezar por la parte baja de cada rango y dejar 3–4 repeticiones en reserva las primeras semanas.',
    },
    evidenceClaimKeys: ['c_minimal_dose'],
    limitations: 'Recomendación práctica (F).',
  }),
  // ── Plan assembly / progression ─────────────────────────────────────────────
  rule({
    key: 'progression.reassessment',
    domain: 'progression',
    description: 'Reevaluar al final de cada mesociclo o cada N semanas.',
    condition: { '==': [true, true] },
    parameters: {
      weeks: {
        value: 6,
        unit: 'semanas',
        label: 'Reevaluar cada',
        source: 'Práctica (F): 6–12 semanas',
        evidenceLevel: F,
      },
    },
    action: { type: 'plan', text: 'Reevaluación periódica' },
    evidenceClaimKeys: [],
    limitations: 'Frecuencia práctica.',
  }),
  rule({
    key: 'progression.intro_phase',
    domain: 'progression',
    description: 'Puntuación de necesidad de fase introductoria (§13.5): no todos la necesitan.',
    condition: { '==': [true, true] },
    parameters: {
      brief: {
        value: 0.3,
        label: 'Desde (introducción breve)',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
      phase: {
        value: 0.6,
        label: 'Desde (fase de adaptación)',
        source: 'Práctica (F)',
        evidenceLevel: F,
      },
    },
    action: { type: 'plan', text: 'Fase introductoria según puntuación' },
    evidenceClaimKeys: ['c_isometric_tendon'],
    limitations:
      'Práctica razonable (F) apoyada en la adaptación del tendón a cargas altas en ≥ 8 semanas.',
  }),
];
