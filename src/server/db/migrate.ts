/**
 * Migraciones versionadas: solo hacia delante, en orden, cada una en su transacción.
 * `schema_migrations` guarda número, nombre, suma de comprobación (SHA-256) y fecha. Si una
 * migración ya aplicada cambia en el código, o la base tiene una migración que el código no
 * conoce, se detiene el arranque en lugar de seguir con un esquema dudoso.
 */
import { createHash } from 'node:crypto';
import { MIGRATION_001 } from './migrations/001-v1.ts';
import { type SqlDatabase } from './sqlite.ts';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [{ version: 1, name: 'v1', sql: MIGRATION_001 }];

export class MigrationError extends Error {}

export const checksum = (sql: string) => createHash('sha256').update(sql, 'utf8').digest('hex');

interface AppliedRow {
  version: number;
  name: string;
  checksum: string;
}

export interface MigrationResult {
  applied: number[];
  current: number;
}

export function migrate(
  db: SqlDatabase,
  options: {
    migrations?: readonly Migration[];
    now?: () => string;
    /** Se llama antes de aplicar migraciones sobre una base que ya tenía alguna (copia previa). */
    beforeMigrate?: (pending: readonly Migration[]) => void;
  } = {},
): MigrationResult {
  const migrations = options.migrations ?? MIGRATIONS;
  const now = options.now ?? (() => new Date().toISOString());
  migrations.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new MigrationError(
        `Las migraciones deben ir numeradas desde 1 sin huecos (${m.name}).`,
      );
    }
  });

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`);
  const applied = db
    .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
    .all<AppliedRow>();

  for (const row of applied) {
    const known = migrations.find((m) => m.version === row.version);
    if (!known) {
      throw new MigrationError(
        `La base tiene la migración ${row.version} (${row.name}), que este código no conoce.`,
      );
    }
    if (checksum(known.sql) !== row.checksum) {
      throw new MigrationError(
        `La migración ${row.version} (${row.name}) ha cambiado después de aplicarse.`,
      );
    }
  }

  const pending = migrations.filter((m) => !applied.some((row) => row.version === m.version));
  if (pending.length > 0 && applied.length > 0) options.beforeMigrate?.(pending);

  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (@version, @name, @checksum, @appliedAt)',
  );
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      insert.run({
        version: migration.version,
        name: migration.name,
        checksum: checksum(migration.sql),
        appliedAt: now(),
      });
    });
  }
  return {
    applied: pending.map((m) => m.version),
    current: migrations.length,
  };
}
