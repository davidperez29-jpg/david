/**
 * Copias de seguridad y restauración de la base local (entorno de prueba, datos ficticios).
 *
 * - La copia es en línea (API de copia de SQLite): coherente aunque el servidor esté escribiendo.
 * - Antes de dar por buena una copia, y antes de restaurarla, se comprueba su integridad:
 *   `integrity_check`, claves ajenas y que sus migraciones coinciden con las del código.
 * - Restaurar sustituye el archivo de la base: la conexión debe estar CERRADA (lo garantiza
 *   `store.ts` dentro de la aplicación; la herramienta `scripts/db.ts` lo comprueba).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { checksum, MIGRATIONS } from './migrate.ts';
import { openSqlite } from './sqlite.ts';

export interface BackupInfo {
  file: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export class BackupError extends Error {}

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/[-:]/g, '')
    .replace('T', '-');

export function backupDir(databasePath: string): string {
  return join(dirname(databasePath), 'backups');
}

/** Comprueba que un archivo es una base de TrainPro íntegra y compatible con este código. */
export function verifyDatabaseFile(file: string): void {
  if (!existsSync(file)) throw new BackupError(`No existe la copia ${file}.`);
  let db;
  try {
    db = openSqlite(file, { readonly: true });
  } catch (error) {
    throw new BackupError(`No se puede abrir ${basename(file)}: ${(error as Error).message}`);
  }
  try {
    const integrity = db.integrityCheck();
    if (integrity !== 'ok') throw new BackupError(`La copia no está íntegra: ${integrity}`);
    const brokenKeys = db.prepare('PRAGMA foreign_key_check').all();
    if (brokenKeys.length > 0) {
      throw new BackupError(`La copia tiene ${brokenKeys.length} relaciones rotas.`);
    }
    const hasMigrations = db
      .prepare(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
      )
      .get();
    if (!hasMigrations) throw new BackupError('La copia no es una base de TrainPro.');
    const applied = db
      .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
      .all<{ version: number; checksum: string }>();
    for (const row of applied) {
      const known = MIGRATIONS.find((m) => m.version === row.version);
      if (!known || checksum(known.sql) !== row.checksum) {
        throw new BackupError(
          `La copia usa una migración (${row.version}) distinta de este código.`,
        );
      }
    }
  } finally {
    db.close();
  }
}

/** Copia la base abierta a `backups/` y verifica la copia. Devuelve su ruta. */
export async function createBackup(
  db: { path: string; backupTo(destination: string): Promise<void> },
  options: { label?: string; now?: Date } = {},
): Promise<BackupInfo> {
  const dir = backupDir(db.path);
  mkdirSync(dir, { recursive: true });
  const base = basename(db.path).replace(/\.sqlite$/, '');
  const label = options.label ? `-${options.label.replace(/[^a-z0-9-]/gi, '').slice(0, 30)}` : '';
  let file = join(dir, `${base}-${stamp(options.now ?? new Date())}${label}.sqlite`);
  for (let n = 2; existsSync(file); n += 1) {
    file = join(dir, `${base}-${stamp(options.now ?? new Date())}${label}-${n}.sqlite`);
  }
  await db.backupTo(file);
  verifyDatabaseFile(file);
  return describe(file);
}

function describe(file: string): BackupInfo {
  const stats = statSync(file);
  return {
    file,
    name: basename(file),
    sizeBytes: stats.size,
    createdAt: stats.mtime.toISOString(),
  };
}

/** Copias de una base, de la más reciente a la más antigua. */
export function listBackups(databasePath: string): BackupInfo[] {
  const dir = backupDir(databasePath);
  if (!existsSync(dir)) return [];
  const base = basename(databasePath).replace(/\.sqlite$/, '');
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${base}-`) && name.endsWith('.sqlite'))
    .map((name) => describe(join(dir, name)))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Resuelve el nombre de una copia dentro de `backups/` (sin salir de la carpeta). */
export function resolveBackup(databasePath: string, name: string): string {
  const dir = resolve(backupDir(databasePath));
  const file = resolve(dir, name);
  if (!file.startsWith(dir + sep) || !name.endsWith('.sqlite')) {
    throw new BackupError('Nombre de copia no válido.');
  }
  return file;
}

/**
 * Sustituye el archivo de la base por una copia verificada. La base debe estar cerrada.
 * Antes, guarda una copia de seguridad del estado actual (por si la restauración fue un error).
 */
export function restoreBackup(databasePath: string, backupFile: string): void {
  verifyDatabaseFile(backupFile);
  if (existsSync(databasePath)) {
    const dir = backupDir(databasePath);
    mkdirSync(dir, { recursive: true });
    const base = basename(databasePath).replace(/\.sqlite$/, '');
    copyFileSync(databasePath, join(dir, `${base}-${stamp(new Date())}-antes-de-restaurar.sqlite`));
  }
  for (const suffix of ['-wal', '-shm']) rmSync(`${databasePath}${suffix}`, { force: true });
  copyFileSync(backupFile, databasePath);
  verifyDatabaseFile(databasePath);
}
