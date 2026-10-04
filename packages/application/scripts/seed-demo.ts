/**
 * Demo data (§58): 3 fictitious trainers, 10 fictitious clients with different ages, goals,
 * levels and modalities. All names are invented and all emails use example.com.
 * Usage: pnpm db:seed:demo   (expects a migrated + catalogue-seeded database)
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb } from '@tp/db';
import { addDays, isoWeekday, localDate } from '@tp/domain';
import { sql } from 'drizzle-orm';
import {
  acceptInvitation,
  addHealthDeclaration,
  addHistoryEntry,
  bootstrapOrganization,
  createAssessment,
  createPrivacyRequest,
  decideRecommendation,
  evaluateAllAdjustments,
  generateClientReport,
  createImportJob,
  setExerciseTolerance,
  generatePlanProposal,
  getDecision,
  listAssessmentTests,
  runDecision,
  updateDecisionRules,
  setProgressMetrics,
  createPlanFromTemplate,
  getPlan,
  getPlayerSession,
  listPlanTemplates,
  monitorAllClients,
  publishSessions,
  saveReadiness,
  completeSession,
  syncMutations,
  setPlanStatus,
  getAssessment,
  proposeAssessmentBattery,
  recordAssessmentResult,
  setAssessmentStatus,
  createClient,
  createInvitation,
  grantConsent,
  importExerciseBank,
  type ImportedBankEntry,
  listCatalog,
  loadActor,
  MemoryMailer,
  MemoryStorage,
  recordScreening,
  resolveSession,
  type AppContext,
  type RequestContext,
} from '../src';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-entrenamiento-2026';
const { db, close } = createDb(process.env.DATABASE_URL!);
const ctx: AppContext = {
  db,
  keys: keyRingFromBase64(process.env.APP_ENCRYPTION_KEY),
  mailer: new MemoryMailer(),
  storage: new MemoryStorage(),
  baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  now: () => new Date(),
};
const as = async (userId: string): Promise<RequestContext> => ({
  ...ctx,
  actor: (await loadActor(db, userId))!,
});
const token = (link: string) => new URL(link).searchParams.get('token')!;

async function acceptAs(link: string, displayName: string): Promise<RequestContext> {
  const r = await acceptInvitation(ctx, { token: token(link), displayName, password: PASSWORD });
  const s = await resolveSession(ctx, r.token);
  if (s.status !== 'authenticated') throw new Error('demo login failed');
  return as(s.actor.userId);
}

const org = await bootstrapOrganization(db, {
  name: 'Centro Demo',
  slug: 'centro-demo',
  admin: {
    email: 'lucia.moreno@example.com',
    password: PASSWORD,
    firstName: 'Lucía',
    lastName: 'Moreno',
  },
});
// DEMO ONLY: the shared demo accounts log in without 2FA. Real organizations keep the default
// (mandatory 2FA for ADMIN, §14.1).
await db.execute(
  sql`UPDATE organizations SET require_admin_2fa = false WHERE id = ${org.organizationId}`,
);
const lucia = await as(org.adminUserId);
const pablo = await acceptAs(
  (
    await createInvitation(lucia, {
      role: 'TRAINER',
      email: 'pablo.ibarra@example.com',
      firstName: 'Pablo',
      lastName: 'Ibarra',
    })
  ).link,
  'Pablo Ibarra',
);
const nerea = await acceptAs(
  (
    await createInvitation(lucia, {
      role: 'TRAINER',
      email: 'nerea.soto@example.com',
      firstName: 'Nerea',
      lastName: 'Soto',
    })
  ).link,
  'Nerea Soto',
);

const cat = await listCatalog(lucia);
const goal = (slug: string) => cat.goals.find((g) => g.slug === slug)!.id;
const sport = (slug: string) => cat.sports.find((s) => s.slug === slug)!.id;
const eq = (...slugs: string[]) =>
  slugs.map((s) => ({
    equipmentId: cat.equipment.find((e) => e.slug === s)!.id,
    location: 'gym' as const,
  }));
const GYM = eq(
  'barbell',
  'plates',
  'squat_rack',
  'bench',
  'dumbbells',
  'cable_station',
  'pull_up_bar',
  'resistance_bands',
);

type Spec = {
  by: RequestContext;
  basics: Record<string, unknown>;
  profile: Record<string, unknown>;
  goals: { slug: string; primary?: boolean; w: number; sport?: string; level?: string }[];
  days: number[];
  equipment?: { equipmentId: string; location: 'home' | 'gym' | 'both' }[];
  account?: boolean;
  health?: {
    type: string;
    bodyRegion: string;
    requiresProfessionalAssessment: boolean;
    declaredStatus: string;
    description: string;
  };
  history?: string;
};

const specs: Spec[] = [
  {
    by: lucia,
    basics: {
      firstName: 'Marcos',
      lastName: 'Villalba',
      birthDate: '1996-03-14',
      sex: 'male',
      email: 'marcos.villalba@example.com',
      modality: 'hybrid',
    },
    profile: {
      experienceLevel: 'intermediate',
      yearsTraining: 4,
      sessionsPerWeek: 3,
      sessionDurationMin: 75,
      location: 'gym',
    },
    goals: [
      { slug: 'hypertrophy', primary: true, w: 1 },
      { slug: 'max_strength', w: 0.4 },
    ],
    days: [1, 3, 5],
    equipment: GYM,
    account: true,
    history: 'Gimnasio por libre desde 2021',
  },
  {
    by: lucia,
    basics: {
      firstName: 'Rosa',
      lastName: 'Ferrán',
      birthDate: '1954-11-02',
      sex: 'female',
      modality: 'in_person',
    },
    profile: {
      experienceLevel: 'beginner',
      yearsTraining: 0.5,
      sessionsPerWeek: 2,
      sessionDurationMin: 50,
      location: 'studio',
    },
    goals: [
      { slug: 'general_health', primary: true, w: 1 },
      { slug: 'functional_strength', w: 0.7 },
    ],
    days: [2, 4],
    equipment: eq('dumbbells', 'resistance_bands', 'mat', 'step'),
    health: {
      type: 'surgery',
      bodyRegion: 'cadera izquierda',
      requiresProfessionalAssessment: false,
      declaredStatus: 'resolved',
      description: 'Prótesis de cadera (2019), alta médica aportada',
    },
  },
  {
    by: pablo,
    basics: {
      firstName: 'Iker',
      lastName: 'Arrieta',
      birthDate: '2004-07-21',
      sex: 'male',
      email: 'iker.arrieta@example.com',
      modality: 'hybrid',
    },
    profile: {
      experienceLevel: 'intermediate',
      yearsTraining: 3,
      sessionsPerWeek: 3,
      sessionDurationMin: 60,
      location: 'gym',
    },
    goals: [
      {
        slug: 'team_sport_performance',
        primary: true,
        w: 1,
        sport: 'football',
        level: 'semi_professional',
      },
      { slug: 'max_strength', w: 0.6 },
      { slug: 'sprint', w: 0.4 },
    ],
    days: [1, 3, 5],
    equipment: GYM,
    account: true,
    history: 'Fútbol federado desde los 8 años',
  },
  {
    by: pablo,
    basics: {
      firstName: 'Claudia',
      lastName: 'Rey',
      birthDate: '2001-01-30',
      sex: 'female',
      modality: 'in_person',
    },
    profile: {
      experienceLevel: 'intermediate',
      yearsTraining: 2,
      sessionsPerWeek: 2,
      sessionDurationMin: 60,
      location: 'gym',
    },
    goals: [
      { slug: 'team_sport_performance', primary: true, w: 1, sport: 'handball', level: 'amateur' },
      { slug: 'power', w: 0.6 },
    ],
    days: [2, 4],
    equipment: GYM,
    health: {
      type: 'injury',
      bodyRegion: 'tobillo derecho',
      requiresProfessionalAssessment: true,
      declaredStatus: 'active',
      description: 'Esguince reciente declarado, aún con molestias',
    },
  },
  {
    by: nerea,
    basics: {
      firstName: 'Tomás',
      lastName: 'Garrido',
      birthDate: '1985-09-09',
      sex: 'male',
      modality: 'online',
    },
    profile: {
      experienceLevel: 'beginner',
      yearsTraining: 1,
      sessionsPerWeek: 3,
      sessionDurationMin: 45,
      location: 'home',
    },
    goals: [
      {
        slug: 'endurance_sport_performance',
        primary: true,
        w: 1,
        sport: 'distance_running',
        level: 'recreational',
      },
      { slug: 'general_physical_preparation', w: 0.5 },
    ],
    days: [1, 4, 6],
    equipment: eq('kettlebells', 'resistance_bands', 'mat'),
  },
  {
    by: nerea,
    basics: {
      firstName: 'Elena',
      lastName: 'Prieto',
      birthDate: '1990-05-18',
      sex: 'female',
      email: 'elena.prieto@example.com',
      modality: 'online',
    },
    profile: {
      experienceLevel: 'none',
      sessionsPerWeek: 2,
      sessionDurationMin: 40,
      location: 'home',
    },
    goals: [
      { slug: 'strength_initiation', primary: true, w: 1 },
      { slug: 'body_composition', w: 0.6 },
    ],
    days: [2, 5],
    equipment: eq('dumbbells', 'resistance_bands', 'mat'),
    history: 'Pilates en grupo (2019–2021)',
    health: {
      type: 'injury',
      bodyRegion: 'tobillo derecho',
      requiresProfessionalAssessment: false,
      declaredStatus: 'resolved',
      description: 'Esguince de tobillo (2022), sin molestias actuales',
    },
    account: true,
  },
  {
    by: lucia,
    basics: {
      firstName: 'Javier',
      lastName: 'Ocaña',
      birthDate: '1978-12-01',
      sex: 'male',
      modality: 'in_person',
      status: 'paused',
    },
    profile: {
      experienceLevel: 'advanced',
      yearsTraining: 15,
      sessionsPerWeek: 4,
      sessionDurationMin: 90,
      location: 'gym',
    },
    goals: [{ slug: 'max_strength', primary: true, w: 1 }],
    days: [1, 2, 4, 5],
    equipment: GYM,
  },
  {
    by: pablo,
    basics: {
      firstName: 'Sara',
      lastName: 'Lozano',
      birthDate: '2008-04-11',
      sex: 'female',
      modality: 'in_person',
    },
    profile: {
      experienceLevel: 'beginner',
      yearsTraining: 1,
      sessionsPerWeek: 2,
      sessionDurationMin: 60,
      location: 'gym',
    },
    goals: [
      { slug: 'sprint', primary: true, w: 1, sport: 'sprint_athletics', level: 'amateur' },
      { slug: 'acceleration', w: 0.8 },
    ],
    days: [2, 4],
    equipment: GYM,
  },
  {
    by: nerea,
    basics: {
      firstName: 'Andrés',
      lastName: 'Molina',
      birthDate: '1969-06-25',
      sex: 'male',
      modality: 'hybrid',
    },
    profile: {
      experienceLevel: 'none',
      sessionsPerWeek: 2,
      sessionDurationMin: 45,
      location: 'mixed',
    },
    goals: [
      { slug: 'reconditioning', primary: true, w: 1 },
      { slug: 'mobility', w: 0.5 },
    ],
    days: [3, 6],
    equipment: eq('resistance_bands', 'mat', 'bike_erg'),
    health: {
      type: 'limitation',
      bodyRegion: 'zona lumbar',
      requiresProfessionalAssessment: true,
      declaredStatus: 'unknown',
      description: 'Molestias lumbares recurrentes; sin valoración reciente',
    },
  },
  {
    by: lucia,
    basics: {
      firstName: 'Noelia',
      lastName: 'Cuesta',
      birthDate: '1993-08-08',
      sex: 'female',
      modality: 'online',
      status: 'lead',
    },
    profile: {
      experienceLevel: 'intermediate',
      yearsTraining: 2,
      sessionsPerWeek: 4,
      sessionDurationMin: 60,
      location: 'gym',
    },
    goals: [
      { slug: 'body_composition', primary: true, w: 1 },
      { slug: 'hypertrophy', w: 0.7 },
    ],
    days: [1, 2, 4, 5],
    equipment: GYM,
  },
];

const created: {
  id: string;
  by: RequestContext;
  age: number;
  sex: string;
  user?: RequestContext;
}[] = [];
for (const s of specs) {
  const { id } = await createClient(s.by, {
    basics: s.basics,
    profile: s.profile,
    goals: s.goals.map((g) => ({
      goalId: goal(g.slug),
      isPrimary: !!g.primary,
      priorityWeight: g.w,
      sportId: g.sport ? sport(g.sport) : null,
      competitiveLevel: g.level ?? null,
    })),
    availability: s.days.map((d) => ({ weekday: d })),
    equipment: s.equipment ?? [],
  });
  await grantConsent(s.by, id, { purpose: 'service_terms', method: 'paper' });
  await grantConsent(s.by, id, { purpose: 'health_data', method: 'paper' });
  await recordScreening(s.by, id, {
    questionnaire: 'PAR-Q+',
    questionnaireVersion: '2023',
    result: s.health?.requiresProfessionalAssessment ? 'refer' : 'clear',
    completedOn: '2026-09-15',
  });
  if (s.health) await addHealthDeclaration(s.by, id, s.health);
  if (s.history) await addHistoryEntry(s.by, id, { kind: 'sport', description: s.history });
  created.push({
    id,
    by: s.by,
    age: 2026 - Number(String(s.basics.birthDate).slice(0, 4)),
    sex: String(s.basics.sex),
  });
  if (s.account && s.basics.email) {
    const inv = await createInvitation(s.by, {
      role: 'CLIENT',
      email: String(s.basics.email),
      clientId: id,
    });
    created.at(-1)!.user = await acceptAs(inv.link, String(s.basics.firstName));
  }
}

// Assessments (§15 demo data): 2–3 per client from the proposed battery, with fictitious values.
// Deterministic pseudo-random noise (fixed seed) so the demo is reproducible.
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5;
/** Fictitious baselines for a young adult man; scaled by age and sex below. [value, improves by] */
const BASE: Record<string, [number, number]> = {
  one_rm_back_squat: [95, 0.08],
  one_rm_bench_press: [72, 0.06],
  body_mass: [76, -0.01],
  height: [176, 0],
  waist_circumference: [86, -0.02],
  handgrip_strength: [44, 0.04],
  five_times_sit_to_stand: [8.5, -0.06],
  chair_stand_30s: [18, 0.08],
  sppb: [11, 0.04],
  gait_speed: [1.25, 0.03],
  unipedal_stance_eyes_open: [28, 0.1],
  six_minute_walk_test: [560, 0.04],
  timed_up_and_go: [6.8, -0.05],
  weight_bearing_lunge_distance: [10.5, 0.06],
  cmj_height: [34, 0.05],
  sj_height: [31, 0.05],
  sprint_5m: [1.08, -0.015],
  sprint_10m: [1.82, -0.015],
  sprint_20m: [3.1, -0.015],
  sprint_30m: [4.3, -0.015],
  max_sprint_speed: [8.4, 0.02],
  test_505: [2.45, -0.02],
  ift_30_15: [18.5, 0.04],
  yo_yo_ir1: [1400, 0.1],
  drop_jump_rsi: [1.6, 0.06],
  imtp_peak_force: [2600, 0.06],
  srpe: [380, 0],
  wellness_hooper: [12, 0],
};
const DATES = ['2026-04-14', '2026-06-16', '2026-09-22'];
let assessmentsCreated = 0;
for (const [i, c] of created.entries()) {
  const proposal = await proposeAssessmentBattery(c.by, c.id);
  const tests = proposal.tests.filter((t) => t.included && t.testId && BASE[t.slug]);
  if (!proposal.batteryId || !tests.length) continue;
  const scale = (c.sex === 'female' ? 0.78 : 1) * (c.age >= 65 ? 0.7 : c.age < 18 ? 0.85 : 1);
  const count = 2 + (i % 2);
  for (let k = 0; k < count; k++) {
    const date = DATES[DATES.length - count + k]!;
    const { id: aid } = await createAssessment(c.by, c.id, {
      assessedOn: date,
      batteryId: proposal.batteryId,
      testIds: tests.map((t) => t.testId!),
      context: k === 0 ? 'Evaluación inicial' : 'Reevaluación',
    });
    const detail = await getAssessment(c.by, aid);
    for (const t of detail.tests) {
      const [base, gain] = BASE[t.slug]!;
      const lowerBetter = gain < 0;
      const scaled = ['height', 'body_mass', 'sppb', 'srpe', 'wellness_hooper'].includes(t.slug)
        ? base
        : lowerBetter
          ? base / scale
          : base * scale;
      const v = scaled * (1 + gain * k + rnd() * 0.02);
      const dec = v < 3 ? 2 : v < 100 ? 1 : 0;
      const attempts = Array.from({ length: t.defaultAttempts }, () =>
        Number((v * (1 + rnd() * 0.03)).toFixed(dec)),
      );
      const sides = t.sided ? (['left', 'right'] as const) : (['both'] as const);
      for (const side of sides) {
        await recordAssessmentResult(c.by, aid, {
          testId: t.id,
          side,
          attempts:
            side === 'right' ? attempts.map((x) => Number((x * 0.96).toFixed(dec))) : attempts,
          measurementMethod: null,
        });
      }
    }
    await setAssessmentStatus(c.by, aid, { status: 'completed' });
    assessmentsCreated++;
  }
}
console.log(`Assessments: ${assessmentsCreated} demo assessments with fictitious results.`);

