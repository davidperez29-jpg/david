/**
 * Exclusividad de la ubicación de datos (docs/AUDIT_BLOCK1.md A-03 y A-04; DECISIONS.md ADR-25).
 *
 * Un solo proceso puede usar una base a la vez: el servidor, `pnpm db:restore` o
 * `pnpm db:recover`. La exclusividad la da un BLOQUEO DEL SISTEMA OPERATIVO sobre
 * `<base>.lock` (ver `acquireOsLock` en `sqlite.ts`), no una marca en un archivo:
 *
 * - Si el titular muere (también con `SIGKILL`), el sistema libera el bloqueo: no hay bloqueos
 *   obsoletos ni identificadores de proceso reutilizados que interpretar.
 * - Nadie más puede liberarlo ni «borrarlo»: el archivo `<base>.lock` no se borra nunca. Si alguien
 *   lo borra a mano (posible en Linux y macOS), el titular lo detecta en la siguiente operación
 *   (`isIntact`) y deja de escribir.
 * - `<base>.lock.json` solo informa de quién lo tiene (proceso, equipo, función, desde cuándo). No
 *   decide nada: puede estar desactualizado.
 *
 * Sin `server-only` ni alias `@/`: lo usa también `scripts/db.ts`.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname } from 'node:path';
import { acquireOsLock, isOsLockHeld, OsLockHeldError } from './sqlite.ts';

export type LockRole = 'servidor' | 'restauracion' | 'recuperacion' | 'pruebas';

export interface LockHolder {
  pid: number;
  host: string;
  role: LockRole;
  since: string;
  node: string;
}

export const lockFile = (databasePath: string) => `${databasePath}.lock`;
export const holderFile = (databasePath: string) => `${databasePath}.lock.json`;

/** La base está en uso por otro proceso: no se arranca ni se restaura. */
export class DataLocationBusyError extends Error {
  readonly databasePath: string;
  readonly holder: LockHolder | null;
  // Sin propiedades en el constructor: Node ejecuta este archivo sin compilar (solo quita tipos).
  constructor(databasePath: string, holder: LockHolder | null) {
    super(
      `La base ${databasePath} está en uso por ${describeHolder(holder)}. ` +
        'Para ese proceso antes de continuar (pnpm db:status muestra quién la usa).',
    );
    this.databasePath = databasePath;
    this.holder = holder;
  }
}

export function describeHolder(holder: LockHolder | null): string {
  if (!holder) return 'otro proceso (sin información de quién es)';
  const roles: Record<LockRole, string> = {
    servidor: 'el servidor de TrainPro',
    restauracion: 'una restauración',
    recuperacion: 'una recuperación',
    pruebas: 'las pruebas',
  };
  return `${roles[holder.role] ?? holder.role} (proceso ${holder.pid} en ${holder.host}, desde ${holder.since})`;
}

/** Lo que dice `<base>.lock.json` (informativo; puede no existir o estar desactualizado). */
export function readHolder(databasePath: string): LockHolder | null {
  try {
    return JSON.parse(readFileSync(holderFile(databasePath), 'utf8')) as LockHolder;
  } catch {
    return null;
  }
}

/** Estado del bloqueo, sin quedárselo. */
export function lockState(databasePath: string): { held: boolean; holder: LockHolder | null } {
  const held = isOsLockHeld(lockFile(databasePath));
  return { held, holder: held ? readHolder(databasePath) : null };
}

interface FileIdentity {
  dev: number;
  ino: number;
}
const identity = (path: string): FileIdentity | null => {
  try {
    const stats = statSync(path);
    return { dev: stats.dev, ino: stats.ino };
  } catch {
    return null;
  }
};
const sameFile = (a: FileIdentity | null, b: FileIdentity | null) =>
  a !== null && b !== null && a.dev === b.dev && a.ino === b.ino;

export interface DataLock {
  readonly databasePath: string;
  readonly role: LockRole;
  /** El bloqueo sigue siendo el mismo archivo (nadie lo ha borrado ni sustituido). */
  isIntact(): boolean;
  release(): void;
}

/**
 * Toma la ubicación de datos en exclusiva. `waitMs` acota la espera (por ejemplo, mientras
 * `pnpm db:status` comprueba el bloqueo un instante). Si otro proceso lo tiene, lanza
 * `DataLocationBusyError` con la información del titular.
 */
export function lockDataLocation(
  databasePath: string,
  role: LockRole,
  options: { waitMs?: number } = {},
): DataLock {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const path = lockFile(databasePath);
  let os;
  try {
    os = acquireOsLock(path, options.waitMs ?? 0);
  } catch (error) {
    if (error instanceof OsLockHeldError) {
      throw new DataLocationBusyError(databasePath, readHolder(databasePath));
    }
    throw error;
  }
  const holder: LockHolder = {
    pid: process.pid,
    host: hostname(),
    role,
    since: new Date().toISOString(),
    node: process.version,
  };
  // Escritura atómica de la información del titular (solo la escribe quien tiene el bloqueo).
  const info = holderFile(databasePath);
  writeFileSync(`${info}.tmp`, JSON.stringify(holder, null, 1), { mode: 0o600 });
  renameSync(`${info}.tmp`, info);
  const mine = identity(path);
  let released = false;
  return {
    databasePath,
    role,
    isIntact: () => !released && sameFile(identity(path), mine),
    release: () => {
      if (released) return;
      released = true;
      try {
        // Solo se borra la información si sigue siendo la nuestra; el archivo de bloqueo, nunca.
        if (readHolder(databasePath)?.pid === process.pid) rmSync(info, { force: true });
      } finally {
        os.release();
      }
    },
  };
}
