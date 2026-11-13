/**
 * Guardado local temporal del reproductor (V1_SPEC §5.7, docs/EXECUTION.md): IndexedDB, sin
 * dependencias.
 *
 * - `commands`: los comandos aún no confirmados por el servidor, con su estado de envío. Se
 *   escriben ANTES de enviarlos y se borran solo cuando el servidor los confirma.
 * - `ui`: lo que debe sobrevivir a una recarga sin ser un dato del entrenamiento (la hora de fin
 *   del descanso y el ejercicio que se estaba viendo).
 *
 * Si el navegador no permite IndexedDB (navegación privada restringida, sin espacio…), se usa la
 * memoria y el reproductor muestra un aviso permanente: lo pendiente se perdería al cerrar.
 *
 * AISLAMIENTO POR PERSONA (docs/AUDIT_BLOCK1.md A-08): cada comando guarda la identidad que lo
 * creó (`clientId`) y todas las consultas piden la identidad (índice `[clientId, sessionId]`):
 * nada de otra persona se lista, se envía ni se muestra. Los comandos anteriores a este cambio
 * (sin `clientId`) quedan fuera de esas consultas; solo los adopta el reproductor de su sesión,
 * que únicamente puede abrir su titular (`adoptUnowned`).
 */
import { type ClientCommand } from '@/contracts/execution';
import { type Issue } from '@/domain/issues';

export type QueueStatus = 'queued' | 'sending' | 'error';

export interface QueuedCommand {
  commandId: string;
  /** Identidad que lo creó (`null` solo en comandos guardados antes del aislamiento por persona). */
  clientId: string | null;
  sessionId: string;
  command: ClientCommand;
  /** Orden lógico de las operaciones. */
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  /** No se reintenta antes de este instante (espera creciente tras un fallo de red). */
  nextAttemptAt: number;
  /** Rechazo del servidor (4xx): el motivo, para mostrarlo. */
  error?: { code: string; message: string; issues?: Issue[] };
}

export interface LocalStore {
  kind: 'indexeddb' | 'memory';
  /** Los comandos de `owner` en una sesión, en orden. */
  list(owner: string, sessionId: string): Promise<QueuedCommand[]>;
  /** Todos los comandos de `owner`, de cualquier sesión. */
  listAll(owner: string): Promise<QueuedCommand[]>;
  /** Cuántos comandos pendientes hay de OTRAS personas (sin revelar nada de ellos). */
  countForeign(owner: string): Promise<number>;
  /**
   * Comandos sin identidad (anteriores al aislamiento) de una sesión: pasan a ser de `owner`.
   * Solo lo llama el reproductor de esa sesión, que únicamente puede abrir su titular.
   */
  adoptUnowned(owner: string, sessionId: string): Promise<number>;
  put(entry: QueuedCommand): Promise<void>;
  remove(commandId: string): Promise<void>;
  getUi<T>(key: string): Promise<T | undefined>;
  setUi(key: string, value: unknown): Promise<void>;
  deleteUi(key: string): Promise<void>;
}

const DB_NAME = 'trainpro-ejecucion';
const DB_VERSION = 2;

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const commands = db.objectStoreNames.contains('commands')
        ? req.transaction!.objectStore('commands')
        : db.createObjectStore('commands', { keyPath: 'commandId' });
      if (!commands.indexNames.contains('bySession'))
        commands.createIndex('bySession', 'sessionId');
      // Versión 2: índice por persona y sesión. Los comandos antiguos, sin `clientId`, no entran en
      // él (quedan aislados hasta que su titular abra el reproductor de su sesión).
      if (!commands.indexNames.contains('byOwnerSession')) {
        commands.createIndex('byOwnerSession', ['clientId', 'sessionId']);
      }
      if (!db.objectStoreNames.contains('ui')) db.createObjectStore('ui', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña.'));
  });
}