// Iker (footballer) also has a recent strength test, so his plan's %1RM loads are in kg.
const iker = created[specs.findIndex((s) => s.basics.firstName === 'Iker')]!;
{
  // A recent strength test for the footballer (1RM 98 kg at 75 kg → 1.31 × BW, below 1.5).
  const all = await listAssessmentTests(iker.by);
  const tid = (slug: string) => all.find((t) => t.slug === slug)!.id;
  const { id: aid } = await createAssessment(iker.by, iker.id, {
    assessedOn: addDays(localDate(new Date()), -10),
    testIds: [tid('one_rm_back_squat'), tid('body_mass')],
    context: 'Fuerza de pretemporada',
  });
  await recordAssessmentResult(iker.by, aid, { testId: tid('one_rm_back_squat'), attempts: [98] });
  await recordAssessmentResult(iker.by, aid, { testId: tid('body_mass'), attempts: [75] });
  await setAssessmentStatus(iker.by, aid, { status: 'completed' });
}

// Plans (§15 demo data): a 12-week plan from the template matching each client's main goal.
const templates = await listPlanTemplates(lucia);
const GOAL_TEMPLATE: Record<string, string> = {
  hypertrophy: 'hipertrofia-3d',
  max_strength: 'fuerza-3d',
  general_health: 'salud-2d',
  functional_strength: 'salud-2d',
  reconditioning: 'salud-2d',
  team_sport_performance: 'equipo-3d',
  endurance_sport_performance: 'resistencia-2d',
  strength_initiation: 'iniciacion-2d',
  general_physical_preparation: 'iniciacion-3d',
};
const WEEKDAYS: Record<number, number[]> = { 2: [2, 4], 3: [1, 3, 5] };
let plansCreated = 0;
/**
 * Follow-up demo (Fase 8): adherence from 45 % to 100 % and alerts of every colour. Clients
 * without the app are logged by their trainer (room mode) following these profiles.
 */
