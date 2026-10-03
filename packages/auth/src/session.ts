import type { Role } from '@tp/domain';
import { schema, type Executor } from '@tp/db';
import { and, eq, isNull } from 'drizzle-orm';
import { randomToken, sha256 } from './crypto';

const { authSessions, users } = schema;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Session lifetimes (§14.1): staff 12 h idle / 7 d absolute; clients 30 d idle / 90 d absolute. */
export function sessionLifetimes(roles: Role[]): { idleMs: number; absoluteMs: number } {
  const staff = roles.some((r) => r === 'ADMIN' || r === 'TRAINER');
  return staff
    ? { idleMs: 12 * HOUR, absoluteMs: 7 * DAY }
    : { idleMs: 30 * DAY, absoluteMs: 90 * DAY };
}

/** Sliding window is only extended when older than this, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export interface SessionMeta {
  ipHash?: string | null;
  userAgentHash?: string | null;
}

export async function createSession(
  db: Executor,
  userId: string,
  roles: Role[],
  opts: SessionMeta & { secondFactorVerified: boolean; now?: Date },
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const now = opts.now ?? new Date();
  const { idleMs, absoluteMs } = sessionLifetimes(roles);
  const token = randomToken();
  const [row] = await db
    .insert(authSessions)
    .values({
      userId,
      tokenHash: sha256(token),
      secondFactorVerified: opts.secondFactorVerified,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + idleMs),
      absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
      ipHash: opts.ipHash ?? null,
      userAgentHash: opts.userAgentHash ?? null,
    })
    .returning({ id: authSessions.id, idleExpiresAt: authSessions.idleExpiresAt });
  return { token, sessionId: row!.id, expiresAt: row!.idleExpiresAt };
}

export interface ValidSession {
  sessionId: string;
  userId: string;
  secondFactorVerified: boolean;
}

/** Returns the session if valid; extends the idle window (sliding) when due. */
export async function validateSession(
  db: Executor,
  token: string,
  roles: (userId: string) => Promise<Role[]>,
  now: Date = new Date(),
): Promise<ValidSession | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({
      id: authSessions.id,
      userId: authSessions.userId,
      second: authSessions.secondFactorVerified,
      lastSeenAt: authSessions.lastSeenAt,
      idle: authSessions.idleExpiresAt,
      absolute: authSessions.absoluteExpiresAt,
      userStatus: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, sha256(token)), isNull(authSessions.revokedAt)));
  if (!row) return null;
  if (row.userStatus !== 'active') return null;
  if (row.idle <= now || row.absolute <= now) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    const { idleMs } = sessionLifetimes(await roles(row.userId));
    const idle = new Date(Math.min(now.getTime() + idleMs, row.absolute.getTime()));
    await db
      .update(authSessions)
      .set({ lastSeenAt: now, idleExpiresAt: idle })
      .where(eq(authSessions.id, row.id));
  }
  return { sessionId: row.id, userId: row.userId, secondFactorVerified: row.second };
}

export async function markSecondFactorVerified(db: Executor, sessionId: string): Promise<void> {
  await db
    .update(authSessions)
    .set({ secondFactorVerified: true })
    .where(eq(authSessions.id, sessionId));
}

export async function revokeSession(
  db: Executor,
  sessionId: string,
  now = new Date(),
): Promise<void> {
  await db.update(authSessions).set({ revokedAt: now }).where(eq(authSessions.id, sessionId));
}

export async function revokeAllSessions(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: now })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}
