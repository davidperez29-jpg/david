/**
 * Copia local de un borrador del constructor que aún no ha confirmado el servidor
 * (docs/AUDIT_BLOCK1.md A-07). Sobrevive a recargar, a cerrar la pestaña y a un fallo del
 * servidor; se borra cuando el servidor confirma ese mismo contenido.
 *
 * La clave lleva la identidad de quien edita, el cliente y la sesión: en un dispositivo
 * compartido nunca se ofrece el borrador de otra persona. Las funciones reciben el almacén
 * (`localStorage` en la app) para poder probarlas sin navegador.
 */
import { type SessionContent } from '@/domain/training/session-v2';

export interface DraftBackup {
  /** Quién lo escribió (se comprueba también al leer). */
  trainerId: string;
  content: SessionContent;
  /** Revisión del servidor sobre la que se hicieron estos cambios. */
  baseRevision: number;
  /** Cuándo se hizo el último cambio de esta copia. */
  savedAt: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const draftBackupKey = (trainerId: string, clientId: string, sessionId: string) =>
  `trainpro:borrador:v1:${trainerId}:${clientId}:${sessionId}`;

/** El almacén del navegador, o `null` si no está disponible (navegación privada, sin espacio…). */
export function browserStore(): KeyValueStore | null {
  try {
    const store = window.localStorage;
    const probe = 'trainpro:prueba';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export function readDraftBackup(
  store: KeyValueStore | null,
  trainerId: string,
  clientId: string,
  sessionId: string,
): DraftBackup | null {
  if (!store) return null;
  try {
    const raw = store.getItem(draftBackupKey(trainerId, clientId, sessionId));
    if (!raw) return null;
    const backup = JSON.parse(raw) as DraftBackup;
    // Defensa adicional: una copia de otra identidad nunca se ofrece.
    if (backup.trainerId !== trainerId || !Array.isArray(backup.content?.items)) return null;
    return backup;
  } catch {
    return null;
  }
}

export function writeDraftBackup(
  store: KeyValueStore | null,
  clientId: string,
  sessionId: string,
  backup: DraftBackup,
): boolean {
  if (!store) return false;
  try {
    store.setItem(draftBackupKey(backup.trainerId, clientId, sessionId), JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

export function removeDraftBackup(
  store: KeyValueStore | null,
  trainerId: string,
  clientId: string,
  sessionId: string,
): void {
  try {
    store?.removeItem(draftBackupKey(trainerId, clientId, sessionId));
  } catch {
    // Sin almacén: nada que borrar.
  }
}