const PROFILES: HistoryProfile[] = [
  { adherence: 0.45, pain: { region: 'Hombro derecho', intensity: 7 } },
  { adherence: 0.75, srpeHigh: true },
  { adherence: 0.9 },
  { adherence: 1 },
];
let profileIndex = 0;
for (const [i, c] of created.entries()) {
  const goals = specs[i]!.goals;
  const main = goals.find((g) => g.primary)?.slug ?? goals[0]?.slug;
  const t = templates.find((x) => x.slug === GOAL_TEMPLATE[main ?? '']);
  if (!t) continue;
  // Clients with the app train "now": their plan started last Monday-week, relative to today.
  const today = localDate(new Date());
  const lastWeekMonday = addDays(today, 1 - isoWeekday(today) - 7);
  const plan = await createPlanFromTemplate(c.by, c.id, {
    templateId: t.id,
    startDate: c.user ? lastWeekMonday : i % 2 === 0 ? addDays(lastWeekMonday, -21) : '2026-09-28',
    weekdays: WEEKDAYS[t.sessionsPerWeek] ?? [1, 2, 4, 5],
  });
  if (i % 2 === 0 || c.user) await setPlanStatus(c.by, plan.id, { status: 'active' });
  plansCreated++;
  const name = String(specs[i]!.basics.firstName);
  if (c.user) await runSessions(c, plan.id, today, name);
  else if (i % 2 === 0)
    await roomHistory(c, plan.id, today, PROFILES[profileIndex++ % PROFILES.length]!);
}
// Calendar demo (Fase 9): upcoming and overdue assessments; Iker sees only two tests in Progreso.
{
  const today = localDate(new Date());
  const tests = await listAssessmentTests(lucia);
  const slug = (x: string) => tests.find((t) => t.slug === x)!.id;
  const byName = (n: string) => created[specs.findIndex((x) => String(x.basics.firstName) === n)]!;
  for (const [name, days] of [
    ['Marcos', 4],
    ['Elena', 9],
    ['Javier', -2],
  ] as const) {
    const c = byName(name);
    await createAssessment(c.by, c.id, {
      assessedOn: addDays(today, days),
      testIds: [slug('cmj_height'), slug('handgrip_strength')],
      context: days < 0 ? 'Reevaluación pendiente' : 'Reevaluación programada',
    });
  }
  const iker = byName('Iker');
  await setProgressMetrics(iker.by, iker.id, { testIds: [slug('cmj_height'), slug('sprint_30m')] });
}
const monitored = await monitorAllClients({ db, now: () => new Date() });
console.log(`Monitoring: ${monitored.clients} clients evaluated, ${monitored.created} alerts.`);

