/**
 * Initial templates by programming profile × level × days (restructure phase 3): built from a few
 * building blocks so every template follows the same rules and cites the same evidence.
 *
 * - Doses follow the methods with verified evidence: hipertrofia (rest ≥ 60–90 s), fuerza-maxima
 *   (> 80 % 1RM, only from level 2), fuerza-mayores (2–3 × 7–9), equilibrio-mayores (3 sessions a
 *   week, 11–12 weeks), actividad-fisica-oms (WHO 2020), fuerza-paralisis-cerebral, potencia,
 *   pliometria… Exercise choice, RIR waves and deloads are practical guidance (level F) and the
 *   trainer edits everything.
 * - Each template is one 13-week block (4 + 4 + 5 weeks, reassessment in the last week). For 6–12
 *   months the block repeats as new cycles (decision A17); the trainer adjusts after reassessing.
 * - Recovery and return to sport are programmed per injury protocol (readaptation module) and the
 *   custom profile by the trainer: there are no generic templates for them.
 * - Risk-reduction routines (adductors, hamstrings, quadriceps) are separate templates per level;
 *   their texts never present prevention as a fact.
 */
import type {
  Prescription,
  ProgressionRule,
  TemplateBlock,
  TemplateDefinition,
  TemplateExercise,
  TemplateMesocycle,
  TemplateSession,
} from '@tp/domain';
import { PROGRAMMING_PROFILES } from './profiles';
import { templateFacets, type SeedTemplate } from './templates';

export type Level = 1 | 2 | 3;
type Reps = number | [number, number];
type Side = TemplateExercise['side'];

// ── Building blocks ───────────────────────────────────────────────────────────

function rx(sets: number, reps: Reps | null, o: Partial<Prescription> = {}): Prescription {
  const p: Prescription = { sets };
  if (reps != null) {
    const [a, b] = typeof reps === 'number' ? [reps, reps] : reps;
    p.repsMin = a;
    p.repsMax = b;
  }
  return { ...p, ...o };
}
const rir = (a: number, b = a): Partial<Prescription> => ({ rirMin: a, rirMax: b });

function ex(
  exercise: string,
  prescription: Prescription,
  o: { methods?: string[]; progression?: ProgressionRule; notes?: string; side?: Side } = {},
): TemplateExercise {
  const e: TemplateExercise = { exercise, prescription };
  if (o.methods?.length) e.methods = o.methods;
  if (o.progression) e.progression = o.progression;
  if (o.notes) e.notesForClient = o.notes;
  if (o.side) e.side = o.side;
  return e;
}
const block = (type: string, label: string, exercises: TemplateExercise[]): TemplateBlock => ({
  type,
  label,
  organization: 'straight_sets',
  exercises,
});
const session = (
  dayLabel: string,
  title: string,
  objective: string,
  minutes: number,
  blocks: TemplateBlock[],
  notes?: string,
): TemplateSession => ({
  dayLabel,
  title,
  objective,
  durationMin: minutes,
  ...(notes ? { notesForClient: notes } : {}),
  blocks,
});

const WAVE = (floor: number): ProgressionRule => ({ kind: 'rir_wave', step: 1, floor });
const pick = <T>(level: Level, options: readonly [T, T, T]): T => options[level - 1]!;
const letter = (i: number) => String.fromCharCode(65 + i);

/** One 13-week block: two 4-week mesocycles with a deload and a 5-week one ending in a test week. */
function mesocycles(peak: boolean): TemplateMesocycle[] {
  return [
    {
      name: 'Mesociclo 1 · técnica y base',
      weeks: 4,
      weekTypes: ['introduction', 'progression', 'progression', 'deload'],
    },
    {
      name: 'Mesociclo 2 · desarrollo',
      weeks: 4,
      weekTypes: ['progression', 'progression', 'progression', 'deload'],
    },
    {
      name: 'Mesociclo 3 · consolidación y reevaluación',
      weeks: 5,
      weekTypes: peak
        ? ['progression', 'progression', 'progression', 'peak', 'test']
        : ['progression', 'progression', 'progression', 'progression', 'test'],
      assessmentPlanned: true,
    },
  ];
}

// ── Warm-ups ─────────────────────────────────────────────────────────────────

const warmGym = () =>
  block('warm_up', 'Calentamiento', [
    ex('worlds_greatest_stretch', rx(1, 5), { side: 'each' }),
    ex('cat_camel', rx(1, 8)),
    ex('miniband_glute_activation', rx(1, 10)),
  ]);
const warmAthlete = () =>
  block('warm_up', 'Calentamiento', [
    ex('worlds_greatest_stretch', rx(1, 5), { side: 'each' }),
    ex('ankle_knee_to_wall', rx(1, 8), { side: 'each' }),
    ex('pogo_jumps', rx(2, null, { contacts: 10 }), { methods: ['pliometria'] }),
  ]);
const warmGentle = () =>
  block('warm_up', 'Calentamiento', [
    ex('cat_camel', rx(1, 8)),
    ex('ankle_knee_to_wall', rx(1, 8), { side: 'each' }),
    ex('tandem_walk', rx(2, null, { distanceM: 5 }), { notes: 'Cerca de una pared o un apoyo.' }),
  ]);

// ── Strength and hypertrophy (gym) ───────────────────────────────────────────

interface Dose {
  main: Prescription;
  assist: Prescription;
  small: Prescription;
  wave: ProgressionRule;
}
type GymKind = 'hipertrofia' | 'fuerza' | 'iniciacion' | 'funcion';

const GYM_DOSES: Record<'hipertrofia' | 'fuerza' | 'basico', readonly [Dose, Dose, Dose]> = {
  hipertrofia: [
    {
      main: rx(3, [10, 12], { ...rir(3), restS: 90 }),
      assist: rx(2, [10, 12], { ...rir(3), restS: 90 }),
      small: rx(2, [12, 15], { ...rir(3), restS: 60 }),
      wave: WAVE(2),
    },
    {
      main: rx(3, [8, 12], { ...rir(2, 3), restS: 120 }),
      assist: rx(3, [10, 12], { ...rir(2), restS: 90 }),
      small: rx(3, [12, 15], { ...rir(2), restS: 60 }),
      wave: WAVE(1),
    },
    {
      main: rx(4, [6, 10], { ...rir(1, 2), restS: 150 }),
      assist: rx(3, [8, 12], { ...rir(1, 2), restS: 120 }),
      small: rx(3, [12, 15], { ...rir(1), restS: 60 }),
      wave: WAVE(1),
    },
  ],
  fuerza: [
    {
      main: rx(3, [6, 8], { ...rir(3), restS: 150 }),
      assist: rx(3, [8, 10], { ...rir(2, 3), restS: 120 }),
      small: rx(2, [10, 12], { ...rir(2), restS: 60 }),
      wave: WAVE(2),
    },
    {
      main: rx(4, [4, 6], { ...rir(2), restS: 180 }),
      assist: rx(3, [6, 8], { ...rir(2), restS: 120 }),
      small: rx(2, [10, 12], { ...rir(2), restS: 60 }),
      wave: WAVE(1),
    },
    {
      main: rx(5, [2, 4], { ...rir(1, 2), restS: 210 }),
      assist: rx(3, [5, 8], { ...rir(2), restS: 150 }),
      small: rx(3, [8, 12], { ...rir(2), restS: 60 }),
      wave: WAVE(1),
    },
  ],
  basico: [
    {
      main: rx(2, [10, 12], { ...rir(3, 4), restS: 90 }),
      assist: rx(1, [10, 12], { ...rir(3, 4), restS: 90 }),
      small: rx(1, [12, 15], { ...rir(3), restS: 60 }),
      wave: WAVE(3),
    },
    {
      main: rx(3, [8, 12], { ...rir(2, 3), restS: 90 }),
      assist: rx(2, [10, 12], { ...rir(2, 3), restS: 90 }),
      small: rx(2, [12, 15], { ...rir(2), restS: 60 }),
      wave: WAVE(2),
    },
    {
      main: rx(3, [6, 10], { ...rir(2), restS: 120 }),
      assist: rx(3, [8, 12], { ...rir(2), restS: 90 }),
      small: rx(2, [12, 15], { ...rir(2), restS: 60 }),
      wave: WAVE(2),
    },
  ],
};

