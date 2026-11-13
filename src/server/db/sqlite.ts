/**
 * Conexión SQLite de TrainPro.
 *
 * ÚNICO módulo que importa el controlador (`better-sqlite3`; regla de ESLint). El resto del
 * código usa esta interfaz mínima, de modo que cambiar de controlador (por ejemplo, a
 * `node:sqlite`) o pasar a PostgreSQL no afecta a la lógica (ver docs/V1_SPEC.md §8.3).
 *
 * Usa importaciones relativas con extensión `.ts` y no importa `server-only`: así la
 * herramienta de copias (`scripts/db.ts`) puede ejecutarlo directamente con Node.
 */
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

export type SqlValue = string | number | bigint | null;
export type SqlParams = Record<string, SqlValue>;

export interface SqlStatement {
  run(params?: SqlParams): { changes: number };
  get<T>(params?: SqlParams): T | undefined;
  all<T>(params?: SqlParams): T[];
}

export interface SqlDatabase {
  readonly path: string;
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  /**
   * Ejecuta `fn` en una transacción `BEGIN IMMEDIATE` (reserva la escritura desde el principio).
   * Si `fn` lanza un error, se deshace todo. Las llamadas anidadas usan puntos de guardado.
   */
  transaction<T>(fn: () => T): T;
  /** Valor simple de un PRAGMA (por ejemplo, `journal_mode`). */
  pragma(name: string): unknown;
  /** Copia en línea a otro archivo, coherente aunque haya escrituras en curso. */
  backupTo(destination: string): Promise<void>;
  /** Resultado de `PRAGMA integrity_check` (`'ok'` si la base está íntegra). */
  integrityCheck(): string;
  /** Vuelca el WAL al archivo principal y lo deja vacío. Devuelve si se completó entero. */
  checkpoint(): boolean;
  close(): void;
}

export interface OpenOptions {
  readonly?: boolean;
  /**
   * `wal` (por defecto) para la base en uso. `delete` para copias y archivos de restauración:
   * así el archivo es autosuficiente (sin `-wal` ni `-shm`) y se puede copiar o renombrar solo.
   */
  journalMode?: 'wal' | 'delete';
  /** Espera máxima (ms) si otro proceso tiene la escritura. Ver `BUSY_TIMEOUT_MS`. */
  busyTimeoutMs?: number;
}

/**
 * Espera máxima ante un bloqueo de escritura (docs/AUDIT_BLOCK1.md A-11).
 *
 * Con el bloqueo exclusivo de la ubicación de datos (`lock.ts`), ningún otro proceso de TrainPro
 * escribe en la base, y dentro del proceso el controlador es síncrono: no hay esperas en el uso
 * normal. Solo puede esperar si una herramienta ajena (por ejemplo, un visor de SQLite) reserva la
 * escritura. El controlador es síncrono: mientras espera, el servidor entero se detiene. 1 s acota
 * esa parada y basta para un punto de control del WAL; pasado ese tiempo la operación se rechaza
 * con un error recuperable (`storage_busy`) y el cliente la reintenta.
 */
export const BUSY_TIMEOUT_MS = 1000;

/**
 * Abre la base con la configuración de durabilidad e integridad de V1:
 * WAL, `synchronous=FULL` (una transacción confirmada sobrevive a un corte de corriente),
 * claves ajenas activadas y espera de 5 s si otro proceso tiene la escritura.
 */
export function openSqlite(path: string, options: OpenOptions = {}): SqlDatabase {
  const busy = options.busyTimeoutMs ?? BUSY_TIMEOUT_MS;
  const raw = new Database(path, {
    readonly: options.readonly ?? false,
    fileMustExist: false,
    timeout: busy,
  });
  raw.pragma(`busy_timeout = ${busy}`);
  raw.pragma('foreign_keys = ON');
  if (!options.readonly) {
    raw.pragma(`journal_mode = ${options.journalMode === 'delete' ? 'DELETE' : 'WAL'}`);
    raw.pragma('synchronous = FULL');
  }
  const cache = new Map<string, Database.Statement>();
  const statement = (sql: string) => {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  };
  return {
    path,
    exec: (sql) => {
      raw.exec(sql);
    },
    prepare: (sql) => {
      const stmt = statement(sql);
      return {
        run: (params) => {
          const result = params ? stmt.run(params) : stmt.run();
          return { changes: result.changes };
        },
        get: <T>(params?: SqlParams) => (params ? stmt.get(params) : stmt.get()) as T | undefined,
        all: <T>(params?: SqlParams) => (params ? stmt.all(params) : stmt.all()) as T[],
      };
    },
    transaction: (fn) => raw.transaction(fn).immediate(),
    pragma: (name) => raw.pragma(name, { simple: true }),
    backupTo: async (destination) => {
      await raw.backup(destination);
    },
    integrityCheck: () => String(raw.pragma('integrity_check', { simple: true })),
    checkpoint: () => {
      const [row] = raw.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
      return !row || row.busy === 0;
    },
    close: () => {
      cache.clear();
      raw.close();
    },
  };
}