interface HistoryProfile {
  adherence: number;
  pain?: { region: string; intensity: number };
  srpeHigh?: boolean;
}

/** Past sessions logged by the trainer: the profile sets how many are done and what was felt. */
async function roomHistory(
  c: (typeof created)[number],
  planId: string,
  today: string,
  profile: HistoryProfile,
) {
  await publishSessions(c.by, { scope: 'plan', id: planId, published: true });
  const p = await getPlan(c.by, planId);
  const past = p.phases
    .flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks.flatMap((w) => w.sessions)))
    .filter((s) => s.scheduledDate && s.scheduledDate < today);
  // Done sessions spread evenly (deterministic): with 45 %, the last ones are left unrecorded.
  const done = past.filter(
    (_, k) =>
      Math.floor((k + 1) * profile.adherence + 1e-9) > Math.floor(k * profile.adherence + 1e-9),
  );
  for (const [k, s] of done.entries()) {
    const last = k === done.length - 1;
    const high = profile.srpeHigh && k >= done.length - 3;
    await completeSession(c.by, s.id, {
      status: 'completed',
      performedDate: s.scheduledDate!,
      durationMin: 60,
      sessionRpe: high ? 9 : 6,
      fatigue: high ? 8 : 4,
      motivation: 7,
      ...(last && profile.pain
        ? { pain: { intensity: profile.pain.intensity, bodyRegion: profile.pain.region } }
        : {}),
    });
  }
}
console.log(`Plans: ${plansCreated} demo plans from templates.`);

