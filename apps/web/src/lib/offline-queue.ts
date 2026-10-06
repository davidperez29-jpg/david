'use client';

/**
 * Offline mutation queue (§4.5). Every action of the session player is written to IndexedDB
 * first and then replayed against `/api/v1/sync` in order. The server is idempotent by
 * `clientMutationId`, so replaying after a lost response never duplicates data. Mutations are
 * removed only once the server has answered for them (applied, duplicate, flagged or rejected).
 */

export type Mutation =
  | ({ type: 'set'; clientMutationId: string; sessionId: string } & Record<string, unknown>)
  | ({ type: 'substitution'; clientMutationId: string } & Record<string, unknown>)
  | ({ type: 'complete'; clientMutationId: string; sessionId: string } & Record<string, unknown>)
  | ({ type: 'exercise_feedback'; clientMutationId: string } & Record<string, unknown>);

export interface SyncResult {
  clientMutationId: string;
  type: Mutation['type'];
  status: 'applied' | 'duplicate' | 'flagged' | 'approved' | 'pending' | 'rejected';
  id?: string;
  message?: string | null;
}

const DB = 'tp-offline';
const STORE = 'mutations';
let memory: { seq: number; m: Mutation }[] = [];
let seq = 0;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

export async function enqueue(m: Mutation): Promise<void> {
  const ok = await tx('readwrite', (s) => s.add({ m }));
  if (ok == null) memory.push({ seq: ++seq, m });
  notify();
}

export async function pending(): Promise<{ seq: number; m: Mutation }[]> {
  const rows = await tx(
    'readonly',
    (s) => s.getAll() as IDBRequest<{ seq: number; m: Mutation }[]>,
  );
  return [...(rows ?? []), ...memory].sort((a, b) => a.seq - b.seq);
}

async function remove(seqs: number[]) {
  memory = memory.filter((x) => !seqs.includes(x.seq));
  await tx('readwrite', (s) => {
    let last: IDBRequest<undefined> | null = null;
    for (const k of seqs) last = s.delete(k);
    return (last ?? s.count()) as IDBRequest<unknown>;
  });
  notify();
}

type Listener = (results: SyncResult[]) => void;
const listeners = new Set<() => void>();
const resultListeners = new Set<Listener>();
function notify() {
  for (const l of listeners) l();
}
export function onChange(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function onResults(l: Listener) {
  resultListeners.add(l);
  return () => resultListeners.delete(l);
}

let flushing: Promise<void> | null = null;
/** A flush was asked for while one was running (e.g. «online» during a failing attempt). */
let again = false;

/**
 * Sends the queue. Network failures keep everything for the next attempt. A request that
 * arrives while a flush is running is not lost: another flush runs right after it, so the
 * reconnection that happens during a failing (offline) attempt still syncs the queue.
 */
export function flush(): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      const items = await pending();
      if (!items.length) return;
      const batch = items.slice(0, 200);
      let res: Response;
      try {
        res = await fetch('/api/v1/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ mutations: batch.map((x) => x.m) }),
        });
      } catch {
        return; // offline: try again later
      }
      if (!res.ok) {
        // A rejected batch (e.g. malformed) would block the queue forever: drop it on 400 only.
        if (res.status === 400) await remove(batch.map((x) => x.seq));
        return;
      }
      const { results } = (await res.json()) as { results: SyncResult[] };
      await remove(batch.map((x) => x.seq));
      for (const l of resultListeners) l(results);
      if (items.length > batch.length) {
        flushing = null;
        await flush();
      }
    } finally {
      flushing = null;
      if (again) {
        again = false;
        void flush();
      }
    }
  })();
  return flushing;
}

export function newMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let wired = false;
/** Flushes on reconnect and when the app comes back to the foreground. */
export function wireAutoSync() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  void flush();
}
