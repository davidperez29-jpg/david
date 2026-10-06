import { z } from 'zod';
import { optionalText } from './common';

export const PLAN_DURATIONS = [3, 6, 9, 12] as const;
export const BLOCK_TYPES = [
  'warm_up',
  'activation',
  'power_potentiation',
  'main_strength',
  'hypertrophy',
  'plyometric',
  'sprint_cod',
  'conditioning',
  'core',
  'mobility',
  'cool_down',
  'custom',
] as const;
export const BLOCK_ORGANIZATIONS = [
  'straight_sets',
  'superset',
  'triset',
  'circuit',
  'cluster',
  'contrast',
  'complex',
  'emom',
  'amrap',
  'intervals',
] as const;
export const WEEK_TYPES = [
  'introduction',
  'progression',
  'peak',
  'deload',
  'test',
  'taper',
  'transition',
  'competition',
] as const;

const isoDate = z.iso.date();
const int = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).nullable().optional();
const dec = (min: number, max: number) =>
  z.coerce.number().finite().min(min).max(max).nullable().optional();
export const weekdays = z
  .array(z.coerce.number().int().min(1).max(7))
  .min(1)
  .max(7)
  .refine((d) => new Set(d).size === d.length, 'Días repetidos.');

/** Prescription variables (§12.4); cross-field rules live in the domain (validatePrescription). */
export const prescriptionSchema = z.object({
  sets: int(1, 20),
  repsMin: int(1, 100),
  repsMax: int(1, 100),
  repsPerCluster: int(1, 20),
  intraClusterRestS: int(0, 120),
  durationS: int(1, 7200),
  distanceM: dec(0, 50000),
  contacts: int(0, 500),
  loadKg: dec(0, 1000),
  loadPct1rm: dec(0, 110),
  rirMin: int(0, 10),
  rirMax: int(0, 10),
  rpeTarget: dec(1, 10),
  effortCharacter: optionalText(60),
  velocityTargetMps: dec(0, 5),
  velocityLossPct: int(0, 60),
  tempo: optionalText(15),
  restS: int(0, 900),
  rom: z
    .enum(['full', 'partial_lengthened', 'partial_shortened', 'specified'])
    .nullable()
    .optional(),
  intensityNote: optionalText(200),
  chainLoadKg: dec(0, 500),
});

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  primaryGoalId: z.uuid().nullable().optional(),
  durationMonths: z.coerce
    .number()
    .int()
    .refine(
      (v) => (PLAN_DURATIONS as readonly number[]).includes(v),
      'La duración debe ser 3, 6, 9 o 12 meses.',
    ),
  /** Weeks actually planned (≤ the duration); defaults to the full duration. */
  weeks: int(1, 52),
  mesocycleWeeks: z.coerce.number().int().min(1).max(16).default(4),
  startDate: isoDate.nullable().optional(),
  weekdays,
});

export const planFromTemplateSchema = z.object({
  templateId: z.uuid(),
  name: optionalText(120),
  primaryGoalId: z.uuid().nullable().optional(),
  startDate: isoDate,
  weekdays,
  /** Duration chosen when using the template (restructure phase 3); default: the template's. */
  durationMonths: z.coerce
    .number()
    .int()
    .refine(
      (v) => (PLAN_DURATIONS as readonly number[]).includes(v),
      'La duración debe ser 3, 6, 9 o 12 meses.',
    )
    .optional(),
});

export const updatePlanSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  description: optionalText(2000),
  primaryGoalId: z.uuid().nullable().optional(),
});

export const planStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'completed', 'archived']),
  reason: optionalText(500),
});

export const revisionSchema = z.object({ reason: z.string().trim().min(3).max(500) });

/** Move a session to another day of its plan (calendar, restructure phase 12). */
export const rescheduleSessionSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
  date: isoDate,
});

export const updateSessionSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
  dayLabel: z.string().trim().min(1).max(20).optional(),
  title: optionalText(120),
  objective: optionalText(500),
  scheduledDate: isoDate.nullable().optional(),
  estimatedDurationMin: int(5, 300),
  /** Planned session RPE (CR-10, 0–10). */
  targetSessionRpe: dec(0, 10),
  notesForClient: optionalText(1000),
  notesForTrainer: optionalText(2000),
});