/** Hipertrofia, fuerza, iniciación and función muscular: full body (≤ 3 days) or torso/pierna. */
function gymSessions(kind: GymKind, level: Level, days: number): TemplateSession[] {
  const H = kind === 'hipertrofia';
  const F = kind === 'fuerza';
  // fuerza-maxima's evidence is for > 80 % 1RM: level 1 loads (6–8 @ RIR 3) are below it.
  const methods = H
    ? ['hipertrofia', 'rir-rpe']
    : F
      ? level === 1
        ? ['rir-rpe']
        : ['fuerza-maxima', 'rir-rpe']
      : kind === 'iniciacion'
        ? ['dosis-minima', 'rir-rpe']
        : ['actividad-fisica-oms', 'rir-rpe'];
  const d = pick(level, GYM_DOSES[H ? 'hipertrofia' : F ? 'fuerza' : 'basico']);
  const main = (slug: string) => ex(slug, d.main, { methods, progression: d.wave });
  const assist = (slug: string, side?: Side) =>
    ex(slug, d.assist, { methods, progression: d.wave, side });
  const small = (slug: string) => ex(slug, d.small, { methods, progression: d.wave });
  // Stable, simpler options at level 1; free weights and harder variants above.
  const SQ = pick(level, ['goblet_squat', 'back_squat', 'back_squat'] as const);
  const SQ2 = pick(level, ['leg_press', 'goblet_squat', 'front_squat'] as const);
  const HI = pick(level, ['glute_bridge', 'romanian_deadlift', 'deadlift'] as const);
  const HI2 = pick(level, ['romanian_deadlift', 'hip_thrust', 'romanian_deadlift'] as const);
  const UNI = pick(level, [
    'split_squat',
    'bulgarian_split_squat',
    'bulgarian_split_squat',
  ] as const);
  const UNI2 = pick(level, ['step_up_low', 'walking_lunge', 'walking_lunge'] as const);
  const HP = pick(level, ['dumbbell_bench_press', 'bench_press', 'bench_press'] as const);
  const HP2 = pick(level, [
    'incline_push_up',
    'incline_dumbbell_press',
    'incline_dumbbell_press',
  ] as const);
  const HP3 = pick(level, ['push_up', 'dumbbell_bench_press', 'dumbbell_bench_press'] as const);
  const HR = pick(level, ['seated_cable_row', 'one_arm_dumbbell_row', 'barbell_row'] as const);
  const HR2 = pick(level, ['inverted_row', 'seated_cable_row', 'seated_cable_row'] as const);
  const VP = pick(level, [
    'dumbbell_shoulder_press',
    'dumbbell_shoulder_press',
    'overhead_press',
  ] as const);
  const VR = pick(level, ['lat_pulldown', 'lat_pulldown', 'pull_up'] as const);
  const core = (i: number) =>
    block('core', 'Core', [
      i % 2
        ? ex(pick(level, ['bird_dog', 'pallof_press', 'pallof_press'] as const), rx(2, [8, 10]), {
            methods: ['core'],
            side: 'each',
          })
        : ex(
            pick(level, ['dead_bug', 'front_plank', 'ab_wheel_rollout'] as const),
            level === 2 ? rx(2, null, { durationS: 30 }) : rx(2, [8, 10]),
            { methods: ['core'] },
          ),
      ex('side_plank', rx(2, null, { durationS: 20 + 10 * (level - 1) }), {
        side: 'each',
        methods: ['core'],
      }),
    ]);
  const objective = H
    ? 'Hipertrofia: volumen semanal suficiente cerca del fallo, sin llegar a él'
    : F
      ? 'Fuerza: cargas altas en los patrones principales con técnica estable'
      : kind === 'iniciacion'
        ? 'Aprender los patrones básicos con poca dosis y mucha técnica'
        : 'Fuerza y resistencia muscular para la vida diaria';
  const minutes = H || F ? 60 + 10 * (level - 1) : 45 + 5 * (level - 1);
  const mainType = F ? 'main_strength' : H ? 'hypertrophy' : 'main_strength';
  const fullBody = (label: string, i: number): TemplateSession =>
    session(label, `Cuerpo completo ${label}`, objective, minutes, [
      warmGym(),
      block(mainType, 'Principal', [
        main([SQ, HI, SQ2][i]!),
        assist([HP, VP, HP2][i]!),
        assist([HR, VR, HR2][i]!),
        ...(level > 1 || days < 3 ? [assist([HI2, UNI, UNI2][i]!, i ? 'each' : undefined)] : []),
      ]),
      ...(H && level > 1
        ? [
            block('hypertrophy', 'Accesorios', [
              small(['lateral_raise', 'biceps_curl', 'face_pull'][i]!),
              small(['triceps_pushdown', 'leg_curl_machine', 'standing_calf_raise'][i]!),
            ]),
          ]
        : []),
      core(i),
    ]);
  const upper = (label: string, i: number): TemplateSession =>
    session(label, `Torso ${label}`, objective, minutes, [
      warmGym(),
      block(
        mainType,
        'Principal',
        i === 0
          ? [main(HP), main(HR), assist(VP), assist(VR)]
          : [main(VR), main(HP2), assist(HR2), assist(HP3)],
      ),
      block('hypertrophy', 'Accesorios', [
        small(i === 0 ? 'lateral_raise' : 'face_pull'),
        small(i === 0 ? 'biceps_curl' : 'triceps_pushdown'),
      ]),
    ]);
  const lower = (label: string, i: number): TemplateSession =>
    session(label, `Pierna ${label}`, objective, minutes, [
      warmGym(),
      block(
        mainType,
        'Principal',
        i === 0
          ? [main(SQ), main(HI2), assist(UNI, 'each')]
          : [main(HI), main(SQ2), assist(UNI2, 'each')],
      ),
      block('hypertrophy', 'Accesorios', [
        small(i === 0 ? 'leg_curl_machine' : 'leg_extension'),
        small(i === 0 ? 'standing_calf_raise' : 'seated_calf_raise'),
      ]),
      core(i),
    ]);
  const arms = (label: string): TemplateSession =>
    session(label, `Hombro y brazos ${label}`, objective, minutes - 15, [
      warmGym(),
      block('hypertrophy', 'Accesorios', [
        small('lateral_raise'),
        small('face_pull'),
        small('biceps_curl'),
        small('triceps_pushdown'),
        small('standing_calf_raise'),
      ]),
      core(2),
    ]);
  if (days <= 3) return [0, 1, 2].slice(0, days).map((i) => fullBody(letter(i), i));
  if (days === 4) return [upper('A', 0), lower('B', 0), upper('C', 1), lower('D', 1)];
  return [upper('A', 0), lower('B', 0), arms('C'), upper('D', 1), lower('E', 1)];
}

