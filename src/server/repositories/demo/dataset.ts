import { defaultSharing, type SharingSettings } from '@/domain/access';
import {
  aggregateAttempts,
  AGGREGATION_FORMULAS,
  type AssessmentResult,
  findAssessmentTest,
} from '@/domain/assessment';
import { type Goal } from '@/domain/goals';
import {
  type Exercise,
  type ExerciseVariant,
  type Favorite,
  type ProgressionLink,
  type TrainerExerciseNote,
} from '@/domain/library/exercise';
import { type Tag, type TagCategory } from '@/domain/library/taxonomy';
import { type Provenance } from '@/domain/measurement';
import { type Client, type Trainer } from '@/domain/people';
import { type RehabCase } from '@/domain/rehab';
import { addDays, daysBetween, type IsoDate, isoWeekday } from '@/domain/time';
import { type ExercisePrescription } from '@/domain/training/prescription';
import {
  type ExerciseFeedback,
  type PlannedSession,
  type SessionLog,
  type SetRecord,
} from '@/domain/training/session';
import {
  DEMO_EXERCISES,
  DEMO_FAVORITES,
  DEMO_PERSONAL_TAGGING,
  DEMO_PROGRESSIONS,
  DEMO_TRAINER_NOTES,
  DEMO_TRAINER_TAG_CATEGORIES,
  DEMO_TRAINER_TAGS,
  DEMO_VARIANTS,
} from './library';

/**
 * Datos de demostración: TODOS son ficticios. Se generan a partir de la fecha de hoy y son
 * deterministas (sin aleatoriedad) para que las pruebas y las capturas sean reproducibles.
 */
export interface DemoDataset {
  trainers: Trainer[];
  clients: Client[];
  library: {
    exercises: Exercise[];
    variants: ExerciseVariant[];
    progressions: ProgressionLink[];
    tagCategories: TagCategory[];
    tags: Tag[];
    personalTagging: { trainerId: string; variantId: string; tagId: string }[];
    notes: TrainerExerciseNote[];
    favorites: Favorite[];
  };
  sessions: PlannedSession[];
  logs: SessionLog[];
  assessments: AssessmentResult[];
  goals: Goal[];
  rehab: RehabCase[];
  sharing: SharingSettings[];
}

export const DEMO_TRAINER_ID = 't-alex';
export const DEMO_CLIENT_ID = 'c-marta';
/** Clienta ficticia sin historial para el flujo de V1 (P-76). */
export const DEMO_NEW_CLIENT_ID = 'c-lucia';

/** Personas ficticias de «Entrar como…» (solo en `TRAINPRO_MODE=local-demo`; no es autenticación). */
export interface DemoIdentity {
  id: string;
  role: 'trainer' | 'client';
}
export const DEMO_IDENTITIES: readonly DemoIdentity[] = [
  { id: DEMO_TRAINER_ID, role: 'trainer' },
  { id: DEMO_CLIENT_ID, role: 'client' },
  { id: DEMO_NEW_CLIENT_ID, role: 'client' },
];

type Rx = Omit<ExercisePrescription, 'id' | 'order' | 'block'> & { slot: string };

interface Template {
  title: string;
  focus: string;
  minutes: number;
  coachNote?: string;
  /** `week` = semanas transcurridas desde el inicio del bloque (permite progresar cargas). */
  build: (week: number) => Rx[];
}

const kg = (base: number, step: number, week: number) => ({
  kind: 'kg' as const,
  kg: base + step * week,
});
const bw = { kind: 'bodyweight' as const };
const none = { kind: 'none' as const };
const rir = (value: number) => ({ kind: 'rir' as const, rir: value });
const fixed = (reps: number) => ({ kind: 'fixed' as const, reps });
const range = (min: number, max: number) => ({ kind: 'range' as const, min, max });
const tempo = (e: number, p1: number, c: number | 'X', p2: number) => ({
  eccentric: e,
  firstPause: p1,
  concentric: c,
  secondPause: p2,
});