/**
 * Session execution demo (Fase 7): the plan is published, regressions/variants of the progression
 * graph are pre-approved alternatives, and past sessions are logged through the offline sync
 * endpoint (as the app does). One session is partial, one has a pending substitution.
 */
async function runSessions(
  c: (typeof created)[number],
  planId: string,
  today: string,
  name: string,
) {
  await publishSessions(c.by, { scope: 'plan', id: planId, published: true });
  await db.execute(sql`
    UPDATE session_exercises se SET alternative_exercise_ids = coalesce((
      SELECT array_agg(alt) FROM (
        SELECT DISTINCT CASE WHEN p.to_exercise_id = se.exercise_id THEN p.from_exercise_id ELSE p.to_exercise_id END AS alt
        FROM exercise_progressions p
        WHERE (p.to_exercise_id = se.exercise_id OR (p.relation = 'variant' AND p.from_exercise_id = se.exercise_id))
        LIMIT 2) x), '{}'::uuid[])
    WHERE se.client_id = ${c.id}`);
  const p = await getPlan(c.by, planId);
  const past = p.phases
    .flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks.flatMap((w) => w.sessions)))
    .filter((s) => s.scheduledDate && s.scheduledDate < today);
  for (const [k, s] of past.entries()) {
    const player = await getPlayerSession(c.user!, s.id);
    const exs = player.blocks.flatMap((b) => b.exercises);
    const partial = k === 1;
    const mutations: Record<string, unknown>[] = [];
    for (const [j, e] of exs.entries()) {
      if (partial && j >= exs.length - 1) continue;
      for (let set = 1; set <= e.sets; set++)
        mutations.push({
          type: 'set',
          clientMutationId: `demo-${s.id}-${e.id}-${set}`,
          sessionId: s.id,
          sessionExerciseId: e.id,
          exerciseId: e.exerciseId,
          setIndex: set,
          side: e.side === 'each' ? 'left' : null,
          loadKg: e.preload.loadKg ?? (e.prescription.loadPct1rm ? 40 : null),
          reps: e.preload.reps,
          // Iker logs sets clearly easier than planned → green "raise the load" proposal.
          rir:
            e.preload.durationS != null
              ? null
              : name === 'Iker' && j === exs.findIndex((x) => x.prescription.rirMax != null)
                ? Math.min(10, (e.prescription.rirMax ?? 2) + 2)
                : (e.preload.rir ?? 2),
          durationS: e.preload.durationS,
          loggedAt: `${s.scheduledDate}T18:${String(10 + set).padStart(2, '0')}:00+02:00`,
        });
    }
    const last = exs.at(-1);
    if (partial && last)
      mutations.push({
        type: 'substitution',
        clientMutationId: `demo-sub-${s.id}`,
        sessionExerciseId: last.id,
        reason: 'missing_equipment',
        chosenExerciseId: null,
        comment: 'La máquina estaba ocupada.',
      });
    mutations.push({
      type: 'complete',
      clientMutationId: `demo-done-${s.id}`,
      sessionId: s.id,
      performedDate: s.scheduledDate,
      durationMin: 55,
      // Marcos closes his last session without RPE → green reminder.
      sessionRpe: name === 'Marcos' && k === past.length - 1 ? null : partial ? 8 : 6,
      fatigue: partial ? 7 : 4,
      motivation: 7,
      ...(partial ? { status: 'partial', reasonCode: 'fatigue' } : { status: 'completed' }),
      comment: partial ? 'Día largo de trabajo; corté antes.' : null,
    });
    await syncMutations(c.user!, { mutations });
  }
  // Elena reports low wellness three days in a row → yellow.
  if (name === 'Elena')
    for (const d of [2, 1, 0])
      await saveReadiness(c.user!, c.id, {
        recordedOn: addDays(today, -d),
        energy: 2,
        sleepQuality: 3,
        soreness: 7,
        comment: 'Semana de exámenes, duermo poco.',
      });
}

