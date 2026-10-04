import { sql } from 'drizzle-orm';
import type { AppContext } from './context';

/** Readiness probe: the database answers and reports how many migrations are applied. */
export async function readiness(app: Pick<AppContext, 'db'>) {
  const started = performance.now();
  const rows = (await app.db.execute(
    sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
  )) as unknown as { n: number }[];
  return { migrations: rows[0]?.n ?? 0, dbMs: Math.round(performance.now() - started) };
}