const TEMPLATES = {
  martaLower: {
    title: 'Fuerza · tren inferior',
    focus: 'Sentadilla y bisagra de cadera',
    minutes: 55,
    coachNote:
      'Calienta 8–10 minutos antes de empezar. Si notas una molestia que no cede, para y escríbeme.',
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-back-squat',
        sets: 4,
        reps: range(6, 8),
        load: kg(45, 2.5, w),
        restSeconds: 150,
        tempo: tempo(3, 1, 'X', 0),
        effort: rir(2),
      },
      {
        slot: 'A2',
        variantId: 'ex-rdl',
        sets: 3,
        reps: fixed(8),
        load: kg(40, 2.5, w),
        restSeconds: 120,
        tempo: tempo(3, 0, 1, 0),
        effort: rir(2),
      },
      {
        slot: 'B1',
        variantId: 'ex-split-squat',
        sets: 3,
        reps: range(8, 10),
        load: kg(20, 0, w),
        restSeconds: 90,
        effort: rir(2),
        notes: 'Repeticiones por pierna. Carga total: dos mancuernas de 10 kg.',
      },
      {
        slot: 'B2',
        variantId: 'ex-dead-bug',
        sets: 3,
        reps: fixed(10),
        load: bw,
        restSeconds: 60,
        effort: none,
        notes: 'Alterna lados en cada repetición.',
      },
      {
        slot: 'C1',
        variantId: 'ex-side-plank',
        sets: 3,
        reps: { kind: 'seconds', seconds: 30 },
        load: bw,
        restSeconds: 45,
        effort: none,
        notes: 'Por lado.',
      },
    ],
  },
  martaUpper: {
    title: 'Fuerza · tren superior y core',
    focus: 'Empuje y tracción',
    minutes: 50,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-bench-press',
        sets: 4,
        reps: range(6, 8),
        load: kg(30, 1.25, w),
        restSeconds: 120,
        tempo: tempo(2, 1, 1, 0),
        effort: rir(2),
      },
      {
        slot: 'A2',
        variantId: 'ex-db-row',
        sets: 4,
        reps: fixed(10),
        load: kg(16, 0, w),
        restSeconds: 90,
        effort: rir(2),
        notes: 'Por brazo.',
      },
      {
        slot: 'B1',
        variantId: 'ex-db-press',
        sets: 3,
        reps: fixed(10),
        load: kg(16, 0, w),
        restSeconds: 90,
        effort: { kind: 'rpe', rpe: 7 },
        notes: 'Carga total: dos mancuernas de 8 kg.',
      },
      {
        slot: 'B2',
        variantId: 'ex-farmer-carry',
        sets: 3,
        reps: { kind: 'meters', meters: 30 },
        load: { kind: 'text', text: '2 × 16 kg' },
        restSeconds: 60,
        effort: none,
      },
    ],
  },
  martaPower: {
    title: 'Fuerza global y potencia',
    focus: 'Salto, cadera y trabajo unilateral',
    minutes: 50,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-cmj',
        sets: 4,
        reps: fixed(5),
        load: bw,
        restSeconds: 90,
        effort: none,
        notes: 'Máxima intención en cada salto.',
      },
      {
        slot: 'A2',
        variantId: 'ex-hip-thrust',
        sets: 4,
        reps: range(8, 10),
        load: kg(50, 5, w),
        restSeconds: 120,
        effort: rir(2),
      },
      {
        slot: 'B1',
        variantId: 'ex-goblet-squat',
        sets: 3,
        reps: fixed(10),
        load: kg(16, 0, w),
        restSeconds: 90,
        effort: { kind: 'character', performed: 10, possible: 14 },
      },
      {
        slot: 'B2',
        variantId: 'ex-calf-raise',
        sets: 3,
        reps: fixed(12),
        load: bw,
        restSeconds: 60,
        tempo: tempo(3, 1, 1, 0),
        effort: none,
        notes: 'Por pierna.',
      },
    ],
  },
  diegoRehab: {
    title: 'Readaptación · fuerza y control',
    focus: 'Tobillo derecho, fase 2',
    minutes: 45,
    coachNote: 'Respeta el umbral de molestia acordado con tu fisioterapeuta.',
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-ankle-mobility',
        sets: 2,
        reps: fixed(10),
        load: bw,
        restSeconds: 30,
        effort: none,
        notes: 'Por pierna.',
      },
      {
        slot: 'A2',
        variantId: 'ex-calf-raise',
        sets: 4,
        reps: fixed(12),
        load: bw,
        restSeconds: 60,
        tempo: tempo(3, 1, 1, 0),
        effort: none,
        notes: 'Por pierna.',
      },
      {
        slot: 'B1',
        variantId: 'ex-split-squat',
        sets: 3,
        reps: fixed(8),
        load: kg(16, 2, w),
        restSeconds: 90,
        effort: rir(3),
      },
      {
        slot: 'B2',
        variantId: 'ex-pogo',
        sets: 3,
        reps: fixed(20),
        load: bw,
        restSeconds: 60,
        effort: none,
        notes: 'Contactos suaves.',
      },
      {
        slot: 'C1',
        variantId: 'ex-side-plank',
        sets: 3,
        reps: { kind: 'seconds', seconds: 30 },
        load: bw,
        restSeconds: 45,
        effort: none,
      },
    ],
  },
  carmenStrength: {
    title: 'Fuerza y equilibrio',
    focus: 'Fuerza funcional',
    minutes: 45,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-goblet-squat',
        sets: 3,
        reps: fixed(10),
        load: kg(8, 1, w),
        restSeconds: 90,
        effort: { kind: 'rpe', rpe: 6 },
        notes: 'Puedes usar un banco detrás como referencia de profundidad.',
      },
      {
        slot: 'A2',
        variantId: 'ex-db-row',
        sets: 3,
        reps: fixed(10),
        load: kg(8, 0, w),
        restSeconds: 90,
        effort: { kind: 'rpe', rpe: 6 },
      },
      {
        slot: 'B1',
        variantId: 'ex-farmer-carry',
        sets: 3,
        reps: { kind: 'meters', meters: 20 },
        load: { kind: 'text', text: '2 × 6 kg' },
        restSeconds: 60,
        effort: none,
      },
      {
        slot: 'B2',
        variantId: 'ex-calf-raise',
        sets: 2,
        reps: fixed(10),
        load: bw,
        restSeconds: 60,
        effort: none,
        notes: 'Con apoyo en la pared.',
      },
    ],
  },
  nereaPower: {
    title: 'Potencia y aceleración',
    focus: 'Salto y sprint',
    minutes: 60,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-cmj',
        sets: 4,
        reps: fixed(4),
        load: bw,
        restSeconds: 120,
        effort: none,
      },
      {
        slot: 'A2',
        variantId: 'ex-acceleration',
        sets: 6,
        reps: { kind: 'meters', meters: 10 },
        load: bw,
        restSeconds: 120,
        effort: none,
        notes: 'Recuperación completa.',
      },
      {
        slot: 'B1',
        variantId: 'ex-hip-thrust',
        sets: 3,
        reps: fixed(6),
        load: kg(70, 5, w),
        restSeconds: 150,
        effort: rir(2),
      },
      {
        slot: 'B2',
        variantId: 'ex-pogo',
        sets: 3,
        reps: fixed(15),
        load: bw,
        restSeconds: 60,
        effort: none,
      },
    ],
  },
  nereaStrength: {
    title: 'Fuerza · tren inferior',
    focus: 'Fuerza máxima',
    minutes: 55,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-back-squat',
        sets: 5,
        reps: range(4, 6),
        load: kg(60, 2.5, w),
        restSeconds: 180,
        tempo: tempo(2, 1, 'X', 0),
        effort: rir(2),
      },
      {
        slot: 'A2',
        variantId: 'ex-rdl',
        sets: 3,
        reps: fixed(6),
        load: kg(55, 2.5, w),
        restSeconds: 150,
        effort: rir(2),
      },
      {
        slot: 'B1',
        variantId: 'ex-split-squat',
        sets: 3,
        reps: fixed(6),
        load: kg(24, 0, w),
        restSeconds: 120,
        effort: rir(2),
      },
      {
        slot: 'B2',
        variantId: 'ex-pullup',
        sets: 3,
        reps: fixed(5),
        load: bw,
        restSeconds: 120,
        effort: rir(2),
      },
    ],
  },
  javierGeneral: {
    title: 'Fuerza general',
    focus: 'Cuerpo completo',
    minutes: 45,
    build: (w) => [
      {
        slot: 'A1',
        variantId: 'ex-goblet-squat',
        sets: 3,
        reps: fixed(10),
        load: kg(20, 2, w),
        restSeconds: 90,
        effort: rir(3),
      },
      {
        slot: 'A2',
        variantId: 'ex-db-row',
        sets: 3,
        reps: fixed(10),
        load: kg(20, 0, w),
        restSeconds: 90,
        effort: rir(3),
      },
      {
        slot: 'B1',
        variantId: 'ex-db-press',
        sets: 3,
        reps: fixed(10),
        load: kg(20, 0, w),
        restSeconds: 90,
        effort: rir(3),
      },
    ],
  },
} satisfies Record<string, Template>;