/** Errores de restricción de SQLite, sin exponer los tipos del controlador. */
export type ConstraintKind = 'unique' | 'primary_key' | 'foreign_key' | 'check' | 'trigger';

export function constraintKind(error: unknown): ConstraintKind | null {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
      return 'unique';
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      return 'primary_key';
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return 'foreign_key';
    case 'SQLITE_CONSTRAINT_CHECK':
      return 'check';
    case 'SQLITE_CONSTRAINT_TRIGGER':
      return 'trigger';
    default:
      return null;
  }
}

/**
 * Tipo de un error de almacenamiento, para responder con un error controlado:
 * - `busy`: otro proceso tiene la escritura; es recuperable (reintentar más tarde).
 * - `full`, `readonly`, `io`, `corrupt`: no se arreglan reintentando de inmediato.
 */
export type StorageErrorKind = 'busy' | 'full' | 'readonly' | 'io' | 'corrupt';

export function storageErrorKind(error: unknown): StorageErrorKind | null {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) return 'busy';
  if (code === 'SQLITE_FULL') return 'full';
  if (code.startsWith('SQLITE_READONLY')) return 'readonly';
  if (code.startsWith('SQLITE_IOERR') || code === 'SQLITE_CANTOPEN') return 'io';
  if (code.startsWith('SQLITE_CORRUPT') || code === 'SQLITE_NOTADB') return 'corrupt';
  return null;
}

/** Otro proceso tiene el bloqueo. */
export class OsLockHeldError extends Error {}

export interface OsLock {
  release(): void;
}

/**
 * Bloqueo exclusivo del sistema operativo sobre el archivo `path`, obtenido a través de SQLite
 * (`locking_mode=EXCLUSIVE` y una escritura): `fcntl` en Linux y macOS, `LockFileEx` en Windows.
 *
 * - Lo tiene un solo proceso. Dentro del mismo proceso, una segunda conexión también lo encuentra
 *   ocupado (SQLite coordina sus conexiones).
 * - El sistema lo libera si el proceso termina por cualquier motivo, también con `SIGKILL` o un
 *   corte: no quedan bloqueos «obsoletos» que haya que borrar a mano.
 * - Nadie lo libera salvo su titular (`release`, o al terminar el proceso).
 * - Limitación: en sistemas de archivos de red sin bloqueos fiables no protege.
 */
export function acquireOsLock(path: string, waitMs = 0): OsLock {
  let raw: Database.Database;
  try {
    raw = new Database(path, { timeout: waitMs });
  } catch (error) {
    if (storageErrorKind(error) === 'busy') throw new OsLockHeldError(path);
    throw error;
  }
  try {
    raw.pragma(`busy_timeout = ${waitMs}`);
    raw.pragma('locking_mode = EXCLUSIVE');
    raw.exec(
      'CREATE TABLE IF NOT EXISTS titular (id INTEGER PRIMARY KEY CHECK (id = 1), desde TEXT NOT NULL)',
    );
    // La primera escritura en modo exclusivo obtiene el bloqueo y ya no lo suelta.
    raw
      .prepare('INSERT OR REPLACE INTO titular (id, desde) VALUES (1, ?)')
      .run(new Date().toISOString());
  } catch (error) {
    raw.close();
    if (storageErrorKind(error) === 'busy') throw new OsLockHeldError(path);
    throw error;
  }
  const lock: OsLock = {
    release: () => {
      ACTIVE_LOCKS.delete(lock);
      if (raw.open) raw.close();
    },
  };
  // Referencia fuerte hasta que se libere: si el objeto se recolectara, SQLite cerraría la conexión
  // y soltaría el bloqueo sin que nadie lo pidiera.
  ACTIVE_LOCKS.add(lock);
  return lock;
}

const ACTIVE_LOCKS = new Set<OsLock>();

/** ¿Tiene otro proceso el bloqueo de `path`? Lo comprueba sin quedárselo. */
export function isOsLockHeld(path: string): boolean {
  if (!existsSync(path)) return false;
  let raw: Database.Database | null = null;
  try {
    raw = new Database(path, { readonly: true, fileMustExist: true, timeout: 0 });
    raw.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get();
    return false;
  } catch (error) {
    if (storageErrorKind(error) === 'busy') return true;
    throw error;
  } finally {
    raw?.close();
  }
}