// ── Health and function ──────────────────────────────────────────────────────

const AEROBIC_NOTE =
  'Suma actividad aeróbica durante la semana (caminar, bici…) hasta 150–300 min de intensidad moderada.';

/** Salud, mejora de la funcionalidad: strength twice a week plus aerobic work (WHO 2020). */
function healthSessions(
  kind: 'salud' | 'funcionalidad',
  level: Level,
  days: number,
): TemplateSession[] {
  const methods = ['actividad-fisica-oms', 'rir-rpe'];
  const dose = rx(
    pick(level, [2, 3, 3] as const),
    pick(level, [
      [10, 12],
      [8, 12],
      [8, 10],
    ] as const),
    { ...pick(level, [rir(3), rir(2, 3), rir(2)] as const), restS: 90 },
  );
  const s = (slug: string, side?: Side) => ex(slug, dose, { methods, progression: WAVE(2), side });
  const F = kind === 'funcionalidad';
  const strengthSession = (label: string, i: number) =>
    session(
      label,
      `Fuerza ${F ? 'funcional' : 'general'} ${label}`,
      F
        ? 'Patrones de la vida diaria con carga y control'
        : 'Fuerza de cuerpo completo para la salud',
      45 + 5 * (level - 1),
      [
        warmGym(),
        ...(level === 3 && i === 0
          ? [
              block('power_potentiation', 'Potencia', [
                ex('kettlebell_swing', rx(3, [8, 10], { restS: 90 }), {
                  methods: ['potencia'],
                  notes: 'Movimiento rápido desde la cadera, con la espalda neutra.',
                }),
              ]),
            ]
          : []),
        block('main_strength', 'Principal', [
          i
            ? s(pick(level, ['step_up_low', 'step_up', 'bulgarian_split_squat'] as const), 'each')
            : s(pick(level, ['sit_to_stand', 'goblet_squat', 'goblet_squat'] as const)),
          s(
            i
              ? pick(level, ['incline_push_up', 'push_up', 'push_up'] as const)
              : pick(level, ['seated_cable_row', 'one_arm_dumbbell_row', 'inverted_row'] as const),
          ),
          s(
            i
              ? pick(level, ['lat_pulldown', 'lat_pulldown', 'band_assisted_pull_up'] as const)
              : pick(level, [
                  'incline_push_up',
                  'dumbbell_bench_press',
                  'dumbbell_shoulder_press',
                ] as const),
          ),
          i
            ? s(
                pick(level, ['glute_bridge', 'single_leg_rdl', 'single_leg_rdl'] as const),
                level > 1 ? 'each' : undefined,
              )
            : s(pick(level, ['glute_bridge', 'romanian_deadlift', 'romanian_deadlift'] as const)),
          ...(F || level > 1
            ? [
                ex(
                  pick(level, ['farmer_carry', 'farmer_carry', 'suitcase_carry'] as const),
                  rx(2, null, { distanceM: 20, restS: 60 }),
                  { side: level === 3 ? 'each' : undefined },
                ),
              ]
            : []),
        ]),
        block('core', 'Core y equilibrio', [
          ex(i ? 'bird_dog' : 'dead_bug', rx(2, [6, 8]), {
            methods: ['core'],
            side: i ? 'each' : undefined,
          }),
          ex('single_leg_balance', rx(2, null, { durationS: 20 + 10 * (level - 1) }), {
            side: 'each',
          }),
        ]),
      ],
      days === 2 ? AEROBIC_NOTE : undefined,
    );
  const aerobic = (label: string) =>
    session(
      label,
      'Resistencia aeróbica',
      'Actividad aeróbica moderada a vigorosa',
      40,
      [
        warmGentle(),
        block('conditioning', 'Aeróbico', [
          level === 1
            ? ex('brisk_walking', rx(1, null, { durationS: 1800 }), {
                methods: ['actividad-fisica-oms'],
                notes: 'A un ritmo que te permita hablar con frases cortas.',
              })
            : level === 2
              ? ex('rowing_ergometer', rx(1, null, { durationS: 1200 }), {
                  methods: ['actividad-fisica-oms'],
                  notes: 'Ritmo constante y moderado.',
                })
              : ex('bike_erg_intervals', rx(8, null, { durationS: 60, restS: 60 }), {
                  methods: ['actividad-fisica-oms'],
                  notes: 'Intervalos vigorosos con recuperación activa.',
                }),
        ]),
        block('mobility', 'Movilidad', [
          ex('thoracic_rotation', rx(1, 8), { side: 'each' }),
          ex('hip_90_90', rx(1, 6), { side: 'each' }),
        ]),
      ],
      AEROBIC_NOTE,
    );
  if (days === 2) return [strengthSession('A', 0), strengthSession('B', 1)];
  if (days === 3) return [strengthSession('A', 0), aerobic('B'), strengthSession('C', 1)];
  return [strengthSession('A', 0), aerobic('B'), strengthSession('C', 1), aerobic('D')];
}

/**
 * Older adults: strength near the dose of «fuerza-mayores» (2–3 × 7–9), balance and functional
 * tasks in every session («equilibrio-mayores»: 3 a week did best; combined with strength,
 * probably fewer falls), power from level 2.
 */