/** Hash determinista (djb2) para variar los registros sin aleatoriedad. */
function hash(text: string): number {
  let value = 5381;
  for (const char of text) value = ((value << 5) + value + char.charCodeAt(0)) >>> 0;
  return value;
}

function buildSession(
  clientId: string,
  date: IsoDate,
  template: Template,
  week: number,
): PlannedSession {
  const id = `s-${clientId.slice(2)}-${date}`;
  return {
    id,
    clientId,
    date,
    title: template.title,
    focus: template.focus,
    estimatedMinutes: template.minutes,
    ...(template.coachNote ? { coachNote: template.coachNote } : {}),
    exercises: template.build(week).map(({ slot, ...rx }, index) => ({
      ...rx,
      id: `${id}-${index + 1}`,
      block: slot.charAt(0),
      order: index + 1,
    })),
  };
}

type LogScenario = 'completed' | 'interrupted' | 'finished_early' | 'completed_with_resend';

function setRecords(session: PlannedSession, seed: number, doneExercises: number): SetRecord[] {
  return session.exercises.flatMap((rx, rxIndex) =>
    Array.from({ length: rx.sets }, (_, setIndex) => {
      const reps =
        rx.reps.kind === 'fixed'
          ? rx.reps.reps
          : rx.reps.kind === 'range'
            ? rx.reps.min + ((seed + setIndex) % (rx.reps.max - rx.reps.min + 1))
            : 0; // series por tiempo o distancia: cuentan como serie, no suman repeticiones
      return {
        prescriptionId: rx.id,
        setNumber: setIndex + 1,
        reps,
        loadKg: rx.load.kind === 'kg' ? rx.load.kg : null,
        completed: rxIndex < doneExercises,
      };
    }),
  );
}