export const blockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  organization: z.enum(BLOCK_ORGANIZATIONS).default('straight_sets'),
  label: optionalText(60),
  rounds: int(1, 20),
  restBetweenRoundsS: int(0, 900),
  notes: optionalText(500),
});
export const updateBlockSchema = blockSchema
  .partial()
  .extend({ organization: z.enum(BLOCK_ORGANIZATIONS).optional() });

const sessionExerciseFields = {
  exerciseId: z.uuid(),
  pairingLabel: optionalText(10),
  prescription: prescriptionSchema,
  loadBasisMetric: optionalText(60),
  side: z.enum(['both', 'left', 'right', 'each']),
  notesForClient: optionalText(500),
  coachNotes: optionalText(1000),
  methodIds: z.array(z.uuid()).max(10),
  /** Pre-approved alternatives the client may switch to during the session (§9.3). */
  alternativeExerciseIds: z.array(z.uuid()).max(5),
};
export const sessionExerciseSchema = z.object({
  ...sessionExerciseFields,
  prescription: prescriptionSchema.default({}),
  side: sessionExerciseFields.side.default('both'),
  methodIds: sessionExerciseFields.methodIds.default([]),
  alternativeExerciseIds: sessionExerciseFields.alternativeExerciseIds.default([]),
});
export const updateSessionExerciseSchema = z
  .object(sessionExerciseFields)
  .partial()
  .extend({
    expectedVersion: z.coerce.number().int().min(1),
    /** Required when a value generated by a progression rule or a template is overridden. */
    overrideReason: optionalText(300),
  });

/** Rows pasted into the session table (restructure phase 2): added in one transaction. */
export const addSessionExercisesSchema = z.object({
  /** Block to add to; by default the session's last block (a main block is created if none). */
  blockId: z.uuid().optional(),
  rows: z
    .array(
      z.object({
        exerciseId: z.uuid(),
        prescription: prescriptionSchema.default({}),
        notesForClient: optionalText(500),
      }),
    )
    .min(1)
    .max(200),
});

/** Programa tab: which plan, week and session to show (defaults: active plan, current week). */
export const programViewSchema = z.object({
  plan: z.uuid().optional(),
  week: z.uuid().optional(),
  session: z.uuid().optional(),
});

/** Several rows of the session table (duplicate or delete at once). */
export const sessionExerciseIdsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

/** Names typed or pasted in the table, to recognize them in the exercise library. */
export const resolveExerciseNamesSchema = z.object({
  names: z.array(z.string().trim().min(1).max(200)).min(1).max(200),
});

export const moveSchema = z.object({ direction: z.enum(['up', 'down']) });
export const duplicateSessionSchema = z.object({ targetMicrocycleId: z.uuid() });
export const duplicateWeekSchema = z.object({ targetMicrocycleId: z.uuid() });
export const duplicatePlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.uuid().optional(),
});
export const saveTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(1000),
});
export const updateMicrocycleSchema = z.object({
  weekType: z.enum(WEEK_TYPES),
  notes: optionalText(500),
});

// ── Template library (restructure phase 3) ────────────────────────────────────

export const TEMPLATE_KINDS = ['training', 'risk_reduction', 'readaptation'] as const;
export const TEMPLATE_POPULATIONS = [
  'adultos',
  'adulto_mayor',
  'deportistas',
  'jovenes',
  'pc_leve',
] as const;

const durationMonths = z.coerce
  .number()
  .int()
  .refine(
    (v) => (PLAN_DURATIONS as readonly number[]).includes(v),
    'La duración debe ser 3, 6, 9 o 12 meses.',
  );
/** Text inside a template definition: absent rather than null. */
const text = (max: number) => z.string().trim().min(1).max(max).optional();

const progressionRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('rir_wave'),
    step: z.number().int().min(0).max(3),
    floor: z.number().int().min(0).max(10),
  }),
  z.object({
    kind: z.literal('linear_load'),
    incrementKg: z.number().min(0).max(50).optional(),
    incrementPct: z.number().min(0).max(20).optional(),
    capKg: z.number().min(0).max(1000).optional(),
    capPct: z.number().min(0).max(110).optional(),
  }),
  z.object({
    kind: z.literal('add_set'),
    everyWeeks: z.number().int().min(1).max(8),
    maxSets: z.number().int().min(1).max(20),
  }),
  z.object({ kind: z.literal('double_progression'), incrementKg: z.number().min(0).max(50) }),
]);

