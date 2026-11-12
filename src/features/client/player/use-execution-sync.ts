'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ClientCommand, type ExecutionStateVM } from '@/contracts/execution';
import { type LocalStore, openLocalStore, type QueuedCommand } from './local-store';
import { flushSession, stateUrl } from './sync-engine';

/**
 * Sincronización de la ejecución en el reproductor (V1_SPEC §5.7, docs/EXECUTION.md):
 * 1. Cada comando se guarda en el dispositivo ANTES de enviarse.
 * 2. Se envían en orden, de uno en uno, con su identificador estable (los reintentos no duplican).
 * 3. Solo se borra del dispositivo cuando el servidor lo confirma (200); el estado que devuelve
 *    el servidor manda sobre lo local.
 * 4. Un fallo de red o del servidor (5xx) se reintenta solo: a los 2, 4, 8, 16 y 30 s, al
 *    recuperar la conexión, al volver a la pestaña y con «Reintentar».
 * 5. Un rechazo (4xx) no se descarta en silencio: queda visible con su motivo.
 */
export type SyncSummary = 'idle' | 'pending' | 'sending' | 'error';

export interface ExecutionSync {
  ready: boolean;
  storage: LocalStore['kind'] | null;
  online: boolean;
  serverState: ExecutionStateVM;
  queue: QueuedCommand[];
  summary: SyncSummary;
  /** Aviso breve de una reconciliación («Esa serie ya estaba registrada…»). */
  notice: string | null;
  enqueue: (command: ClientCommand) => Promise<void>;
  /** Encola y espera al primer intento de envío (por ejemplo, antes de salir del reproductor). */
  sendNow: (command: ClientCommand) => Promise<void>;
  retryNow: () => void;
  discard: (commandId: string) => Promise<void>;
  dismissNotice: () => void;
}

export function useExecutionSync(sessionId: string, initial: ExecutionStateVM): ExecutionSync {
  const [store, setStore] = useState<LocalStore | null>(null);
  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [serverState, setServerState] = useState(initial);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** El último `flush`, para reprogramarlo desde un temporizador sin referenciarse a sí mismo. */
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const order = useRef(0);

  const reload = useCallback(
    async (s: LocalStore) => setQueue(await s.list(sessionId)),
    [sessionId],
  );

  /** Pide al servidor el estado confirmado (al volver a la pestaña o recuperar la conexión). */
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(stateUrl(sessionId), { cache: 'no-store' });
      if (response.ok) {
        const body = (await response.json()) as { ok: true; state: ExecutionStateVM };
        setServerState(body.state);
      }
    } catch {
      // Sin conexión: se usará lo que ya hay.
    }
  }, [sessionId]);

  const flush = useCallback(async () => {
    if (!store) return;
    if (timer.current) clearTimeout(timer.current);
    const { waitMs } = await flushSession(store, sessionId, {
      onState: setServerState,
      onNotice: setNotice,
      onChange: () => void reload(store),
      onNetwork: (reachable) => setOnline(reachable || navigator.onLine),
    });
    await reload(store);
    if (waitMs !== null) timer.current = setTimeout(() => void flushRef.current(), waitMs);
  }, [reload, sessionId, store]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Abrir el almacén y recuperar lo pendiente (también lo que se estaba enviando al cerrar).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await openLocalStore();
      for (const entry of await s.list(sessionId)) {
        if (entry.status === 'sending') {
          await s.put({ ...entry, status: 'queued', nextAttemptAt: 0 });
        }
      }
      if (cancelled) return;
      setStore(s);
      await reload(s);
      setOnline(navigator.onLine);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, sessionId]);

  // En cuanto hay almacén: enviar lo pendiente y pedir el estado confirmado.
  useEffect(() => {
    if (!store) return;
    // Sincroniza con un sistema externo (el servidor): el estado cambia cuando llega su respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().then(() => flush());
  }, [flush, refresh, store]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void refresh().then(() => flush());
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh().then(() => flush());
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush, refresh]);

  // Aviso al salir de la página con registros sin confirmar.
  const unsent = queue.some((e) => e.status !== 'error');
  useEffect(() => {
    if (!unsent) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsent]);

  const enqueue = useCallback(
    async (command: ClientCommand) => {
      if (!store) throw new Error('El almacén local aún no está listo.');
      order.current += 1;
      await store.put({
        commandId: command.commandId,
        sessionId,
        command,
        createdAt: Date.now() * 1000 + (order.current % 1000),
        status: 'queued',
        attempts: 0,
        nextAttemptAt: 0,
      });
      await reload(store);
      void flush();
    },
    [flush, reload, sessionId, store],
  );

  const sendNow = useCallback(
    async (command: ClientCommand) => {
      await enqueue(command);
      await flush();
      // Si otra parte de la app estaba enviando esta cola, la recogerá: se espera (como mucho
      // 4 s) a que el servidor la confirme, la rechace o haya que esperar por la red.
      for (let waited = 0; store && waited < 4_000; waited += 100) {
        const entry = (await store.list(sessionId)).find((e) => e.commandId === command.commandId);
        if (!entry || entry.status === 'error' || entry.attempts > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    [enqueue, flush, sessionId, store],
  );

  const retryNow = useCallback(() => {
    if (!store) return;
    void (async () => {
      for (const entry of await store.list(sessionId)) {
        if (entry.status === 'queued') await store.put({ ...entry, nextAttemptAt: 0 });
      }
      await reload(store);
      await refresh();
      await flush();
    })();
  }, [flush, refresh, reload, sessionId, store]);

  const discard = useCallback(
    async (commandId: string) => {
      if (!store) return;
      await store.remove(commandId);
      await reload(store);
    },
    [reload, store],
  );

  const summary: SyncSummary = queue.some((e) => e.status === 'error')
    ? 'error'
    : queue.some((e) => e.status === 'sending')
      ? 'sending'
      : queue.length > 0
        ? 'pending'
        : 'idle';

  return {
    ready: store !== null,
    storage: store?.kind ?? null,
    online,
    serverState,
    queue,
    summary,
    notice,
    enqueue,
    sendNow,
    retryNow,
    discard,
    dismissNotice: () => setNotice(null),
  };
}