/** Valoración autodeclarada de los ejercicios hechos con objetivo de esfuerzo (cerca de lo prescrito). */
function feedbackFor(
  session: PlannedSession,
  seed: number,
  doneExercises: number,
): ExerciseFeedback[] {
  return session.exercises.slice(0, doneExercises).flatMap((rx, index): ExerciseFeedback[] => {
    if (rx.effort.kind === 'rir')
      return [{ prescriptionId: rx.id, rir: Math.max(0, rx.effort.rir - ((seed + index) % 2)) }];
    if (rx.effort.kind === 'rpe')
      return [{ prescriptionId: rx.id, rpe: Math.min(10, rx.effort.rpe + ((seed + index) % 2)) }];
    return [];
  });
}

/**
 * Registro simulado de una sesión pasada. Escenarios: completa; interrumpida (se empezó y no se
 * terminó); terminada antes de tiempo; o completa con una serie reenviada por duplicado (para
 * comprobar que los cálculos no la cuentan dos veces). `null` = no realizada.
 */
function buildLog(session: PlannedSession): SessionLog | null {
  const seed = hash(session.id);
  const kind = seed % 8;
  if (kind === 0) return null;
  const scenario: LogScenario =
    kind === 1
      ? 'interrupted'
      : kind === 2
        ? 'finished_early'
        : kind === 3
          ? 'completed_with_resend'
          : 'completed';

  const all = session.exercises.length;
  const doneExercises =
    scenario === 'interrupted' ? 2 : scenario === 'finished_early' ? Math.min(3, all - 1) : all;
  const sets = setRecords(session, seed, doneExercises);
  if (scenario === 'completed_with_resend' && sets[0]) sets.push({ ...sets[0] });
  const comment = DEMO_COMMENTS[seed % DEMO_COMMENTS.length];
  const base = {
    id: `l-${session.id}`,
    sessionId: session.id,
    clientId: session.clientId,
    date: session.date,
    startedAt: `${session.date}T18:00:00.000Z`,
    sets,
    exerciseFeedback: feedbackFor(session, seed, doneExercises),
  };
  if (scenario === 'interrupted') return base;
  return {
    ...base,
    finishedAt: `${session.date}T19:00:00.000Z`,
    perceivedEffort: 5 + (seed % 4),
    ...(scenario === 'finished_early'
      ? { comment: 'He tenido que terminar antes: me he quedado sin tiempo.' }
      : comment
        ? { comment }
        : {}),
  };
}