const templateExerciseSchema = z.object({
  id: z.string().max(64).optional(),
  /** Global exercise slug or exercise id. */
  exercise: z.string().trim().min(1).max(120),
  pairingLabel: text(10),
  prescription: prescriptionSchema.default({}),
  loadBasisMetric: text(80),
  methods: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  progression: progressionRuleSchema.optional(),
  notesForClient: text(500),
  side: z.enum(['both', 'left', 'right', 'each']).optional(),
});
const templateBlockSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.enum(BLOCK_TYPES),
  organization: z.enum(BLOCK_ORGANIZATIONS).optional(),
  label: text(80),
  rounds: z.number().int().min(1).max(20).optional(),
  restBetweenRoundsS: z.number().int().min(0).max(900).optional(),
  notes: text(500),
  exercises: z.array(templateExerciseSchema).max(30),
});
const templateSessionSchema = z.object({
  id: z.string().max(64).optional(),
  dayLabel: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(120),
  objective: text(300),
  durationMin: z.number().int().min(5).max(300).optional(),
  notesForClient: text(1000),
  blocks: z.array(templateBlockSchema).max(12),
});
/** A template's content, as the template table edits it (checked again by the domain). */
export const templateDefinitionSchema = z.object({
  durationMonths,
  sessionsPerWeek: z.number().int().min(1).max(7),
  phases: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        objective: text(300),
        emphasis: z.record(z.string(), z.number()).optional(),
        sessionsPerWeek: z.number().int().min(1).max(7).optional(),
        mesocycles: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              weeks: z.number().int().min(1).max(16),
              focus: text(200),
              weekTypes: z.array(z.enum(WEEK_TYPES)).max(16).optional(),
              assessmentPlanned: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(16),
        sessions: z.array(templateSessionSchema).max(7).optional(),
      }),
    )
    .min(1)
    .max(16),
  sessions: z.array(templateSessionSchema).max(7),
  weeks: z
    .array(
      z.object({
        weekIndex: z.number().int().min(1).max(52),
        sessions: z.array(templateSessionSchema).max(7),
      }),
    )
    .max(52)
    .optional(),
  deload: z
    .object({
      setsDelta: z.number().int().min(-5).max(0),
      rirDelta: z.number().int().min(0).max(5),
    })
    .optional(),
});

/** Library filters (all optional). `client` orders by fit with that client. */
export const templateQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  profile: z.string().trim().max(80).optional(),
  level: z.coerce.number().int().min(1).max(3).optional(),
  days: z.coerce.number().int().min(1).max(7).optional(),
  population: z.enum(TEMPLATE_POPULATIONS).optional(),
  kind: z.enum(TEMPLATE_KINDS).optional(),
  scope: z.enum(['all', 'global', 'mine']).optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
  /** Only templates whose equipment the client has. */
  fitsEquipment: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
  client: z.uuid().optional(),
});

const templateMeta = {
  name: z.string().trim().min(2).max(120),
  description: optionalText(1000),
  profileSlug: z.string().trim().max(80).nullable().optional(),
  levelN: z.coerce.number().int().min(1).max(3).nullable().optional(),
  population: z.array(z.enum(TEMPLATE_POPULATIONS)).max(5).optional(),
  kind: z.enum(TEMPLATE_KINDS).optional(),
};

/** «Crear desde cero»: an empty template with the sessions of a week, ready to fill. */
export const createTemplateSchema = z.object({
  ...templateMeta,
  sessionsPerWeek: z.coerce.number().int().min(1).max(7),
  durationMonths: durationMonths.default(3),
});

/** Edit a template: details and/or content; every saved edit is a version. */
export const updateTemplateSchema = z
  .object(templateMeta)
  .partial()
  .extend({
    expectedVersion: z.coerce.number().int().min(1),
    definition: templateDefinitionSchema.optional(),
    /** What changed, shown in the version history. */
    note: optionalText(300),
  });

export const duplicateTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
});
export const archiveTemplateSchema = z.object({ archived: z.boolean() });
export const restoreTemplateVersionSchema = z.object({
  version: z.coerce.number().int().min(1),
  expectedVersion: z.coerce.number().int().min(1),
});
