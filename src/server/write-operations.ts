import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { asWriteFailure, classifyStorageError, type StorageFailure } from './storage-errors';

/**
 * Escrituras de las acciones de servidor (B3.0; docs/BLOCK3_SPEC.md §14).
 *
 * - **Nunca se reintenta solo.** Repetir una escritura lo decide la persona. Las que existen ya son
 *   seguras de repetir:
 *   - crear una sesión usa el identificador emitido con el formulario;
 *   - guardar y publicar comprueban la revisión;
 *   - borrar y mover un borrador no hacen nada dos veces.
 * - **Los fallos de almacenamiento** se etiquetan como escritura no aplicada (SQLite deshizo la
 *   transacción entera) o, si no se puede asegurar, con resultado desconocido.
 * - **Las señales de Next.js** (`redirect`, `notFound`) pasan intactas (`unstable_rethrow`).
 */

/** Acción de formulario: si falla, lanza el error etiquetado y lo muestra la página de error. */
export async function runWrite<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    const failure = asWriteFailure(error);
    console.error(`${what}: no se ha completado (${failure.kind})`, error);
    throw failure;
  }
}

export type WriteFailure = StorageFailure | 'server_error';

/**
 * Acción que devuelve su resultado (formularios con estado, constructor). El fallo se DEVUELVE y
 * no se lanza (A-05): lo que la persona tiene en pantalla no se pierde.
 */
export async function writeOutcome<T>(
  what: string,
  run: () => Promise<T>,
): Promise<T | { ok: false; reason: WriteFailure }> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    const failure = classifyStorageError(error);
    console.error(`${what}: no se ha completado (${failure ?? 'server_error'})`, error);
    return { ok: false, reason: failure ?? 'server_error' };
  }
}