function olderSessions(level: Level, days: number): TemplateSession[] {
  const dose = rx(
    level === 1 ? 2 : 3,
    pick(level, [
      [8, 10],
      [7, 9],
      [7, 9],
    ] as const),
    {
      ...pick(level, [rir(3), rir(2, 3), rir(2)] as const),
      restS: 90,
    },
  );
  const s = (slug: string, side?: Side) =>
    ex(slug, dose, { methods: ['fuerza-mayores'], progression: WAVE(2), side });
  const balance = (i: number) =>
    block('activation', 'Equilibrio', [
      ex('single_leg_balance', rx(3, null, { durationS: pick(level, [15, 20, 30] as const) }), {
        methods: ['equilibrio-mayores'],
        side: 'each',
        notes: pick(level, [
          'Con un apoyo cerca (pared o silla).',
          'Sin apoyo si es posible, con un apoyo cerca.',
          'Añade giros de cabeza o una segunda tarea (contar, nombrar cosas), con un apoyo cerca.',
        ] as const),
      }),
      ex('tandem_walk', rx(3, null, { distanceM: pick(level, [4, 6, 8] as const) }), {
        methods: ['equilibrio-mayores'],
      }),
      ...(i || level > 1
        ? [
            ex(pick(level, ['step_up_low', 'step_up_low', 'step_up'] as const), rx(2, [6, 8]), {
              methods: ['equilibrio-mayores'],
              side: 'each',
              notes: 'Sube y baja controlando la rodilla; usa la barandilla si la necesitas.',
            }),
          ]
        : []),
    ]);
  const power =
    level > 1
      ? [
          block('power_potentiation', 'Potencia', [
            ex('sit_to_stand', rx(3, [5, 6], { ...rir(4), restS: 90 }), {
              methods: ['potencia', 'fuerza-mayores'],
              notes: 'Levántate lo más rápido que puedas con control; baja despacio.',
            }),
            ex('med_ball_chest_pass', rx(2, [6, 8], { restS: 60 }), { methods: ['potencia'] }),
          ]),
        ]
      : [];
  const strengthSession = (label: string, i: number) =>
    session(
      label,
      `Fuerza y equilibrio ${label}`,
      'Fuerza de piernas y tronco, equilibrio y tareas del día a día',
      45 + 5 * (level - 1),
      [
        warmGentle(),
        ...(i === 0 ? power : []),
        block('main_strength', 'Fuerza', [
          i
            ? s(pick(level, ['leg_press', 'leg_press', 'goblet_squat'] as const))
            : s(pick(level, ['sit_to_stand', 'leg_press', 'leg_press'] as const)),
          s(i ? 'incline_push_up' : 'seated_cable_row'),
          i
            ? s(pick(level, ['glute_bridge', 'glute_bridge', 'romanian_deadlift'] as const))
            : s(pick(level, ['step_up_low', 'step_up_low', 'split_squat'] as const), 'each'),
          ...(level > 1 ? [s(i ? 'lat_pulldown' : 'dumbbell_shoulder_press')] : []),
          ex(
            pick(level, ['farmer_carry', 'farmer_carry', 'suitcase_carry'] as const),
            rx(2, null, { distanceM: 15, restS: 60 }),
            { side: level === 3 ? 'each' : undefined },
          ),
        ]),
        balance(i),
      ],
    );
  const balanceSession = (label: string, walk: boolean) =>
    session(
      label,
      walk || level === 1 ? 'Equilibrio y caminar' : 'Equilibrio y potencia',
      'Equilibrio y tareas funcionales',
      40,
      [
        warmGentle(),
        ...(walk ? [] : power),
        balance(1),
        block('conditioning', 'Aeróbico', [
          ex('brisk_walking', rx(1, null, { durationS: pick(level, [900, 1200, 1500] as const) }), {
            methods: ['actividad-fisica-oms'],
            notes: 'A un ritmo que te permita hablar.',
          }),
        ]),
      ],
    );
  if (days === 2) return [strengthSession('A', 0), strengthSession('B', 1)];
  if (days === 3)
    return [strengthSession('A', 0), balanceSession('B', false), strengthSession('C', 1)];
  return [
    strengthSession('A', 0),
    balanceSession('B', true),
    strengthSession('C', 1),
    balanceSession('D', false),
  ];
}

/** Coordination, balance and motor control: stable and slow → combined → fast and reactive. */
function coordinationSessions(level: Level, days: number): TemplateSession[] {
  const hold = (slug: string, seconds: number, side?: Side, notes?: string) =>
    ex(slug, rx(3, null, { durationS: seconds }), { side, notes });
  const strength = (slug: string, side?: Side) =>
    ex(slug, rx(3, [8, 10], { ...rir(2, 3), restS: 60 }), {
      methods: ['rir-rpe'],
      progression: WAVE(2),
      side,
    });
  const coreEx = (slug: string, side?: Side) =>
    ex(slug, rx(3, [6, 8], { restS: 45 }), { methods: ['core'], side });
  const sessions: ((label: string) => TemplateSession)[] = [
    (label) =>
      session(
        label,
        `Equilibrio y control ${label}`,
        'Equilibrio estático y dinámico con control del tronco',
        40,
        [
          warmGentle(),
          block('activation', 'Equilibrio', [
            hold(
              'single_leg_balance',
              pick(level, [15, 25, 30] as const),
              'each',
              pick(level, [
                'Con un apoyo cerca.',
                'Sin apoyo, con los ojos abiertos.',
                'Con giros de cabeza o pasando una pelota de una mano a otra.',
              ] as const),
            ),
            ex('tandem_walk', rx(3, null, { distanceM: 6 })),
            strength(
              pick(level, ['step_up_low', 'split_squat', 'single_leg_rdl'] as const),
              'each',
            ),
          ]),
          block('core', 'Control del tronco', [
            coreEx('bird_dog', 'each'),
            level === 3 ? coreEx('pallof_press', 'each') : coreEx('dead_bug'),
          ]),
        ],
      ),
    (label) =>
      session(
        label,
        `Coordinación ${label}`,
        pick(level, [
          'Tareas simples y lentas',
          'Tareas combinadas y cambios de ritmo',
          'Tareas rápidas y reactivas',
        ] as const),
        40,
        [
          warmGentle(),
          block(
            level === 1 ? 'activation' : 'plyometric',
            'Coordinación',
            level === 1
              ? [strength('step_up_low', 'each'), strength('glute_bridge'), hold('wall_sit', 20)]
              : level === 2
                ? [
                    ex('pogo_jumps', rx(3, null, { contacts: 10 }), { methods: ['pliometria'] }),
                    strength('reverse_lunge', 'each'),
                    ex('med_ball_chest_pass', rx(3, [6, 8], { restS: 60 }), {
                      methods: ['potencia'],
                    }),
                  ]
                : [
                    ex('lateral_bounds', rx(3, [4, 6], { restS: 60 }), {
                      methods: ['pliometria'],
                      side: 'each',
                    }),
                    ex('single_leg_hop', rx(3, [4, 5], { restS: 60 }), {
                      methods: ['pliometria'],
                      side: 'each',
                      notes: 'Aterriza suave y aguanta 2 s estable.',
                    }),
                    ex('med_ball_rotational_throw', rx(3, [5, 6], { restS: 60 }), {
                      methods: ['potencia'],
                      side: 'each',
                    }),
                  ],
          ),
          block('core', 'Tronco', [hold('side_plank', 20, 'each'), coreEx('pallof_press', 'each')]),
        ],
      ),
    (label) =>
      session(
        label,
        `Agilidad y equilibrio ${label}`,
        'Desplazamientos, frenadas y cambios de dirección según el nivel',
        40,
        [
          warmGentle(),
          block(
            level === 1 ? 'activation' : 'sprint_cod',
            'Desplazamientos',
            level === 1
              ? [
                  ex('tandem_walk', rx(3, null, { distanceM: 8 })),
                  hold('single_leg_balance', 20, 'each'),
                ]
              : [
                  ex('shuttle_run', rx(4, 1, { restS: 60 }), { methods: ['cod-agilidad'] }),
                  ex(level === 2 ? 'deceleration_drill' : 'drill_505', rx(4, 1, { restS: 90 }), {
                    methods: ['cod-agilidad'],
                  }),
                ],
          ),
          block('main_strength', 'Fuerza', [
            strength(
              pick(level, ['sit_to_stand', 'goblet_squat', 'bulgarian_split_squat'] as const),
              level === 3 ? 'each' : undefined,
            ),
            strength('seated_cable_row'),
          ]),
        ],
      ),
  ];
  return sessions.slice(0, days).map((f, i) => f(letter(i)));
}

/**
 * Mild cerebral palsy: progressive strength far from failure, bilateral and supported first, the
 * more affected side sets the pace; balance and functional tasks. Coordinate with the health team.
 */
