import { schema, type Executor } from '@tp/db';
import { and, eq, gt, count } from 'drizzle-orm';

const { loginAttempts } = schema;

export const RATE_LIMITS = {
  windowMs: 15 * 60_000,
  /** Failed attempts per account (email) inside the window before lockout. */
  maxFailuresPerEmail: 5,
  /** Attempts (any result) per IP inside the window. */
  maxAttemptsPerIp: 30,
  lockoutMs: 15 * 60_000,
} as const;

export async function recordAttempt(
  db: Executor,
  emailHash: string,
  ipHash: string | null,
  success: boolean,
  now = new Date(),
): Promise<void> {
  await db.insert(loginAttempts).values({ emailHash, ipHash, success, occurredAt: now });
}

export async function isRateLimited(
  db: Executor,
  emailHash: string,
  ipHash: string | null,
  now = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - RATE_LIMITS.windowMs);
  const [byEmail] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.success, false),
        gt(loginAttempts.occurredAt, since),
      ),
    );
  if ((byEmail?.n ?? 0) >= RATE_LIMITS.maxFailuresPerEmail) return true;
  if (ipHash) {
    const [byIp] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ipHash, ipHash), gt(loginAttempts.occurredAt, since)));
    if ((byIp?.n ?? 0) >= RATE_LIMITS.maxAttemptsPerIp) return true;
  }
  return false;
}