/** Sesión de hoy empezada y sin terminar (para mostrar el estado «En curso»). */
function buildInProgressLog(session: PlannedSession): SessionLog {
  return {
    id: `l-${session.id}`,
    sessionId: session.id,
    clientId: session.clientId,
    date: session.date,
    startedAt: `${session.date}T08:00:00.000Z`,
    sets: setRecords(session, hash(session.id), 1),
  };
}

/** Observaciones ficticias del cliente (huecos vacíos = sin comentario). */
const DEMO_COMMENTS: (string | undefined)[] = [
  'Me he encontrado con mucha energía.',
  undefined,
  'La última serie de sentadilla me ha costado más de lo esperado.',
  undefined,
  'Molestia leve en la rodilla izquierda al final; ha desaparecido al estirar.',
  undefined,
];

function provenance(
  date: IsoDate,
  partial: Omit<Provenance, 'measuredAt' | 'recordedAt'>,
): Provenance {
  return { ...partial, measuredAt: `${date}T09:30:00.000Z`, recordedAt: `${date}T10:00:00.000Z` };
}

const jumpApp = (date: IsoDate) =>
  provenance(date, {
    origin: 'imported',
    method: 'Altura de salto informada por la aplicación de salto',
    instrument: 'Aplicación de salto (ficticia)',
    importedFrom: 'Exportación CSV de la aplicación de salto (ficticia)',
    recordedBy: 'device',
  });
const photocells = (date: IsoDate) =>
  provenance(date, {
    origin: 'direct',
    method: 'Cronometraje con fotocélulas, salida a 0,5 m',
    instrument: 'Fotocélulas (ficticias)',
    recordedBy: 'trainer',
  });
const counted = (date: IsoDate) =>
  provenance(date, {
    origin: 'direct',
    method: 'Conteo de repeticiones por el entrenador',
    recordedBy: 'trainer',
  });