// Decision engine (§13): the centre's thresholds for its footballers (practical, level F — the
// platform ships none) and a first run for every client. Iker's proposals get a few decisions so
// the per-rule override metrics are not empty.
await updateDecisionRules(lucia, {
  rules: [
    { key: 'profile.relative_strength_low', enabled: true, parameters: { threshold: 1.5 } },
    { key: 'profile.cmj_low', enabled: true, parameters: { threshold: 35 } },
    { key: 'profile.sprint_slow', enabled: true, parameters: { threshold: 1.85 } },
  ],
  notes: 'Umbrales del centro para futbolistas (demo)',
});
for (const c of created) await runDecision(c.by, c.id);
{
  const recs = (await getDecision(iker.by, iker.id)).recommendations;
  const [p1, p2] = recs.filter((r) => r.type === 'priority');
  if (p1) await decideRecommendation(iker.by, p1.id, { action: 'accept' });
  if (p2)
    await decideRecommendation(iker.by, p2.id, {
      action: 'accept_with_changes',
      changes: { sessionsPerWeek: 1 },
      reason: 'Dos partidos por semana en este bloque',
    });
}
console.log(`Decision engine: proposals for ${created.length} clients (rules version 1).`);

// Programming engine (§12.2): adjustment proposals from what was logged (they never change a plan
// on their own) and a plan proposal for Iker from his decision run, starting next Monday.
const adj = await evaluateAllAdjustments(ctx);
{
  const today = localDate(new Date());
  const nextMonday = addDays(today, 8 - isoWeekday(today));
  await generatePlanProposal(iker.by, iker.id, { startDate: nextMonday, weekdays: [1, 3, 5] });
}
console.log(`Programming engine: ${adj.created} adjustment proposals; 1 plan proposal (Iker).`);

