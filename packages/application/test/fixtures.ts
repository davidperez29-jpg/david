import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb, type DbHandle } from '@tp/db';
import { randomUUID } from 'node:crypto';
import {
  acceptInvitation,
  bootstrapOrganization,
  createClient,
  createInvitation,
  loadActor,
  MemoryMailer,
  MemoryStorage,
  resolveSession,
  type AppContext,
  type RequestContext,
} from '../src';

let handle: DbHandle | null = null;
export function testDb(): DbHandle {
  handle ??= createDb(process.env.TEST_DATABASE_URL!, { max: 5 });
  return handle;
}

export const PASSWORD = 'correct-horse-battery-staple';

export function appContext(
  overrides: Partial<AppContext> = {},
): AppContext & { mailer: MemoryMailer } {
  return {
    db: testDb().db,
    keys: keyRingFromBase64(Buffer.alloc(32, 7).toString('base64')),
    mailer: new MemoryMailer(),
    storage: new MemoryStorage(),
    baseUrl: 'http://localhost:3000',
    now: () => new Date(),
    requestId: randomUUID(),
    ipHash: `ip-${randomUUID()}`,
    ...overrides,
  } as AppContext & { mailer: MemoryMailer };
}

export async function as(ctx: AppContext, userId: string): Promise<RequestContext> {
  const actor = await loadActor(ctx.db, userId);
  if (!actor) throw new Error('actor not found');
  return { ...ctx, actor };
}

function tokenFrom(link: string): string {
  return new URL(link).searchParams.get('token')!;
}

/**
 * Builds an isolated organization: admin (also trainer), a second trainer, and two clients —
 * client A assigned to the admin-trainer, client B assigned to trainer 2. Client A has an account.
 */
export async function buildOrg() {
  const ctx = appContext();
  const tag = randomUUID().slice(0, 8);
  const org = await bootstrapOrganization(ctx.db, {
    name: `Org ${tag}`,
    slug: `org-${tag}`,
    admin: {
      email: `admin-${tag}@example.com`,
      password: PASSWORD,
      firstName: 'Ada',
      lastName: 'Admin',
    },
  });
  const admin = await as(ctx, org.adminUserId);

  const inv = await createInvitation(admin, {
    role: 'TRAINER',
    email: `trainer2-${tag}@example.com`,
    firstName: 'Teo',
    lastName: 'Trainer',
  });
  const t2Login = await acceptInvitation(ctx, {
    token: tokenFrom(inv.link),
    displayName: 'Teo Trainer',
    password: PASSWORD,
  });
  const t2State = await resolveSession(ctx, t2Login.token);
  if (t2State.status !== 'authenticated') throw new Error('trainer2 not authenticated');
  const trainer2 = await as(ctx, t2State.actor.userId);

  const clientA = await createClient(admin, {
    basics: {
      firstName: 'Ana',
      lastName: `Alpha ${tag}`,
      birthDate: '1995-04-10',
      sex: 'female',
      email: `ana-${tag}@example.com`,
    },
  });
  const clientB = await createClient(trainer2, {
    basics: { firstName: 'Bruno', lastName: `Beta ${tag}`, birthDate: '1980-01-01', sex: 'male' },
  });
  const cInv = await createInvitation(admin, {
    role: 'CLIENT',
    email: `ana-${tag}@example.com`,
    clientId: clientA.id,
  });
  const cLogin = await acceptInvitation(ctx, {
    token: tokenFrom(cInv.link),
    displayName: 'Ana',
    password: PASSWORD,
  });
  const cState = await resolveSession(ctx, cLogin.token);
  if (cState.status !== 'authenticated') throw new Error('client not authenticated');
  const clientUser = await as(ctx, cState.actor.userId);

  return { ctx, tag, org, admin, trainer2, clientUser, clientA: clientA.id, clientB: clientB.id };
}
