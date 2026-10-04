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

export function createDb(url: string, opts: { max?: number } = {}): DbHandle {
  const sql = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return {
    db,
    rawQuery: async (text) => [...(await sql.unsafe(text))] as Record<string, unknown>[],
    close: () => sql.end({ timeout: 5 }),
  };
}