const byOrder = (a: QueuedCommand, b: QueuedCommand) =>
  a.createdAt - b.createdAt || a.commandId.localeCompare(b.commandId);

function indexedDbStore(db: IDBDatabase): LocalStore {
  return {
    kind: 'indexeddb',
    async list(owner, sessionId) {
      const tx = db.transaction('commands', 'readonly');
      const all = await request(
        tx.objectStore('commands').index('byOwnerSession').getAll([owner, sessionId]),
      );
      return (all as QueuedCommand[]).sort(byOrder);
    },
    async listAll(owner) {
      const tx = db.transaction('commands', 'readonly');
      const range = IDBKeyRange.bound([owner, ''], [owner, '\uffff']);
      const all = await request(tx.objectStore('commands').index('byOwnerSession').getAll(range));
      return (all as QueuedCommand[]).sort(byOrder);
    },
    async countForeign(owner) {
      const tx = db.transaction('commands', 'readonly');
      const all = (await request(tx.objectStore('commands').getAll())) as QueuedCommand[];
      return all.filter((e) => e.clientId !== owner).length;
    },
    async adoptUnowned(owner, sessionId) {
      const tx = db.transaction('commands', 'readwrite');
      const store = tx.objectStore('commands');
      const all = (await request(store.index('bySession').getAll(sessionId))) as QueuedCommand[];
      const unowned = all.filter((e) => !e.clientId);
      for (const entry of unowned) {
        store.put({ ...entry, clientId: owner, command: { ...entry.command, clientId: owner } });
      }
      await done(tx);
      return unowned.length;
    },
    async put(entry) {
      const tx = db.transaction('commands', 'readwrite');
      tx.objectStore('commands').put(entry);
      await done(tx);
    },
    async remove(commandId) {
      const tx = db.transaction('commands', 'readwrite');
      tx.objectStore('commands').delete(commandId);
      await done(tx);
    },
    async getUi<T>(key: string) {
      const tx = db.transaction('ui', 'readonly');
      const row = (await request(tx.objectStore('ui').get(key))) as { value: T } | undefined;
      return row?.value;
    },
    async setUi(key, value) {
      const tx = db.transaction('ui', 'readwrite');
      tx.objectStore('ui').put({ key, value });
      await done(tx);
    },
    async deleteUi(key) {
      const tx = db.transaction('ui', 'readwrite');
      tx.objectStore('ui').delete(key);
      await done(tx);
    },
  };
}

function memoryStore(): LocalStore {
  const commands = new Map<string, QueuedCommand>();
  const ui = new Map<string, unknown>();
  return {
    kind: 'memory',
    list: async (owner, sessionId) =>
      [...commands.values()]
        .filter((c) => c.clientId === owner && c.sessionId === sessionId)
        .sort(byOrder),
    listAll: async (owner) =>
      [...commands.values()].filter((c) => c.clientId === owner).sort(byOrder),
    countForeign: async (owner) =>
      [...commands.values()].filter((c) => c.clientId !== owner).length,
    adoptUnowned: async () => 0,
    put: async (entry) => void commands.set(entry.commandId, structuredClone(entry)),
    remove: async (commandId) => void commands.delete(commandId),
    getUi: async <T>(key: string) => ui.get(key) as T | undefined,
    setUi: async (key, value) => void ui.set(key, value),
    deleteUi: async (key) => void ui.delete(key),
  };
}

let opened: Promise<LocalStore> | null = null;

/** El almacén local (uno por pestaña). Si IndexedDB no está disponible, la memoria. */
export function openLocalStore(): Promise<LocalStore> {
  opened ??= (async () => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('Sin IndexedDB');
      const store = indexedDbStore(await openDatabase());
      // Comprobación real de escritura (en algunos modos privados abrir funciona, escribir no).
      await store.setUi('__prueba__', Date.now());
      await store.deleteUi('__prueba__');
      return store;
    } catch {
      return memoryStore();
    }
  })();
  return opened;
}