function cpSessions(level: Level, days: number): TemplateSession[] {
  const methods = ['fuerza-paralisis-cerebral'];
  const dose = rx(
    pick(level, [2, 3, 3] as const),
    pick(level, [
      [10, 12],
      [8, 12],
      [8, 10],
    ] as const),
    { ...pick(level, [rir(3, 4), rir(3), rir(2, 3)] as const), restS: 90 },
  );
  const s = (slug: string, side?: Side, notes?: string) =>
    ex(slug, dose, { methods, progression: WAVE(2), side, notes });
  const SIDE_NOTE = 'Empieza por el lado más afectado; el otro lado hace las mismas repeticiones.';
  const legs = (label: string) =>
    session(
      label,
      `Fuerza de piernas ${label}`,
      'Fuerza de piernas y tronco, lejos del fallo',
      40 + 5 * (level - 1),
      [
        warmGentle(),
        block('main_strength', 'Fuerza', [
          s(pick(level, ['sit_to_stand', 'leg_press', 'goblet_squat'] as const)),
          s(pick(level, ['glute_bridge', 'glute_bridge', 'romanian_deadlift'] as const)),
          level === 1
            ? ex('wall_sit', rx(2, null, { durationS: 20, restS: 60 }), {
                notes: 'Con la espalda apoyada y los pies a la anchura de la cadera.',
              })
            : s(
                pick(level, ['wall_sit', 'step_up_low', 'split_squat'] as const),
                'each',
                SIDE_NOTE,
              ),
          s('seated_calf_raise'),
        ]),
        block('activation', 'Equilibrio', [
          ex('single_leg_balance', rx(3, null, { durationS: pick(level, [10, 20, 30] as const) }), {
            side: 'each',
            notes: 'Con un apoyo si hace falta.',
          }),
        ]),
      ],
    );
  const upper = (label: string) =>
    session(
      label,
      `Fuerza de tronco y brazos ${label}`,
      'Empuje y tracción con control del tronco',
      40 + 5 * (level - 1),
      [
        warmGentle(),
        block('main_strength', 'Fuerza', [
          s('seated_cable_row'),
          s(pick(level, ['incline_push_up', 'incline_push_up', 'push_up'] as const)),
          s(pick(level, ['lat_pulldown', 'lat_pulldown', 'dumbbell_shoulder_press'] as const)),
          ...(level > 1 ? [s('one_arm_dumbbell_row', 'each', SIDE_NOTE)] : []),
        ]),
        block('core', 'Tronco', [
          ex('dead_bug', rx(2, [6, 8]), { methods: ['core'] }),
          ex('bird_dog', rx(2, [6, 8]), { methods: ['core'], side: 'each' }),
        ]),
      ],
    );
  const coordination = (label: string) =>
    session(
      label,
      `Coordinación y potencia ${label}`,
      pick(level, [
        'Patrones funcionales y equilibrio',
        'Tareas unilaterales y equilibrio dinámico',
        'Potencia y coordinación',
      ] as const),
      40 + 5 * (level - 1),
      [
        warmGentle(),
        block(level === 3 ? 'power_potentiation' : 'activation', 'Coordinación', [
          ex('tandem_walk', rx(3, null, { distanceM: pick(level, [4, 6, 8] as const) }), {
            notes: 'Con un apoyo cerca.',
          }),
          ...(level === 3
            ? [
                ex('med_ball_chest_pass', rx(3, [5, 6], { restS: 60 }), { methods: ['potencia'] }),
                ex('squat_jump', rx(3, [4, 5], { restS: 90 }), {
                  methods: ['pliometria'],
                  notes: 'Aterriza suave y estable.',
                }),
              ]
            : [s(level === 1 ? 'step_up_low' : 'reverse_lunge', 'each', SIDE_NOTE)]),
        ]),
        block('main_strength', 'Fuerza', [
          s(
            pick(level, ['leg_press', 'goblet_squat', 'bulgarian_split_squat'] as const),
            level === 3 ? 'each' : undefined,
            level === 3 ? SIDE_NOTE : undefined,
          ),
          ex('farmer_carry', rx(2, null, { distanceM: 15, restS: 60 })),
        ]),
      ],
    );
  return [legs, upper, coordination].slice(0, days).map((f, i) => f(letter(i)));
}

// ── Sport performance ────────────────────────────────────────────────────────

