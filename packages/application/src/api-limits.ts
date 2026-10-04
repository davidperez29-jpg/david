/**
 * Per-user API budgets (Phase 15; PENTEST.md P-3, ASVS V11). Login and the second factor have their
 * own stricter limits (auth/rate-limit.ts). Counted in the database (one atomic upsert per request),
 * so the limit holds with several app replicas.
 */
import { schema } from '@tp/db';
import { sql } from 'drizzle-orm';
import type { AppContext } from './context';

export type ApiBudget = 'read' | 'write' | 'heavy';

/** Requests per user per minute. Overridable per deployment (API_LIMIT_READ/WRITE/HEAVY). */
export function apiLimits(): Record<ApiBudget, number> {
  const n = (k: string, d: number) => Number(process.env[k] ?? d) || d;
  return {
    read: n('API_LIMIT_READ', 1000),
    write: n('API_LIMIT_WRITE', 120),
    heavy: n('API_LIMIT_HEAVY', 30),
  };
}

/** Expensive operations: file generation, exports, imports, report snapshots. */
const HEAVY = [
  /^\/api\/v1\/exports/,
  /^\/api\/v1\/reports\/[^/]+\/(client-view\/)?download/,
  /^\/api\/v1\/clients\/[^/]+\/subject-data/,
  /^\/api\/v1\/imports(\/|$)/,
  /^\/api\/v1\/clients\/[^/]+\/reports$/,
];

export function budgetFor(method: string, path: string): ApiBudget {
  if (HEAVY.some((r) => r.test(path)) && (method !== 'GET' || !path.endsWith('/imports')))
    return 'heavy';
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

/**
 * Counts one request against the user's budget for the current minute. Runs as the system
 * (the table is system-only). Returns whether it is allowed and the seconds to the next window.
 */
export async function consumeApiBudget(
  app: Pick<AppContext, 'db' | 'now'>,
  userId: string,
  budget: ApiBudget,
): Promise<{ allowed: boolean; limit: number; remaining: number; retryAfter: number }> {
  const now = app.now();
  const window = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const limit = apiLimits()[budget];
  const [row] = await app.db
    .insert(schema.apiRateLimits)
    .values({ bucket: `${budget}:${userId}`, windowStart: window, count: 1 })
    .onConflictDoUpdate({
      target: [schema.apiRateLimits.bucket, schema.apiRateLimits.windowStart],
      set: { count: sql`${schema.apiRateLimits.count} + 1` },
    })
    .returning({ count: schema.apiRateLimits.count });
  const used = row?.count ?? 1;
  return {
    allowed: used <= limit,
    limit,
    remaining: Math.max(0, limit - used),
    retryAfter: Math.ceil((window.getTime() + 60_000 - now.getTime()) / 1000),
  };
}
