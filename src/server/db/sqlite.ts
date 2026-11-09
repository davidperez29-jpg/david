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
  close(): void;
}

export interface OpenOptions {
  readonly?: boolean;
}

/**
 * Abre la base con la configuración de durabilidad e integridad de V1:
 * WAL, `synchronous=FULL` (una transacción confirmada sobrevive a un corte de corriente),
 * claves ajenas activadas y espera de 5 s si otro proceso tiene la escritura.
 */
export function openSqlite(path: string, options: OpenOptions = {}): SqlDatabase {
  const raw = new Database(path, { readonly: options.readonly ?? false, fileMustExist: false });
  raw.pragma('busy_timeout = 5000');
  raw.pragma('foreign_keys = ON');
  if (!options.readonly) {
    raw.pragma('journal_mode = WAL');
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