/** Rendimiento deportivo, deportes de equipo e individuales. */
function athleteSessions(
  kind: 'general' | 'equipo' | 'individual',
  level: Level,
  days: number,
): TemplateSession[] {
  const strength = pick(level, [
    rx(3, [6, 8], { ...rir(3), restS: 150 }),
    rx(4, [4, 6], { ...rir(2), restS: 180 }),
    rx(4, [3, 5], { ...rir(1, 2), restS: 210 }),
  ] as const);
  const assistDose = pick(level, [
    rx(2, [8, 10], { ...rir(3), restS: 90 }),
    rx(3, [6, 8], { ...rir(2), restS: 120 }),
    rx(3, [5, 8], { ...rir(2), restS: 120 }),
  ] as const);
  const mainMethods = level === 1 ? ['rir-rpe'] : ['fuerza-maxima', 'rir-rpe'];
  const main = (slug: string) => ex(slug, strength, { methods: mainMethods, progression: WAVE(1) });
  const acc = (slug: string, side?: Side) =>
    ex(slug, assistDose, { methods: ['rir-rpe'], progression: WAVE(1), side });
  const team = kind === 'equipo';
  const plyo = (i: number) =>
    block('plyometric', 'Pliometría', [
      ex(
        pick(level, [
          i ? 'broad_jump' : 'squat_jump',
          i ? 'lateral_bounds' : 'box_jump',
          i ? 'single_leg_hop' : 'drop_jump',
        ] as const),
        rx(3, [4, 5], { restS: 90 }),
        {
          methods: ['pliometria'],
          side: i && level > 1 ? 'each' : undefined,
          notes: 'Calidad máxima en cada repetición; para si se pierde la técnica.',
        },
      ),
    ]);
  const power = (i: number) =>
    block('power_potentiation', 'Potencia', [
      i
        ? ex(
            pick(level, [
              'med_ball_chest_pass',
              'med_ball_chest_pass',
              'med_ball_rotational_throw',
            ] as const),
            rx(3, [5, 6], { restS: 90 }),
            { methods: ['potencia'], side: level === 3 ? 'each' : undefined },
          )
        : level === 3
          ? ex('hang_power_clean', rx(4, 3, { ...rir(2), restS: 150 }), {
              methods: ['halterofilia-derivados', 'potencia'],
            })
          : ex(
              pick(level, ['med_ball_slam', 'kettlebell_swing', 'kettlebell_swing'] as const),
              rx(3, [5, 6], { restS: 90 }),
              { methods: ['potencia'] },
            ),
    ]);
  const prevention = (i: number) =>
    block('core', level > 1 || team ? 'Reducción de factores de riesgo' : 'Core', [
      ...(level > 1 || team
        ? [
            i
              ? ex('copenhagen_plank', rx(2, null, { durationS: 15 + 5 * level, restS: 45 }), {
                  methods: ['calentamiento-preventivo'],
                  side: 'each',
                })
              : level > 1
                ? ex('nordic_hamstring_curl', rx(2, [4, 6], { restS: 120 }), {
                    methods: ['nordic-hamstring'],
                    notes: 'Baja lo más despacio que puedas; ayúdate con las manos al final.',
                  })
                : ex('single_leg_rdl', rx(2, [6, 8], { ...rir(3), restS: 60 }), {
                    methods: ['rir-rpe'],
                    side: 'each',
                  }),
          ]
        : []),
      i
        ? ex('pallof_press', rx(2, [8, 10]), { methods: ['core'], side: 'each' })
        : ex('side_plank', rx(2, null, { durationS: 30 }), { methods: ['core'], side: 'each' }),
    ]);
  const speed = () =>
    block('sprint_cod', team ? 'Velocidad y cambio de dirección' : 'Velocidad', [
      ex('acceleration_10m', rx(pick(level, [4, 5, 6] as const), 1, { restS: 120 }), {
        methods: ['sprint-aceleracion'],
        notes: 'Recuperación completa entre series.',
      }),
      ...(level > 1
        ? [ex('flying_sprint', rx(3, 1, { restS: 180 }), { methods: ['sprint-aceleracion'] })]
        : []),
      ...(team || kind === 'general'
        ? [
            ex(
              pick(level, ['shuttle_run', 'deceleration_drill', 'drill_505'] as const),
              rx(4, 1, { restS: 90 }),
              { methods: ['cod-agilidad'] },
            ),
          ]
        : []),
    ]);
  const SQ = pick(level, ['goblet_squat', 'back_squat', 'back_squat'] as const);
  const HI = pick(level, ['romanian_deadlift', 'romanian_deadlift', 'deadlift'] as const);
  const UNI = pick(level, [
    'split_squat',
    'bulgarian_split_squat',
    'bulgarian_split_squat',
  ] as const);
  const HP = pick(level, ['push_up', 'dumbbell_bench_press', 'bench_press'] as const);
  const VR = pick(level, ['lat_pulldown', 'band_assisted_pull_up', 'pull_up'] as const);
  const HR = pick(level, ['seated_cable_row', 'one_arm_dumbbell_row', 'barbell_row'] as const);
  const VP = pick(level, [
    'dumbbell_shoulder_press',
    'dumbbell_shoulder_press',
    'overhead_press',
  ] as const);
  const objective = 'Fuerza, potencia y velocidad transferibles al deporte';
  const minutes = 60 + 10 * (level - 1);
  const lowerSession = (label: string, i: number) =>
    session(
      label,
      i ? `Fuerza y velocidad ${label}` : `Fuerza y potencia ${label}`,
      objective,
      minutes,
      [
        warmAthlete(),
        ...(i ? [speed()] : [plyo(0), power(0)]),
        block('main_strength', 'Fuerza', [main(i ? HI : SQ), acc(UNI, 'each'), acc(i ? SQ : HI)]),
        prevention(i),
      ],
    );
  const upperSession = (label: string, i: number) =>
    session(label, `Torso y potencia ${label}`, objective, minutes - 10, [
      warmAthlete(),
      power(1),
      block('main_strength', 'Fuerza', [
        main(i ? VP : HP),
        main(i ? HR : VR),
        acc(i ? HP : VP),
        acc('face_pull'),
      ]),
      prevention(1),
    ]);
  const fullSession = (label: string, i: number) =>
    session(label, `Cuerpo completo ${label}`, objective, minutes, [
      warmAthlete(),
      i ? speed() : plyo(0),
      power(i),
      block('main_strength', 'Fuerza', [
        main(i ? HI : SQ),
        acc(i ? HR : HP),
        acc(i ? VP : VR),
        acc(UNI, 'each'),
      ]),
      prevention(i),
    ]);
  const speedSession = (label: string) =>
    session(label, `Velocidad y potencia ${label}`, objective, minutes - 20, [
      warmAthlete(),
      speed(),
      plyo(1),
      power(1),
      prevention(0),
    ]);
  if (days === 2) return [fullSession('A', 0), fullSession('B', 1)];
  if (days === 3) return [lowerSession('A', 0), upperSession('B', 0), fullSession('C', 1)];
  const four = [
    lowerSession('A', 0),
    upperSession('B', 0),
    lowerSession('C', 1),
    upperSession('D', 1),
  ];
  return days === 4 ? four : [...four, speedSession('E')];
}

/** Endurance sports: heavy strength and plyometrics alongside endurance training (concurrent). */
function enduranceSessions(level: Level, days: number): TemplateSession[] {
  const heavy = pick(level, [
    rx(3, [6, 8], { ...rir(3), restS: 150 }),
    rx(4, [4, 6], { ...rir(2), restS: 180 }),
    rx(4, [3, 5], { ...rir(2), restS: 180 }),
  ] as const);
  const methods = level === 1 ? ['concurrente', 'rir-rpe'] : ['concurrente', 'fuerza-maxima'];
  const m = (slug: string, side?: Side) => ex(slug, heavy, { methods, progression: WAVE(1), side });
  const s = (label: string, i: number) =>
    session(
      label,
      i === 1 ? `Fuerza y pliometría ${label}` : `Fuerza ${label}`,
      'Fuerza máxima y reactiva sin interferir con las sesiones clave de resistencia',
      50,
      [
        warmAthlete(),
        ...(i === 1
          ? [
              block('plyometric', 'Pliometría', [
                ex('pogo_jumps', rx(3, null, { contacts: pick(level, [10, 15, 20] as const) }), {
                  methods: ['pliometria'],
                }),
                ex(
                  pick(level, ['squat_jump', 'box_jump', 'drop_jump'] as const),
                  rx(3, [4, 5], { restS: 90 }),
                  { methods: ['pliometria'] },
                ),
              ]),
            ]
          : []),
        block('main_strength', 'Fuerza', [
          i === 2
            ? m(
                pick(level, ['step_up', 'bulgarian_split_squat', 'bulgarian_split_squat'] as const),
                'each',
              )
            : m(pick(level, ['leg_press', 'back_squat', 'back_squat'] as const)),
          // Heavy hip extension: a single-leg hinge is limited by balance, not strength.
          i === 1
            ? m('hip_thrust')
            : m(pick(level, ['romanian_deadlift', 'romanian_deadlift', 'deadlift'] as const)),
          ex('standing_calf_raise', rx(3, [8, 12], { ...rir(2), restS: 60 }), {
            methods: ['concurrente'],
            progression: WAVE(1),
          }),
        ]),
        block('core', 'Core', [
          ex('side_plank', rx(2, null, { durationS: 30 }), { methods: ['core'], side: 'each' }),
          ex('dead_bug', rx(2, [8, 10]), { methods: ['core'] }),
        ]),
      ],
      'Colócala lejos de las sesiones clave de resistencia (series, tiradas largas).',
    );
  return [0, 1, 2].slice(0, days).map((i) => s(letter(i), i));
}

// ── Profiles × levels × days ─────────────────────────────────────────────────

interface Spec {
  profile: string;
  /** Days per week offered at each level. */
  days: Record<Level, readonly number[]>;
  build: (level: Level, days: number) => TemplateSession[];
  /** A peak week before the test week (performance and maximal strength). */
  peak: boolean;
}

