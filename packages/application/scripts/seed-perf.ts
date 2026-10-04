/**
 * Load data for the performance checks (MASTER_SPECIFICATION §2.3: "listados < 300 ms p95 con
 * 1 000 clientes"; "1 instancia sirve 10 entrenadores/1 000 clientes"). A separate organization
 * (Centro Escala) so the demo stays small: 10 trainers, 1 000 clients round-robin, 300 of them with
 * an active 12-week plan. Idempotent: does nothing if the organization exists.
 * All names are generated and all emails use example.com.
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb } from '@tp/db';
import { addDays, isoWeekday, localDate } from '@tp/domain';
import { sql } from 'drizzle-orm';
import {
  acceptInvitation,
  bootstrapOrganization,
  createClient,
  createInvitation,
  createPlanFromTemplate,
  loadActor,
  MemoryMailer,
  MemoryStorage,
  resolveSession,
  setPlanStatus,
  type AppContext,
  type RequestContext,
} from '../src';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-entrenamiento-2026';
const CLIENTS = Number(process.env.PERF_CLIENTS ?? 1000);
const PLANS = Number(process.env.PERF_PLANS ?? 300);
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

const [exists] = (await db.execute(
  sql`SELECT id FROM organizations WHERE slug = 'centro-escala'`,
)) as unknown as { id: string }[];
if (exists) {
  console.log('Perf data already present (centro-escala).');
  await close();
  process.exit(0);
}

const t0 = Date.now();
const org = await bootstrapOrganization(db, {
  name: 'Centro Escala (pruebas de rendimiento)',
  slug: 'centro-escala',
  admin: {
    email: 'escala.admin@example.com',
    password: PASSWORD,
    firstName: 'Admin',
    lastName: 'Escala',
  },
});
// PERF/DEMO ONLY: shared test account without 2FA.
await db.execute(
  sql`UPDATE organizations SET require_admin_2fa = false WHERE id = ${org.organizationId}`,
);
const admin = await as(org.adminUserId);

const trainerIds: string[] = [];
for (let i = 1; i <= 10; i++) {
  const n = String(i).padStart(2, '0');
  const inv = await createInvitation(admin, {
    role: 'TRAINER',
    email: `escala.entrenador${n}@example.com`,
    firstName: 'Entrenador',
    lastName: n,
  });
  const r = await acceptInvitation(ctx, {
    token: new URL(inv.link).searchParams.get('token')!,
    displayName: `Entrenador ${n}`,
    password: PASSWORD,
  });
  const s = await resolveSession(ctx, r.token);
  if (s.status !== 'authenticated') throw new Error('perf trainer login failed');
  trainerIds.push(s.actor.trainerId!);
}

const FIRST = [
  'Ana',
  'Luis',
  'Marta',
  'Jon',
  'Irene',
  'Pau',
  'Nora',
  'Hugo',
  'Sara',
  'Leo',
  'Eva',
  'Raúl',
];
const LAST = [
  'García',
  'López',
  'Sanz',
  'Ruiz',
  'Gil',
  'Mora',
  'Vidal',
  'Pons',
  'Soler',
  'Ortiz',
  'Rey',
];
const clientIds: string[] = [];
for (let i = 0; i < CLIENTS; i++) {
  const { id } = await createClient(admin, {
    basics: {
      firstName: FIRST[i % FIRST.length]!,
      lastName: `${LAST[(i * 7) % LAST.length]} ${String(i + 1).padStart(4, '0')}`,
      birthDate: `${1950 + (i % 55)}-0${1 + (i % 9)}-1${i % 9}`,
      sex: i % 2 ? 'male' : 'female',
      email: `escala.cliente${i + 1}@example.com`,
      modality: (['in_person', 'online', 'hybrid'] as const)[i % 3],
    },
    trainerId: trainerIds[i % trainerIds.length],
  });
  clientIds.push(id);
}
console.log(`Perf: ${CLIENTS} clients in ${Math.round((Date.now() - t0) / 1000)} s.`);

const templates = (await db.execute(
  sql`SELECT id, sessions_per_week FROM plan_templates WHERE organization_id IS NULL ORDER BY slug`,
)) as unknown as { id: string; sessions_per_week: number }[];
const today = localDate(new Date());
const monday = addDays(today, 1 - isoWeekday(today) - 7);
/** n training days spread over the week (Mon, Wed, Fri first). */
const weekdays = (n: number) => [1, 3, 5, 2, 4, 6, 7].slice(0, n).sort((a, b) => a - b);
for (let i = 0; i < Math.min(PLANS, clientIds.length); i++) {
  const t = templates[i % templates.length]!;
  const plan = await createPlanFromTemplate(admin, clientIds[i]!, {
    templateId: t.id,
    startDate: monday,
    weekdays: weekdays(t.sessions_per_week),
  });
  await setPlanStatus(admin, plan.id, { status: 'active' });
}
console.log(
  `Perf data created in ${Math.round((Date.now() - t0) / 1000)} s: 10 trainers, ${CLIENTS} clients, ${PLANS} active plans.
  ADMIN   : escala.admin@example.com
  Trainer : escala.entrenador01@example.com (${CLIENTS / 10} clients)`,
);
await close();
