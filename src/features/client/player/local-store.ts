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
 */
import { type ClientCommand } from '@/contracts/execution';
import { type Issue } from '@/domain/issues';

export type QueueStatus = 'queued' | 'sending' | 'error';

export interface QueuedCommand {
  commandId: string;
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
  list(sessionId: string): Promise<QueuedCommand[]>;
  /** Todos los comandos pendientes, de cualquier sesión. */
  listAll(): Promise<QueuedCommand[]>;
  put(entry: QueuedCommand): Promise<void>;
  remove(commandId: string): Promise<void>;
  getUi<T>(key: string): Promise<T | undefined>;
  setUi(key: string, value: unknown): Promise<void>;
  deleteUi(key: string): Promise<void>;
}

const DB_NAME = 'trainpro-ejecucion';
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains('commands')) {
        const commands = db.createObjectStore('commands', { keyPath: 'commandId' });
        commands.createIndex('bySession', 'sessionId');
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
    async list(sessionId) {
      const tx = db.transaction('commands', 'readonly');
      const all = await request(tx.objectStore('commands').index('bySession').getAll(sessionId));
      return (all as QueuedCommand[]).sort(byOrder);
    },
    async listAll() {
      const tx = db.transaction('commands', 'readonly');
      return ((await request(tx.objectStore('commands').getAll())) as QueuedCommand[]).sort(
        byOrder,
      );
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
    list: async (sessionId) =>
      [...commands.values()].filter((c) => c.sessionId === sessionId).sort(byOrder),
    listAll: async () => [...commands.values()].sort(byOrder),
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
