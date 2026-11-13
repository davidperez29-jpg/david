/**
 * Copias de seguridad y restauración de la base local (entorno de prueba, datos ficticios).
 *
 * - La copia es en línea (API de copia de SQLite): coherente aunque el servidor esté escribiendo.
 *   Cada copia queda AUTOSUFICIENTE (diario `DELETE`, sin `-wal` ni `-shm`), con permisos 600 y
 *   sincronizada a disco antes de darla por buena.
 * - Antes de dar por buena una copia, y antes de restaurarla, se comprueba su integridad:
 *   `integrity_check`, claves ajenas y que sus migraciones coinciden con las del código.
 * - La restauración es SEGURA Y RECUPERABLE (docs/AUDIT_BLOCK1.md A-01 y A-02; ADR-25): exige el
 *   bloqueo exclusivo de la ubicación de datos, construye el nuevo estado en un archivo aparte,
 *   lo valida, y solo entonces sustituye la base con un `rename` atómico. Un diario
 *   (`<base>.restauracion.json`) permite terminarla o anularla si se interrumpe.
 */
import {
  closeSync,
  copyFileSync,
  chmodSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { type DataLock } from './lock.ts';
import { checksum, MIGRATIONS } from './migrate.ts';
import { openSqlite, type SqlDatabase } from './sqlite.ts';

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

// ── Utilidades de durabilidad ───────────────────────────────────────────────

/** Escribe en disco el contenido de un archivo (no basta con que el sistema lo tenga en caché). */
function fsyncFile(path: string): void {
  const fd = openSync(path, 'r+');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Escribe en disco la carpeta (un `rename` no es duradero hasta entonces). Windows no lo admite. */
function fsyncDir(dir: string): void {
  if (process.platform === 'win32') return;
  const fd = openSync(dir, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

const AUX = ['-wal', '-shm', '-journal'] as const;
const removeWithAux = (file: string) => {
  for (const f of [file, ...AUX.map((s) => `${file}${s}`)]) rmSync(f, { force: true });
};

function privateFile(path: string): void {
  if (process.platform !== 'win32') chmodSync(path, 0o600);
}

/**
 * Deja un archivo de base autosuficiente: diario `DELETE` (sin `-wal` ni `-shm`), permisos 600 y
 * sincronizado a disco. Así se puede copiar, verificar o renombrar sin archivos auxiliares.
 */
function makeSelfContained(file: string): void {
  const db = openSqlite(file, { journalMode: 'delete' });
  db.close();
  for (const s of AUX) rmSync(`${file}${s}`, { force: true });
  privateFile(file);
  fsyncFile(file);
}

// ── Verificación ────────────────────────────────────────────────────────────

function checkOpenDatabase(db: SqlDatabase, label: string): void {
  const integrity = db.integrityCheck();
  if (integrity !== 'ok') throw new BackupError(`${label} no está íntegra: ${integrity}`);
  const brokenKeys = db.prepare('PRAGMA foreign_key_check').all();
  if (brokenKeys.length > 0) {
    throw new BackupError(`${label} tiene ${brokenKeys.length} relaciones rotas.`);
  }
  const hasMigrations = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();
  if (!hasMigrations) throw new BackupError(`${label} no es una base de TrainPro.`);
  const applied = db
    .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
    .all<{ version: number; checksum: string }>();
  for (const row of applied) {
    const known = MIGRATIONS.find((m) => m.version === row.version);
    if (!known || checksum(known.sql) !== row.checksum) {
      throw new BackupError(`${label} usa una migración (${row.version}) distinta de este código.`);
    }
  }
}

/** Comprueba que un archivo es una base de TrainPro íntegra y compatible con este código. */
export function verifyDatabaseFile(file: string, label = 'La copia'): void {
  if (!existsSync(file)) throw new BackupError(`No existe la copia ${file}.`);
  // Abrir en modo WAL crea archivos auxiliares: se borran después los que no existían antes.
  // (`turbopackIgnore`: son archivos de datos en tiempo de ejecución, no algo que rastrear al compilar.)
  const preexisting = AUX.filter((s) => existsSync(/*turbopackIgnore: true*/ `${file}${s}`));
  let db;
  try {
    db = openSqlite(file, { readonly: true });
  } catch (error) {
    throw new BackupError(`No se puede abrir ${basename(file)}: ${(error as Error).message}`);
  }
  try {
    checkOpenDatabase(db, label);
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError(`${label} no se puede leer: ${(error as Error).message}`);
  } finally {
    db.close();
    for (const s of AUX) {
      if (!preexisting.includes(s)) rmSync(`${file}${s}`, { force: true });
    }
  }
}

// ── Copias ──────────────────────────────────────────────────────────────────

function uniqueBackupFile(databasePath: string, label: string, now: Date): string {
  const dir = backupDir(databasePath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const base = basename(databasePath).replace(/\.sqlite$/, '');
  const suffix = label ? `-${label.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}` : '';
  let file = join(dir, `${base}-${stamp(now)}${suffix}.sqlite`);
  for (let n = 2; existsSync(file); n += 1) {
    file = join(dir, `${base}-${stamp(now)}${suffix}-${n}.sqlite`);
  }
  return file;
}

/** Copia la base abierta a `backups/`, la deja autosuficiente y la verifica. */
export async function createBackup(
  db: { path: string; backupTo(destination: string): Promise<void> },
  options: { label?: string; now?: Date } = {},
): Promise<BackupInfo> {
  const file = uniqueBackupFile(db.path, options.label ?? '', options.now ?? new Date());
  await db.backupTo(file);
  makeSelfContained(file);
  verifyDatabaseFile(file);
  return describe(file);
}

/**
 * Copia SÍNCRONA de una base abierta por este proceso: vuelca el WAL al archivo principal y lo
 * copia. Se usa antes de migrar y antes de restablecer los datos, donde no puede colarse ninguna
 * escritura entre la copia y el cambio (el bloqueo exclusivo impide otros procesos y todo ocurre
 * sin ceder el turno a otra petición).
 */
export function snapshotSync(
  db: { path: string; checkpoint(): boolean },
  label: string,
  now: Date = new Date(),
): BackupInfo {
  if (!db.checkpoint()) {
    throw new BackupError('No se ha podido volcar el WAL antes de la copia: no se continúa.');
  }
  const file = uniqueBackupFile(db.path, label, now);
  copyFileSync(db.path, file);
  makeSelfContained(file);
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

// ── Restauración segura ─────────────────────────────────────────────────────

/**
 * Fases de una restauración, en orden. Las pruebas detienen el proceso en cada una
 * (`hooks.pause`) para comprobar que una interrupción nunca deja la base dañada ni pierde datos.
 */
export const RESTORE_PHASES = [
  'preparando', // diario escrito; aún no se ha creado nada
  'copia-previa', // copia verificada del estado actual (con lo que hubiera en el WAL)
  'escribiendo', // a mitad de escribir el archivo temporal
  'escrito', // temporal escrito y sincronizado, sin validar
  'validando', // con el temporal abierto para validarlo
  'sustituyendo', // validado; justo antes del `rename`
  'sustituido', // `rename` hecho; sin la verificación final
  'recuperando', // dentro de la recuperación de una restauración interrumpida
] as const;
export type RestorePhase = (typeof RESTORE_PHASES)[number];

export interface RestoreHooks {
  /** Punto de pausa de las pruebas. En la aplicación no hace nada. */
  pause?: (phase: RestorePhase) => void;
}

interface RestoreJournal {
  version: 1;
  startedAt: string;
  backup: string;
  temp: string;
  /** Dónde se guarda (o se estaba guardando) la copia del estado anterior. */
  previous: string | null;
  previousVerified: boolean;
  phase: 'preparando' | 'listo-para-sustituir' | 'sustituido';
}

export const journalFile = (databasePath: string) => `${databasePath}.restauracion.json`;
const tempFile = (databasePath: string) => `${databasePath}.restaurando`;

function readJournal(databasePath: string): RestoreJournal | null {
  const file = journalFile(databasePath);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as RestoreJournal;
  } catch {
    throw new BackupError(
      `El diario de restauración ${file} no se puede leer. No se toca nada: revisa a mano la base y backups/.`,
    );
  }
}

/** Escritura atómica y duradera del diario. */
function writeJournal(databasePath: string, journal: RestoreJournal): void {
  const file = journalFile(databasePath);
  writeFileSync(`${file}.tmp`, JSON.stringify(journal, null, 1), { mode: 0o600 });
  fsyncFile(`${file}.tmp`);
  renameSync(`${file}.tmp`, file);
  fsyncDir(dirname(file));
}

function removeJournal(databasePath: string): void {
  rmSync(journalFile(databasePath), { force: true });
  rmSync(`${journalFile(databasePath)}.tmp`, { force: true });
  fsyncDir(dirname(databasePath));
}

/** Copia por bloques y sincroniza (con un punto de pausa tras el primer bloque). */
function copyInChunks(from: string, to: string, onFirstChunk?: () => void): void {
  const input = openSync(from, 'r');
  const output = openSync(to, 'w', 0o600);
  try {
    const buffer = Buffer.alloc(256 * 1024);
    let first = true;
    for (;;) {
      const read = readSync(input, buffer, 0, buffer.length, null);
      if (read === 0) break;
      writeSync(output, buffer, 0, read);
      if (first) {
        first = false;
        onFirstChunk?.();
      }
    }
    fsyncSync(output);
  } finally {
    closeSync(input);
    closeSync(output);
  }
}

/** Sustituye `target` por `source` de forma atómica (`rename`) y lo hace duradero. */
function atomicReplace(source: string, target: string): void {
  // Un WAL que quedara junto a la base se aplicaría a la nueva y la dañaría.
  for (const s of AUX) {
    const aux = `${target}${s}`;
    // `turbopackIgnore`: archivos de datos en tiempo de ejecución, no algo que rastrear al compilar.
    if (
      s === '-wal' &&
      existsSync(/*turbopackIgnore: true*/ aux) &&
      statSync(/*turbopackIgnore: true*/ aux).size > 0
    ) {
      throw new BackupError(
        'La base tiene cambios en el WAL sin volcar (¿la usa otro proceso?): no se sustituye.',
      );
    }
    rmSync(aux, { force: true });
  }
  renameSync(source, target);
  fsyncDir(dirname(target));
}

/**
 * Copia verificada del estado actual antes de restaurar. Se hace con la API de copia de SQLite
 * sobre la base abierta, así que incluye lo confirmado que aún estuviera en el WAL (A-01). Si la
 * base actual está dañada y no se puede copiar así, se guardan sus archivos tal cual (con su WAL)
 * para no perder nada, y se indica que esa copia no está verificada.
 */
async function savePreviousState(databasePath: string, target: string): Promise<boolean> {
  let db;
  try {
    db = openSqlite(databasePath);
    db.checkpoint();
    await db.backupTo(target);
    db.close();
    db = null;
    makeSelfContained(target);
    verifyDatabaseFile(target, 'La copia del estado anterior');
    return true;
  } catch {
    db?.close();
    removeWithAux(target);
    for (const s of ['', ...AUX]) {
      if (existsSync(`${databasePath}${s}`)) {
        copyFileSync(`${databasePath}${s}`, `${target}${s}`);
        fsyncFile(`${target}${s}`);
      }
    }
    return false;
  }
}

export interface RestoreResult {
  /** Copia del estado anterior (o `null` si no había base). */
  previous: string | null;
  /** Si esa copia se pudo verificar (si la base anterior estaba dañada, se guardó tal cual). */
  previousVerified: boolean;
  /** Si al empezar se encontró una restauración interrumpida y qué se hizo con ella. */
  recovered: RecoveryOutcome | null;
}

/**
 * Restaura `backupFile` sobre la base de `lock`. Requiere el bloqueo exclusivo (por eso lo recibe):
 * ningún servidor puede estar usando la base. Si algo falla antes de la sustitución, la base queda
 * intacta; si falla después, se termina o se deshace con el diario (`recoverInterruptedRestore`).
 */
export async function restoreBackup(
  lock: DataLock,
  backupFile: string,
  hooks: RestoreHooks = {},
): Promise<RestoreResult> {
  if (!lock.isIntact())
    throw new BackupError('Se ha perdido el bloqueo de la base: no se continúa.');
  const databasePath = lock.databasePath;
  const recovered = readJournal(databasePath) ? recoverInterruptedRestore(lock, hooks) : null;
  const temp = tempFile(databasePath);
  removeWithAux(temp);

  // 1. La copia elegida debe ser íntegra y compatible antes de tocar nada.
  verifyDatabaseFile(backupFile);
  const hadDatabase = existsSync(databasePath);
  const journal: RestoreJournal = {
    version: 1,
    startedAt: new Date().toISOString(),
    backup: resolve(backupFile),
    temp,
    previous: hadDatabase ? uniqueBackupFile(databasePath, 'antes-de-restaurar', new Date()) : null,
    previousVerified: false,
    phase: 'preparando',
  };
  writeJournal(databasePath, journal);
  hooks.pause?.('preparando');

  // 2. Copia recuperable del estado actual, con lo que hubiera en el WAL.
  if (journal.previous) {
    journal.previousVerified = await savePreviousState(databasePath, journal.previous);
    writeJournal(databasePath, journal);
  }
  hooks.pause?.('copia-previa');

  // 3. El nuevo estado se construye en un archivo aparte, escrito y sincronizado por completo.
  copyInChunks(backupFile, temp, () => hooks.pause?.('escribiendo'));
  hooks.pause?.('escrito');

  // 4. Validación del archivo temporal (autosuficiente, íntegro y compatible).
  const check = openSqlite(temp, { journalMode: 'delete' });
  try {
    hooks.pause?.('validando');
    checkOpenDatabase(check, 'El archivo a restaurar');
  } finally {
    check.close();
  }
  for (const s of AUX) rmSync(`${temp}${s}`, { force: true });
  privateFile(temp);
  fsyncFile(temp);

  // 5. Sustitución atómica.
  journal.phase = 'listo-para-sustituir';
  writeJournal(databasePath, journal);
  hooks.pause?.('sustituyendo');
  atomicReplace(temp, databasePath);
  journal.phase = 'sustituido';
  writeJournal(databasePath, journal);
  hooks.pause?.('sustituido');

  // 6. Solo se da por terminada cuando la base restaurada se verifica.
  finishOrRevert(databasePath, journal);
  return { previous: journal.previous, previousVerified: journal.previousVerified, recovered };
}

/** Verificación final: si la base sustituida no es válida, se vuelve a la copia previa. */
function finishOrRevert(databasePath: string, journal: RestoreJournal): 'completada' | 'revertida' {
  try {
    verifyDatabaseFile(databasePath, 'La base restaurada');
    removeJournal(databasePath);
    return 'completada';
  } catch (error) {
    if (!journal.previous || !journal.previousVerified) {
      throw new BackupError(
        `${(error as Error).message} No hay una copia previa verificada: recupera a mano desde backups/ (el diario se conserva).`,
      );
    }
    const temp = tempFile(databasePath);
    removeWithAux(temp);
    copyInChunks(journal.previous, temp);
    verifyDatabaseFile(temp, 'La copia del estado anterior');
    atomicReplace(temp, databasePath);
    removeJournal(databasePath);
    return 'revertida';
  }
}

export type RecoveryOutcome =
  | 'nada' // no había ninguna restauración interrumpida
  | 'anulada' // se interrumpió antes de sustituir: la base no se había tocado
  | 'completada' // se interrumpió después de sustituir: la base restaurada es válida
  | 'revertida'; // la base restaurada no era válida: se volvió a la copia previa

/**
 * Termina o anula una restauración interrumpida, según su diario y los archivos que hay. Se puede
 * repetir (si se interrumpe la propia recuperación, la siguiente llega al mismo resultado).
 * Requiere el bloqueo exclusivo: la usan el servidor al arrancar y `pnpm db:recover`.
 */
export function recoverInterruptedRestore(
  lock: DataLock,
  hooks: RestoreHooks = {},
): RecoveryOutcome {
  const databasePath = lock.databasePath;
  const journal = readJournal(databasePath);
  if (!journal) return 'nada';
  hooks.pause?.('recuperando');
  const temp = tempFile(databasePath);
  if (
    journal.phase === 'preparando' ||
    (journal.phase === 'listo-para-sustituir' && existsSync(temp))
  ) {
    // No se llegó a sustituir: la base no se tocó. Se borran el temporal y una copia previa a medias.
    removeWithAux(temp);
    if (journal.previous && existsSync(journal.previous)) {
      try {
        verifyDatabaseFile(journal.previous, 'La copia del estado anterior');
      } catch {
        if (journal.previousVerified === false) removeWithAux(journal.previous);
      }
    }
    removeJournal(databasePath);
    return 'anulada';
  }
  // El `rename` ya se hizo (o el temporal no existe): se verifica la base y, si no vale, se revierte.
  return finishOrRevert(databasePath, { ...journal, phase: 'sustituido' });
}

/** ¿Hay una restauración interrumpida pendiente de recuperar? */
export const hasInterruptedRestore = (databasePath: string) =>
  existsSync(journalFile(databasePath));
