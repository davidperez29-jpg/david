import 'server-only';
import {
  type StorageFailureKind,
  type StorageOperation,
  storageDigest,
  storageFailureCode,
} from '@/contracts/storage';
import { DataLocationBusyError } from './db/lock';
import { MigrationError } from './db/migrate';
import { storageErrorKind } from './db/sqlite';
import { StorageUnavailableError } from './db/store';

/**
 * Clasificación de los errores de almacenamiento (docs/AUDIT_BLOCK1.md A-11 y A-15; B3.0), para
 * responder con un error controlado en lugar de uno genérico:
 *
 * - `busy`: otro proceso tiene la escritura (SQLITE_BUSY tras `BUSY_TIMEOUT_MS`). Recuperable:
 *   la transacción no se aplicó; se puede reintentar.
 * - `unavailable`: la base o su bloqueo se borraron o sustituyeron, o la usa otro proceso.
 *   Necesita intervención (reiniciar el servidor).
 * - `full`, `readonly`, `io`: disco lleno, base de solo lectura o error de E/S.
 * - `corrupt`: base dañada, que no es de TrainPro o con migraciones que no son las del código.
 *
 * `null` si el error no es de almacenamiento (un fallo de programación).
 */
export function storageFailureKind(
  error: unknown,
): Exclude<StorageFailureKind, 'unexpected'> | null {
  if (error instanceof StorageFailureError) {
    return error.kind === 'unexpected' ? null : error.kind;
  }
  if (error instanceof StorageUnavailableError || error instanceof DataLocationBusyError) {
    return 'unavailable';
  }
  if (error instanceof MigrationError) return 'corrupt';
  return storageErrorKind(error);
}

/**
 * Error de almacenamiento ya clasificado. Lleva un `digest` estable y sin datos, que Next.js
 * conserva al pasar el error a la página de error (en producción oculta el mensaje). El mensaje
 * original solo va al registro del servidor (`cause`), nunca al navegador.
 */
export class StorageFailureError extends Error {
  readonly kind: StorageFailureKind;
  readonly operation: StorageOperation;
  readonly digest: string;
  // Sin propiedades en el constructor (Node ejecuta algunos archivos sin compilar).
  constructor(kind: StorageFailureKind, operation: StorageOperation, cause?: unknown) {
    super(`Fallo de almacenamiento (${kind}, ${operation})`, { cause });
    this.name = 'StorageFailureError';
    this.kind = kind;
    this.operation = operation;
    this.digest = storageDigest(kind, operation);
  }
}

/** Códigos de la API de comandos y del constructor (ADR-29). */
export type StorageFailure = 'storage_busy' | 'storage_unavailable' | 'storage_error';

export function classifyStorageError(error: unknown): StorageFailure | null {
  const kind = storageFailureKind(error);
  return kind ? storageFailureCode(kind) : null;
}

/** Segundos que conviene esperar antes de reintentar (cabecera `Retry-After`). */
export const RETRY_AFTER_SECONDS: Record<StorageFailure, number | null> = {
  storage_busy: 2,
  storage_unavailable: 10,
  storage_error: null,
};

/** Convierte un error de almacenamiento de una lectura en uno etiquetado; los demás, intactos. */
export function asReadFailure(error: unknown): unknown {
  if (error instanceof StorageFailureError) return error;
  const kind = storageFailureKind(error);
  return kind ? new StorageFailureError(kind, 'read', error) : error;
}

/**
 * Error de una ESCRITURA: siempre etiquetado. Lo que no es de almacenamiento pasa a `unexpected`,
 * con resultado desconocido: no se puede asegurar que no se confirmara.
 */
export function asWriteFailure(error: unknown): StorageFailureError {
  if (error instanceof StorageFailureError && error.operation === 'write') return error;
  const kind = storageFailureKind(error) ?? 'unexpected';
  return new StorageFailureError(kind, 'write', error);
}

const WRAPPED = new WeakMap<object, object>();

function rethrowRead(error: unknown): never {
  throw asReadFailure(error);
}

function wrapMethods<T extends object>(target: T): T {
  const cached = WRAPPED.get(target);
  if (cached) return cached as T;
  const proxy = new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        try {
          const result = (value as (...a: unknown[]) => unknown).apply(object, args);
          return result instanceof Promise ? result.catch(rethrowRead) : result;
        } catch (error) {
          rethrowRead(error);
        }
      };
    },
  });
  WRAPPED.set(target, proxy);
  return proxy;
}

/**
 * Los repositorios de una petición, con sus errores de almacenamiento etiquetados (lectura por
 * defecto; las acciones que escriben lo reetiquetan como escritura con `asWriteFailure`). No cambia
 * nada más: los errores que no son de almacenamiento (restricciones, programación) pasan intactos.
 */
export function withStorageFailures<T extends object>(repos: T): T {
  const cached = WRAPPED.get(repos);
  if (cached) return cached as T;
  const proxy = new Proxy(repos, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver);
      return value !== null && typeof value === 'object' ? wrapMethods(value) : value;
    },
  });
  WRAPPED.set(repos, proxy);
  return proxy;
}
