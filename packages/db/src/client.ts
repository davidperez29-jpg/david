import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction — repositories accept either. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbHandle {
  db: Database;
  /** Plain SQL text (scripts and test tooling only; never with user input). */
  rawQuery: (text: string) => Promise<Record<string, unknown>[]>;
  close: () => Promise<void>;
}

/**
 * The connection string as a managed host gives it, made usable by this driver (restructure
 * phase 22, free hosting on Neon):
 * - `channel_binding` is a libpq option: postgres.js would send it to the server as a setting,
 *   and the server refuses the connection (`unrecognized configuration parameter`). SCRAM, which
 *   it protects, still applies.
 * - Neon's pooled host (`ep-…-pooler.…neon.tech`) is turned into the direct one (the same name
 *   without `-pooler`): migrations and start-up steps hold one session, which a transaction
 *   pooler does not keep.
 */
export function normalizeDatabaseUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.searchParams.delete('channel_binding');
  if (u.hostname.endsWith('.neon.tech')) u.hostname = u.hostname.replace(/-pooler(?=\.)/, '');
  return u.toString();
}

/**
 * Idle connections close after a minute, so a database that scales to zero (Neon's free plan
 * suspends after 5 min without connections) can do so while the web server is still up.
 */
const IDLE_TIMEOUT_S = 60;

export function createDb(url: string, opts: { max?: number } = {}): DbHandle {
  const sql = postgres(normalizeDatabaseUrl(url), {
    max: opts.max ?? 10,
    idle_timeout: IDLE_TIMEOUT_S,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return {
    db,
    rawQuery: async (text) => [...(await sql.unsafe(text))] as Record<string, unknown>[],
    close: () => sql.end({ timeout: 5 }),
  };
}
