import 'server-only';
import { DataLocationBusyError } from './db/lock';
import { storageErrorKind } from './db/sqlite';
import { StorageUnavailableError } from './db/store';

/**
 * Clasificación de los errores de almacenamiento (docs/AUDIT_BLOCK1.md A-11), para responder con
 * un error controlado en lugar de un 500 genérico:
 *
 * - `storage_busy`: otro proceso tiene la escritura (SQLITE_BUSY tras `BUSY_TIMEOUT_MS`).
 *   Recuperable: la transacción no se aplicó; se puede reintentar enseguida.
 * - `storage_unavailable`: la base o su bloqueo se borraron o sustituyeron, o la usa otro
 *   proceso. Recuperable cuando se resuelva (reiniciar el servidor).
 * - `storage_error`: disco lleno, solo lectura, error de E/S o base dañada. No se arregla
 *   reintentando de inmediato.
 *
 * En los tres casos la transacción se deshizo entera: nada se da por guardado.
 * `null` si el error no es de almacenamiento (un fallo de programación: se deja como 500).
 */
export type StorageFailure = 'storage_busy' | 'storage_unavailable' | 'storage_error';

export function classifyStorageError(error: unknown): StorageFailure | null {
  if (error instanceof StorageUnavailableError || error instanceof DataLocationBusyError) {
    return 'storage_unavailable';
  }
  const kind = storageErrorKind(error);
  if (kind === 'busy') return 'storage_busy';
  if (kind !== null) return 'storage_error';
  return null;
}

/** Segundos que conviene esperar antes de reintentar (cabecera `Retry-After`). */
export const RETRY_AFTER_SECONDS: Record<StorageFailure, number | null> = {
  storage_busy: 2,
  storage_unavailable: 10,
  storage_error: null,
};