// Reports (§34): one client report for Iker over the last 12 weeks, with the trainer's notes.
{
  const to = localDate(new Date());
  await generateClientReport(iker.by, iker.id, {
    from: addDays(to, -83),
    to,
    trainerNotes:
      'Prioridad: fuerza máxima de tren inferior dos días por semana; mantener el trabajo de velocidad. Reevaluar CMJ y sprint en la semana de evaluación.',
  });
}
// Elena (online): her trainer's report and a tolerance noted after the ankle sprain.
{
  const elena = created[specs.findIndex((s) => s.basics.firstName === 'Elena')]!;
  const to = localDate(new Date());
  await generateClientReport(elena.by, elena.id, { from: addDays(to, -55), to });
  const [pattern] = (await db.execute(
    sql`SELECT id FROM movement_patterns WHERE organization_id IS NULL AND slug = 'jump_plyometric' LIMIT 1`,
  )) as unknown as { id: string }[];
  if (pattern)
    await setExerciseTolerance(elena.by, elena.id, {
      movementPatternId: pattern.id,
      kind: 'restricted',
      reason: 'Progresar saltos con prudencia tras el esguince (sin molestias actuales).',
    });
}
console.log('Reports: 2 client reports (Iker, Elena).');

// Imports (§52): a client list validated but not confirmed yet (shown in Informes → importaciones).
await createImportJob(lucia, {
  entity: 'clients',
  fileName: 'altas-octubre.csv',
  contentBase64: Buffer.from(
    'Nombre;Apellidos;Fecha nacimiento;Sexo;Email\nSara;Gil Ortega;02/02/1992;mujer;sara.gil@example.com\nTomas;Ruiz;31/02/1990;hombre;\n',
  ).toString('base64'),
});
console.log('Imports: 1 validated client list pending confirmation.');