export const PROFILE_TEMPLATE_SPECS: Spec[] = [
  {
    profile: 'rendimiento-deportivo',
    days: { 1: [2, 3], 2: [2, 3, 4], 3: [3, 4, 5] },
    build: (l, d) => athleteSessions('general', l, d),
    peak: true,
  },
  {
    profile: 'deportes-equipo',
    days: { 1: [2, 3], 2: [2, 3, 4], 3: [2, 3, 4] },
    build: (l, d) => athleteSessions('equipo', l, d),
    peak: true,
  },
  {
    profile: 'deportes-individuales',
    days: { 1: [2, 3], 2: [2, 3, 4], 3: [3, 4, 5] },
    build: (l, d) => athleteSessions('individual', l, d),
    peak: true,
  },
  {
    profile: 'deportes-resistencia',
    days: { 1: [2], 2: [2, 3], 3: [2, 3] },
    build: enduranceSessions,
    peak: false,
  },
  {
    profile: 'hipertrofia',
    days: { 1: [2, 3, 4], 2: [3, 4, 5], 3: [3, 4, 5] },
    build: (l, d) => gymSessions('hipertrofia', l, d),
    peak: false,
  },
  {
    profile: 'fuerza',
    days: { 1: [2, 3], 2: [2, 3, 4], 3: [3, 4] },
    build: (l, d) => gymSessions('fuerza', l, d),
    peak: true,
  },
  {
    profile: 'iniciacion-fuerza',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3] },
    build: (l, d) => gymSessions('iniciacion', l, d),
    peak: false,
  },
  {
    profile: 'salud',
    days: { 1: [2, 3, 4], 2: [2, 3, 4], 3: [2, 3, 4] },
    build: (l, d) => healthSessions('salud', l, d),
    peak: false,
  },
  {
    profile: 'mejora-funcionalidad',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3, 4] },
    build: (l, d) => healthSessions('funcionalidad', l, d),
    peak: false,
  },
  {
    profile: 'funcion-muscular',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3, 4] },
    build: (l, d) => gymSessions('funcion', l, d),
    peak: false,
  },
  {
    profile: 'funcion-coordinativa',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3] },
    build: coordinationSessions,
    peak: false,
  },
  {
    profile: 'adulto-mayor',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3, 4] },
    build: olderSessions,
    peak: false,
  },
  {
    profile: 'paralisis-cerebral-leve',
    days: { 1: [2, 3], 2: [2, 3], 3: [2, 3] },
    build: cpSessions,
    peak: false,
  },
];

const LEVEL_SLUG = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' } as const;
const EXTRA: Record<string, string> = {
  'adulto-mayor':
    'El equilibrio está en todas las sesiones: en mayores sanos, las mayores mejoras se asociaron a 3 sesiones por semana durante 11–12 semanas, y combinar equilibrio, tareas funcionales y fuerza probablemente reduce más las caídas. Ante caídas recientes, mareos u otros síntomas: requiere valoración por profesional sanitario.',
  'paralisis-cerebral-leve':
    'Coordinar con el equipo sanitario. El nivel depende de la capacidad y la evaluación, no del diagnóstico; la evidencia sobre la fuerza en parálisis cerebral es contradictoria y casi toda en niños y adolescentes.',
  'deportes-resistencia':
    'La fuerza complementa el entrenamiento de resistencia: colócala lejos de las sesiones clave.',
};

/** Methods cited anywhere in a definition, without repetitions. */
export function methodsOf(def: TemplateDefinition): string[] {
  const all = [def.sessions, ...def.phases.map((p) => p.sessions ?? [])].flat();
  return [
    ...new Set(
      all.flatMap((s) => s.blocks.flatMap((b) => b.exercises.flatMap((e) => e.methods ?? []))),
    ),
  ].sort();
}

function definition(
  days: number,
  sessions: TemplateSession[],
  phase: { name: string; objective: string },
  peak: boolean,
): TemplateDefinition {
  if (sessions.length !== days)
    throw new Error(`Generated template: ${sessions.length} sessions for ${days} days`);
  return {
    durationMonths: 3,
    sessionsPerWeek: days,
    phases: [{ ...phase, mesocycles: mesocycles(peak) }],
    sessions,
  };
}

// ── Risk-reduction routines ──────────────────────────────────────────────────

interface Routine {
  slug: string;
  name: string;
  /** What each level does, then what the evidence says (never prevention as a fact). */
  levels: readonly [string, string, string];
  evidence: string;
  objective: string;
  exercises: (level: Level) => TemplateExercise[];
}

