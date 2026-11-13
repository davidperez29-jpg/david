/**
 * Fallos de almacenamiento tal como los ve la interfaz (B3.0, docs/BLOCK3_SPEC.md §14 y ADR-34).
 *
 * El servidor clasifica cada fallo de SQLite y lo etiqueta con un `digest` estable y sin datos
 * («TRAINPRO_STORAGE:<tipo>:<operación>»). Next.js conserva el `digest` de un error al pasarlo a
 * la página de error (en producción oculta el mensaje), así que la página sabe QUÉ pasó sin
 * recibir rutas, consultas SQL, trazas ni datos de nadie.
 *
 * Tres preguntas distintas, que no se confunden:
 * - **Tipo**: qué falló (ocupada, no disponible, disco lleno, solo lectura, E/S, integridad).
 * - **Resultado**: si la operación NO se aplicó (`not_applied`), si se desconoce (`unknown`) o si
 *   era una lectura y no cambió nada (`none`).
 * - **Categoría**: recuperable (se puede reintentar), necesita intervención o resultado
 *   desconocido (comprobar antes de repetir).
 */
export type StorageFailureKind =
  | 'busy' // otro proceso tiene la escritura (SQLITE_BUSY tras la espera)
  | 'unavailable' // la base o su bloqueo se borraron o sustituyeron, o la usa otro proceso
  | 'full' // disco lleno
  | 'readonly' // la base no se puede escribir (permisos o sistema de archivos)
  | 'io' // error de entrada/salida del disco
  | 'corrupt' // la base está dañada o no es una base de TrainPro
  | 'unexpected'; // error inesperado durante una escritura

export type StorageOperation = 'read' | 'write';
export type StorageOutcome = 'none' | 'not_applied' | 'unknown';
export type StorageCategory = 'recoverable' | 'intervention' | 'unknown';

export interface StorageFailureInfo {
  kind: StorageFailureKind;
  operation: StorageOperation;
  outcome: StorageOutcome;
  category: StorageCategory;
}

export const STORAGE_FAILURE_KINDS: readonly StorageFailureKind[] = [
  'busy',
  'unavailable',
  'full',
  'readonly',
  'io',
  'corrupt',
  'unexpected',
];

export const STORAGE_DIGEST_PREFIX = 'TRAINPRO_STORAGE';

/**
 * Qué se sabe del resultado.
 * - Una lectura no cambia nada.
 * - Ocupada, no disponible, disco lleno o solo lectura fallan antes de confirmar: SQLite deshace
 *   la transacción entera, así que la operación NO se aplicó.
 * - Un error de E/S o de integridad a mitad de una escritura, o un error inesperado, no permiten
 *   asegurar si se confirmó: el resultado es DESCONOCIDO.
 */
export function storageOutcome(
  kind: StorageFailureKind,
  operation: StorageOperation,
): StorageOutcome {
  if (operation === 'read') return 'none';
  return kind === 'io' || kind === 'corrupt' || kind === 'unexpected' ? 'unknown' : 'not_applied';
}

export function storageCategory(
  kind: StorageFailureKind,
  outcome: StorageOutcome,
): StorageCategory {
  if (outcome === 'unknown') return 'unknown';
  return kind === 'busy' ? 'recoverable' : 'intervention';
}

export function describeStorageFailure(
  kind: StorageFailureKind,
  operation: StorageOperation,
): StorageFailureInfo {
  const outcome = storageOutcome(kind, operation);
  return { kind, operation, outcome, category: storageCategory(kind, outcome) };
}

export const storageDigest = (kind: StorageFailureKind, operation: StorageOperation) =>
  `${STORAGE_DIGEST_PREFIX}:${kind}:${operation}`;

/** Lee el `digest` de un error; `null` si no es un fallo de almacenamiento de TrainPro. */
export function parseStorageDigest(digest: unknown): StorageFailureInfo | null {
  if (typeof digest !== 'string') return null;
  const [prefix, kind, operation, ...rest] = digest.split(':');
  if (prefix !== STORAGE_DIGEST_PREFIX || rest.length > 0) return null;
  if (!STORAGE_FAILURE_KINDS.includes(kind as StorageFailureKind)) return null;
  if (operation !== 'read' && operation !== 'write') return null;
  return describeStorageFailure(kind as StorageFailureKind, operation);
}

/**
 * Códigos que ya usan la API de comandos y el constructor (ADR-29). Se conservan: el móvil y el
 * guardado automático deciden con ellos si reintentar (siempre con el mismo identificador o la
 * misma revisión, así que un reintento no duplica).
 */
export type StorageFailureCode = 'storage_busy' | 'storage_unavailable' | 'storage_error';

export function storageFailureCode(kind: StorageFailureKind): StorageFailureCode | null {
  if (kind === 'busy') return 'storage_busy';
  if (kind === 'unavailable') return 'storage_unavailable';
  if (kind === 'unexpected') return null;
  return 'storage_error';
}