// Privacy (RGPD): Elena asks to correct a datum from the app (one-month deadline).
{
  const elena = created[specs.findIndex((s) => s.basics.firstName === 'Elena')]!;
  await createPrivacyRequest(elena.user!, elena.id, {
    type: 'rectification',
    details: 'Mi segundo apellido está mal escrito.',
  });
}
console.log('Privacy: 1 pending rights request (Elena).');

// Exercise library: the user's methodology bank as reviewable drafts (skip with DEMO_SKIP_BANK=1).
if (!process.env.DEMO_SKIP_BANK) {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const file = path.resolve(import.meta.dirname, '../../../seed-data/exercise-bank/bank.json');
  const { entries } = JSON.parse(readFileSync(file, 'utf8')) as { entries: ImportedBankEntry[] };
  const report = await importExerciseBank(lucia, entries);
  console.log(
    `Exercise bank: ${report.created} drafts, ${report.videos} videos pending verification.`,
  );
}

// Security tests (Phase 14): a second, separate organization whose ADMIN attacks the first one
// (cross-tenant access must always be refused). It holds no client data.
{
  const north = await bootstrapOrganization(db, {
    name: 'Centro Norte (pruebas de aislamiento)',
    slug: 'centro-norte',
    admin: {
      email: 'ane.urrutia@example.com',
      password: PASSWORD,
      firstName: 'Ane',
      lastName: 'Urrutia',
    },
  });
  // DEMO ONLY (see above).
  await db.execute(
    sql`UPDATE organizations SET require_admin_2fa = false WHERE id = ${north.organizationId}`,
  );
}

await close();
console.log(`Demo data created.
  ADMIN + trainer : lucia.moreno@example.com
  Trainers        : pablo.ibarra@example.com, nerea.soto@example.com
  Clients w/ app  : marcos.villalba@example.com, elena.prieto@example.com, iker.arrieta@example.com
  Other org ADMIN : ane.urrutia@example.com (isolation tests only)
  Password (all)  : ${PASSWORD}`);
