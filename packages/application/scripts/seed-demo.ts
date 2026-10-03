/**
 * Demo data (§58): 3 fictitious trainers, 10 fictitious clients with different ages, goals,
 * levels and modalities. All names are invented and all emails use example.com.
 * Usage: pnpm db:seed:demo   (expects a migrated + catalogue-seeded database)
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb } from '@tp/db';
import {
  acceptInvitation,
  addHealthDeclaration,
  addHistoryEntry,
  bootstrapOrganization,
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
  if (s.account && s.basics.email) {
    const inv = await createInvitation(s.by, {
      role: 'CLIENT',
      email: String(s.basics.email),
      clientId: id,
    });
    await acceptAs(inv.link, String(s.basics.firstName));
  }
}

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

await close();
console.log(`Demo data created.
  ADMIN + trainer : lucia.moreno@example.com
  Trainers        : pablo.ibarra@example.com, nerea.soto@example.com
  Clients w/ app  : marcos.villalba@example.com, elena.prieto@example.com, iker.arrieta@example.com
  Password (all)  : ${PASSWORD}`);