export const RISK_REDUCTION_ROUTINES: Routine[] = [
  {
    slug: 'aductores',
    name: 'Rutina de aductores',
    objective: 'Fuerza de aductores con el Copenhagen, de palanca corta a palanca larga',
    levels: [
      'Copenhagen de palanca corta (rodilla en el banco) e isométrico de aductores.',
      'Copenhagen de palanca larga (tobillo en el banco) e isométrico con más esfuerzo.',
      'Copenhagen de palanca larga con movimiento y saltos laterales.',
    ],
    evidence:
      'En futbolistas, un programa de aductores basado en el Copenhagen se asoció a menos problemas inguinales; no garantiza evitar lesiones. Dos veces por semana, unos 15 min, al final del calentamiento o de la sesión.',
    exercises: (level) =>
      level === 1
        ? [
            ex('isometric_hip_adduction', rx(3, null, { durationS: 10, restS: 30 }), {
              methods: ['isometricos'],
              notes:
                'Aprieta un balón o un cojín entre las rodillas, cada vez más fuerte y sin dolor.',
            }),
            ex('copenhagen_plank', rx(2, null, { durationS: 15, restS: 45 }), {
              methods: ['calentamiento-preventivo'],
              side: 'each',
              notes: 'Palanca corta: la rodilla apoyada en el banco.',
            }),
            ex('side_plank', rx(2, null, { durationS: 20 }), { methods: ['core'], side: 'each' }),
          ]
        : level === 2
          ? [
              ex('copenhagen_plank', rx(3, null, { durationS: 20, restS: 45 }), {
                methods: ['calentamiento-preventivo'],
                side: 'each',
                notes:
                  'Palanca larga: el tobillo apoyado en el banco. Si molesta, vuelve a la palanca corta.',
              }),
              ex('isometric_hip_adduction', rx(3, null, { durationS: 15, restS: 30 }), {
                methods: ['isometricos'],
                notes: 'Esfuerzo alto y sin dolor.',
              }),
              ex('side_plank', rx(2, null, { durationS: 30 }), { methods: ['core'], side: 'each' }),
            ]
          : [
              ex('copenhagen_plank', rx(3, [6, 10], { restS: 60 }), {
                methods: ['calentamiento-preventivo'],
                side: 'each',
                notes:
                  'Palanca larga y con movimiento: baja y sube la pierna de abajo con control.',
              }),
              ex('lateral_bounds', rx(3, [4, 6], { restS: 60 }), {
                methods: ['pliometria'],
                side: 'each',
                notes: 'Aterriza estable y frena el desplazamiento.',
              }),
              ex('side_plank', rx(2, null, { durationS: 40 }), { methods: ['core'], side: 'each' }),
            ],
  },
  {
    slug: 'isquiosurales',
    name: 'Rutina de isquiosurales',
    objective: 'Fuerza excéntrica de isquiosurales',
    levels: [
      'Puente y peso muerto a una pierna y peso muerto rumano, como base antes del nórdico.',
      'Nórdico con volumen bajo y peso muerto rumano.',
      'Nórdico con más volumen y peso muerto rumano pesado.',
    ],
    evidence:
      'Volúmenes bajos de nórdico bastan para mejorar la fuerza excéntrica; su efecto sobre las lesiones es incierto en su magnitud («puede reducir»). Dos veces por semana, unos 15 min.',
    exercises: (level) =>
      level === 1
        ? [
            ex('glute_bridge', rx(3, [8, 10], { ...rir(3), restS: 60 }), {
              methods: ['rir-rpe'],
              side: 'each',
              notes: 'Puente a una pierna.',
            }),
            ex('single_leg_rdl', rx(2, [8, 10], { ...rir(3), restS: 60 }), {
              methods: ['rir-rpe'],
              side: 'each',
            }),
            ex('romanian_deadlift', rx(2, [8, 10], { ...rir(3), restS: 90 }), {
              methods: ['rir-rpe'],
            }),
          ]
        : level === 2
          ? [
              ex('nordic_hamstring_curl', rx(2, [4, 6], { restS: 120 }), {
                methods: ['nordic-hamstring'],
                notes: 'Baja lo más despacio que puedas; ayúdate con las manos al final.',
              }),
              ex('romanian_deadlift', rx(3, [6, 8], { ...rir(2), restS: 120 }), {
                methods: ['rir-rpe'],
                progression: WAVE(1),
              }),
              ex('single_leg_rdl', rx(2, [8, 10], { ...rir(2), restS: 60 }), {
                methods: ['rir-rpe'],
                side: 'each',
              }),
            ]
          : [
              ex('nordic_hamstring_curl', rx(3, [5, 8], { restS: 120 }), {
                methods: ['nordic-hamstring'],
                notes: 'Frena la caída en todo el recorrido.',
              }),
              ex('romanian_deadlift', rx(3, [5, 6], { ...rir(2), restS: 150 }), {
                methods: ['fuerza-maxima', 'rir-rpe'],
                progression: WAVE(1),
              }),
              ex('single_leg_rdl', rx(2, [6, 8], { ...rir(2), restS: 60 }), {
                methods: ['rir-rpe'],
                side: 'each',
              }),
            ],
  },
  {
    slug: 'cuadriceps',
    name: 'Rutina de cuádriceps',
    objective: 'Fuerza de cuádriceps isométrica, unilateral y de frenado',
    levels: [
      'Isométricos (sentadilla española y en pared) y subida a un escalón.',
      'Isométrico, zancada con bajada lenta y subida al cajón.',
      'Sentadilla búlgara con bajada lenta, frenadas y saltos a una pierna.',
    ],
    evidence:
      'Para tolerar saltos, frenadas y cambios de dirección. La plataforma no tiene evidencia verificada sobre su efecto en las lesiones: es una recomendación práctica (F). Dos veces por semana, unos 15 min.',
    exercises: (level) =>
      level === 1
        ? [
            ex('spanish_squat_iso', rx(4, null, { durationS: 20, restS: 60 }), {
              methods: ['isometricos'],
              notes: 'Esfuerzo alto pero cómodo (en torno al 70 % de tu máximo) y sin dolor.',
            }),
            ex('wall_sit', rx(2, null, { durationS: 30, restS: 60 }), { methods: ['isometricos'] }),
            ex('step_up_low', rx(2, [8, 10], { ...rir(3), restS: 60 }), {
              methods: ['rir-rpe'],
              side: 'each',
            }),
          ]
        : level === 2
          ? [
              ex('spanish_squat_iso', rx(4, null, { durationS: 20, restS: 60 }), {
                methods: ['isometricos'],
                notes: 'Esfuerzo alto y sin dolor.',
              }),
              ex('split_squat', rx(3, [8, 10], { ...rir(2), tempo: '3-0-1-0', restS: 60 }), {
                methods: ['rir-rpe'],
                side: 'each',
                notes: 'Baja en 3 segundos.',
              }),
              ex('step_up', rx(3, [6, 8], { ...rir(2), restS: 60 }), {
                methods: ['rir-rpe'],
                side: 'each',
              }),
            ]
          : [
              ex(
                'bulgarian_split_squat',
                rx(3, [6, 8], { ...rir(2), tempo: '3-0-1-0', restS: 90 }),
                {
                  methods: ['rir-rpe'],
                  side: 'each',
                  notes: 'Baja en 3 segundos.',
                },
              ),
              ex('deceleration_drill', rx(4, 1, { restS: 90 }), {
                methods: ['cod-agilidad'],
                notes: 'Frena en 2–3 pasos con el tronco estable.',
              }),
              ex('single_leg_hop', rx(3, [4, 5], { restS: 60 }), {
                methods: ['pliometria'],
                side: 'each',
                notes: 'Aterriza suave y aguanta 2 s estable.',
              }),
            ],
  },
];

function routineTemplates(): SeedTemplate[] {
  return RISK_REDUCTION_ROUTINES.flatMap((r) =>
    ([1, 2, 3] as const).map((level) => {
      const s = (label: string) =>
        session(label, `${r.name} ${label}`, r.objective, 15, [
          block(level === 3 ? 'plyometric' : 'main_strength', 'Rutina', r.exercises(level)),
        ]);
      const def = definition(
        2,
        [s('A'), s('B')],
        { name: 'Bloque de 13 semanas', objective: r.objective },
        false,
      );
      return {
        slug: `riesgo-${r.slug}-n${level}`,
        name: `${r.name} · Nivel ${level}`,
        description: `${pick(level, r.levels)} ${r.evidence}`,
        goal: 'general_physical_preparation',
        level: LEVEL_SLUG[level],
        levelN: level,
        population: ['deportistas'],
        kind: 'risk_reduction' as const,
        methods: methodsOf(def),
        definition: def,
      };
    }),
  );
}

/**
 * Every generated template: profile × level × days minus the combinations already covered by the
 * hand-written templates (seed-data/templates), plus the risk-reduction routines.
 */
export function generateProfileTemplates(handWritten: SeedTemplate[]): SeedTemplate[] {
  const covered = new Set(
    handWritten.map((t) => {
      const f = templateFacets(t);
      return `${f.profile}:${f.levelN}:${t.definition.sessionsPerWeek}:${f.kind}`;
    }),
  );
  const out: SeedTemplate[] = [];
  for (const spec of PROFILE_TEMPLATE_SPECS) {
    const profile = PROGRAMMING_PROFILES.find((p) => p.slug === spec.profile);
    if (!profile?.goal) throw new Error(`Generated template: unknown profile ${spec.profile}`);
    for (const level of [1, 2, 3] as const)
      for (const days of spec.days[level]) {
        if (covered.has(`${spec.profile}:${level}:${days}:training`)) continue;
        const summary = pick(level, profile.levels);
        const def = definition(
          days,
          spec.build(level, days),
          { name: 'Bloque de 13 semanas', objective: summary },
          spec.peak,
        );
        out.push({
          slug: `perfil-${spec.profile}-n${level}-${days}d`,
          name: `${profile.name} · Nivel ${level} · ${days} días`,
          description: [summary, EXTRA[spec.profile]].filter(Boolean).join(' '),
          goal: profile.goal,
          level: LEVEL_SLUG[level],
          profile: spec.profile,
          levelN: level,
          methods: methodsOf(def),
          definition: def,
        });
      }
  }
  return [...out, ...routineTemplates()];
}