export function buildDemoDataset(today: IsoDate): DemoDataset {
  const start = addDays(today, -27);
  const end = addDays(today, 7);
  const week = (date: IsoDate) => Math.floor(daysBetween(start, date) / 7);

  const clients: Client[] = [
    {
      id: DEMO_CLIENT_ID,
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Marta Ríos',
      status: 'active',
      population: 'general_health',
      goal: 'Ganar fuerza general y preparar una carrera de 10 km',
      sport: 'Carrera popular',
      startedOn: addDays(today, -120),
    },
    {
      id: 'c-diego',
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Diego Alonso',
      status: 'active',
      population: 'return_to_sport',
      goal: 'Volver al fútbol tras un esguince de tobillo',
      sport: 'Fútbol',
      startedOn: addDays(today, -30),
    },
    {
      id: 'c-carmen',
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Carmen Vidal',
      status: 'active',
      population: 'older_adult',
      goal: 'Mantener la autonomía, la fuerza y el equilibrio',
      startedOn: addDays(today, -200),
    },
    {
      id: 'c-nerea',
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Nerea Campos',
      status: 'active',
      population: 'performance',
      goal: 'Mejorar el salto y la aceleración',
      sport: 'Baloncesto',
      startedOn: addDays(today, -90),
    },
    {
      id: 'c-javier',
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Javier Soler',
      status: 'paused',
      population: 'general_health',
      goal: 'Retomar el entrenamiento tras una pausa por trabajo',
      startedOn: addDays(today, -150),
    },
    {
      id: DEMO_NEW_CLIENT_ID,
      trainerId: DEMO_TRAINER_ID,
      displayName: 'Lucía Gil',
      status: 'active',
      population: 'general_health',
      goal: 'Ganar fuerza en el tren inferior',
      startedOn: addDays(today, -3),
    },
  ];

  /** Qué plantilla toca cada día para cada cliente (o ninguna). */
  const schedule: Record<string, (date: IsoDate) => Template | null> = {
    // Marta entrena en días alternos contados desde hoy: siempre tiene sesión hoy.
    [DEMO_CLIENT_ID]: (date) => {
      const offset = ((daysBetween(today, date) % 7) + 7) % 7;
      return offset === 0
        ? TEMPLATES.martaLower
        : offset === 2
          ? TEMPLATES.martaUpper
          : offset === 4
            ? TEMPLATES.martaPower
            : null;
    },
    'c-diego': (date) => ([1, 3, 5].includes(isoWeekday(date)) ? TEMPLATES.diegoRehab : null),
    'c-carmen': (date) => ([2, 4].includes(isoWeekday(date)) ? TEMPLATES.carmenStrength : null),
    'c-nerea': (date) => {
      const day = isoWeekday(date);
      return day === 1 ? TEMPLATES.nereaPower : day === 4 ? TEMPLATES.nereaStrength : null;
    },
    // Javier está en pausa: solo tiene sesiones antiguas.
    'c-javier': (date) =>
      date < addDays(today, -14) && [2, 5].includes(isoWeekday(date))
        ? TEMPLATES.javierGeneral
        : null,
  };

  const sessions: PlannedSession[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    for (const client of clients) {
      const template = schedule[client.id]?.(date);
      if (template) sessions.push(buildSession(client.id, date, template, week(date)));
    }
  }

  const logs = sessions
    .filter((session) => session.date < today)
    .map(buildLog)
    .filter((log): log is SessionLog => log !== null);
  // Una sesión de hoy de otro cliente (no la de Marta) queda «en curso».
  const inProgress = sessions.find(
    (session) => session.date === today && session.clientId !== DEMO_CLIENT_ID,
  );
  if (inProgress) logs.push(buildInProgressLog(inProgress));

  const single = (
    clientId: string,
    testId: string,
    daysAgo: number,
    value: number,
    unit: AssessmentResult['measurement']['unit'],
    source: (date: IsoDate) => Provenance,
  ): AssessmentResult => {
    const date = addDays(today, -daysAgo);
    return {
      id: `a-${clientId.slice(2)}-${testId}-${daysAgo}`,
      clientId,
      testId,
      date,
      measurement: { value, unit, provenance: source(date) },
    };
  };

  /** Resultado a partir de varios intentos: el valor final es un cálculo (mejor intento). */
  const bestOf = (
    clientId: string,
    testId: string,
    daysAgo: number,
    values: number[],
    unit: AssessmentResult['measurement']['unit'],
    source: (date: IsoDate) => Provenance,
  ): AssessmentResult => {
    const date = addDays(today, -daysAgo);
    const attemptSource = source(date);
    const test = findAssessmentTest(testId)!;
    const value = aggregateAttempts(values, 'best', test.betterWhen);
    return {
      id: `a-${clientId.slice(2)}-${testId}-${daysAgo}`,
      clientId,
      testId,
      date,
      attempts: values.map((v) => ({ value: v, unit, provenance: attemptSource })),
      aggregation: 'best',
      measurement: {
        value,
        unit,
        provenance: {
          origin: 'calculated',
          method: attemptSource.method,
          ...(attemptSource.instrument ? { instrument: attemptSource.instrument } : {}),
          formula: AGGREGATION_FORMULAS.best,
          measuredAt: attemptSource.measuredAt,
          recordedAt: attemptSource.recordedAt,
          recordedBy: 'system',
        },
      },
    };
  };

  const assessments: AssessmentResult[] = [
    bestOf(DEMO_CLIENT_ID, 'cmj', 49, [24.1, 24.8, 23.9], 'cm', jumpApp),
    bestOf(DEMO_CLIENT_ID, 'cmj', 7, [26.2, 26.9, 26.5], 'cm', jumpApp),
    bestOf(DEMO_CLIENT_ID, 'sprint-20', 49, [3.74, 3.71], 's', photocells),
    bestOf(DEMO_CLIENT_ID, 'sprint-20', 7, [3.64, 3.68], 's', photocells),
    bestOf('c-nerea', 'cmj', 42, [33.0, 33.5, 32.8], 'cm', jumpApp),
    bestOf('c-nerea', 'cmj', 6, [34.6, 35.1, 34.9], 'cm', jumpApp),
    bestOf('c-nerea', 'cod-505', 42, [2.55, 2.52], 's', photocells),
    bestOf('c-nerea', 'cod-505', 6, [2.47, 2.5], 's', photocells),
    single('c-carmen', 'chair-stand-30', 60, 12, 'reps', counted),
    single('c-carmen', 'chair-stand-30', 10, 14, 'reps', counted),
  ];

  const goals: Goal[] = [
    {
      id: 'g-marta-10k',
      clientId: DEMO_CLIENT_ID,
      title: 'Completar una carrera de 10 km',
      area: 'performance',
      status: 'active',
      startedOn: addDays(today, -120),
      targetDate: addDays(today, 60),
      linkedTestIds: [],
    },
    {
      id: 'g-marta-sprint',
      clientId: DEMO_CLIENT_ID,
      title: 'Mejorar la aceleración',
      area: 'performance',
      status: 'active',
      startedOn: addDays(today, -60),
      linkedTestIds: ['sprint-20'],
    },
    {
      id: 'g-marta-jump',
      clientId: DEMO_CLIENT_ID,
      title: 'Mejorar el salto vertical',
      area: 'strength',
      status: 'active',
      startedOn: addDays(today, -60),
      linkedTestIds: ['cmj'],
    },
    {
      id: 'g-diego-team',
      clientId: 'c-diego',
      title: 'Volver a entrenar con el equipo',
      area: 'return_to_sport',
      status: 'active',
      startedOn: addDays(today, -30),
      linkedTestIds: [],
      notes: 'Coordinado con la fisioterapeuta.',
    },
    {
      id: 'g-carmen-autonomy',
      clientId: 'c-carmen',
      title: 'Mantener la autonomía en la vida diaria',
      area: 'health',
      status: 'active',
      startedOn: addDays(today, -200),
      linkedTestIds: ['chair-stand-30'],
    },
    {
      id: 'g-carmen-balance',
      clientId: 'c-carmen',
      title: 'Sentirse más segura al caminar por la calle',
      area: 'health',
      status: 'achieved',
      startedOn: addDays(today, -200),
      linkedTestIds: [],
    },
    {
      id: 'g-nerea-jump',
      clientId: 'c-nerea',
      title: 'Mejorar el salto vertical',
      area: 'performance',
      status: 'active',
      startedOn: addDays(today, -90),
      linkedTestIds: ['cmj'],
    },
    {
      id: 'g-nerea-cod',
      clientId: 'c-nerea',
      title: 'Mejorar los cambios de dirección',
      area: 'performance',
      status: 'active',
      startedOn: addDays(today, -90),
      linkedTestIds: ['cod-505'],
    },
    {
      id: 'g-javier-habit',
      clientId: 'c-javier',
      title: 'Retomar el hábito de entrenar dos días por semana',
      area: 'habit',
      status: 'paused',
      startedOn: addDays(today, -150),
      linkedTestIds: [],
    },
  ];

  const rehab: RehabCase[] = [
    {
      id: 'r-diego-tobillo',
      clientId: 'c-diego',
      title: 'Esguince lateral de tobillo derecho (caso ficticio)',
      startedOn: addDays(today, -30),
      status: 'active',
      phases: [
        {
          id: 'r-diego-f1',
          order: 1,
          name: 'Control de síntomas y movilidad',
          goal: 'Caminar con normalidad y recuperar la movilidad del tobillo.',
          criteria: [
            {
              id: 'c1',
              description: 'Marcha sin dolor en la vida diaria',
              status: 'met',
              definedBy: 'clinician',
              checkedOn: addDays(today, -18),
            },
            {
              id: 'c2',
              description: 'Movilidad de tobillo aceptable según la fisioterapeuta',
              status: 'met',
              definedBy: 'clinician',
              checkedOn: addDays(today, -18),
            },
          ],
        },
        {
          id: 'r-diego-f2',
          order: 2,
          name: 'Fuerza y control',
          goal: 'Recuperar fuerza y estabilidad en apoyo monopodal.',
          criteria: [
            {
              id: 'c3',
              description: 'Elevaciones de talón a una pierna sin dolor',
              status: 'met',
              definedBy: 'trainer',
              checkedOn: addDays(today, -4),
            },
            {
              id: 'c4',
              description: 'Equilibrio monopodal estable, a criterio de la fisioterapeuta',
              status: 'pending',
              definedBy: 'clinician',
            },
            {
              id: 'c5',
              description: 'Saltos de baja intensidad tolerados sin molestias al día siguiente',
              status: 'not_met',
              definedBy: 'trainer',
              checkedOn: addDays(today, -2),
            },
          ],
        },
        {
          id: 'r-diego-f3',
          order: 3,
          name: 'Pliometría y carrera',
          goal: 'Tolerar carrera, saltos y cambios de dirección progresivos.',
          criteria: [
            {
              id: 'c6',
              description: 'Carrera continua sin molestias',
              status: 'pending',
              definedBy: 'trainer',
            },
            {
              id: 'c7',
              description: 'Cambios de dirección a intensidad moderada tolerados',
              status: 'pending',
              definedBy: 'trainer',
            },
          ],
        },
        {
          id: 'r-diego-f4',
          order: 4,
          name: 'Retorno al entrenamiento con el equipo',
          goal: 'Integración progresiva en el entrenamiento de fútbol.',
          criteria: [
            {
              id: 'c8',
              description: 'Alta para entrenar con el equipo por parte de la fisioterapeuta',
              status: 'pending',
              definedBy: 'clinician',
            },
          ],
        },
      ],
    },
  ];

  const sharing: SharingSettings[] = [
    {
      clientId: DEMO_CLIENT_ID,
      assessments: { enabled: true, testIds: ['cmj', 'sprint-20'] },
      volume: true,
      rehab: false,
      reports: false,
    },
    ...clients
      .filter((client) => client.id !== DEMO_CLIENT_ID)
      .map((client) => defaultSharing(client.id)),
  ];

  return {
    trainers: [{ id: DEMO_TRAINER_ID, displayName: 'Alex Navarro' }],
    clients,
    library: {
      exercises: DEMO_EXERCISES,
      variants: DEMO_VARIANTS,
      progressions: DEMO_PROGRESSIONS,
      tagCategories: DEMO_TRAINER_TAG_CATEGORIES,
      tags: DEMO_TRAINER_TAGS,
      personalTagging: DEMO_PERSONAL_TAGGING,
      notes: DEMO_TRAINER_NOTES,
      favorites: DEMO_FAVORITES,
    },
    sessions,
    logs,
    assessments,
    goals,
    rehab,
    sharing,
  };
}
