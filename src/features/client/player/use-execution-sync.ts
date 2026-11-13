'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ClientCommand, type ExecutionStateVM } from '@/contracts/execution';
import { type LocalStore, openLocalStore, type QueuedCommand } from './local-store';
import {
  flushSession,
  isRecoverableError,
  resetBackoff,
  retryRecoverable,
  stateUrl,
} from './sync-engine';

/**
 * Sincronización de la ejecución en el reproductor (V1_SPEC §5.7, docs/EXECUTION.md):
 * 1. Cada comando se guarda en el dispositivo ANTES de enviarse.
 * 2. Se envían en orden, de uno en uno, con su identificador estable (los reintentos no duplican).
 * 3. Solo se borra del dispositivo cuando el servidor lo confirma (200); el estado que devuelve
 *    el servidor manda sobre lo local.
 * 4. Un fallo de red o del servidor (5xx) se reintenta solo a los 2, 4, 8, 16 y 30 s; abrir el
 *    reproductor, recuperar la conexión, volver a la pestaña y «Reintentar» lo intentan ya.
 * 5. Un rechazo (4xx) no se descarta en silencio: queda visible con su motivo.
 */
export type SyncSummary = 'idle' | 'pending' | 'sending' | 'error';
// Cola de UNA persona (`owner`): lo de otras identidades en el mismo dispositivo ni se ve ni se envía.

export interface ExecutionSync {
  ready: boolean;
  storage: LocalStore['kind'] | null;
  online: boolean;
  serverState: ExecutionStateVM;
  queue: QueuedCommand[];
  summary: SyncSummary;
  /** Hay algo que «Reintentar» puede enviar (pendientes o errores recuperables). */
  canRetry: boolean;
  /** Aviso breve de una reconciliación («Esa serie ya estaba registrada…»). */
  notice: string | null;
  enqueue: (command: ClientCommand) => Promise<void>;
  /** Encola y espera al primer intento de envío (por ejemplo, antes de salir del reproductor). */
  sendNow: (command: ClientCommand) => Promise<void>;
  retryNow: () => void;
  discard: (commandId: string) => Promise<void>;
  dismissNotice: () => void;
}

export function useExecutionSync(
  owner: string,
  sessionId: string,
  initial: ExecutionStateVM,
): ExecutionSync {
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
    async (s: LocalStore) => setQueue(await s.list(owner, sessionId)),
    [owner, sessionId],
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
    const { waitMs } = await flushSession(store, owner, sessionId, {
      onState: setServerState,
      onNotice: setNotice,
      onChange: () => void reload(store),
      onNetwork: (reachable) => setOnline(reachable || navigator.onLine),
    });
    await reload(store);
    if (waitMs !== null) timer.current = setTimeout(() => void flushRef.current(), waitMs);
  }, [owner, reload, sessionId, store]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Abrir el almacén y recuperar lo pendiente (también lo que se estaba enviando al cerrar).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await openLocalStore();
      // Comandos guardados antes del aislamiento por persona: este reproductor solo lo puede abrir
      // el titular de la sesión, así que son suyos.
      await s.adoptUnowned(owner, sessionId);
      for (const entry of await s.list(owner, sessionId)) {
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
  }, [owner, reload, sessionId]);

  /** Puede haber conexión: se intenta ya lo pendiente (sin esperar) y se pide el estado. */
  const wake = useCallback(async () => {
    if (!store) return;
    await resetBackoff(store, owner, sessionId);
    await reload(store);
    await refresh();
    await flush();
  }, [flush, owner, refresh, reload, sessionId, store]);

  // En cuanto hay almacén: enviar lo pendiente y pedir el estado confirmado.
  useEffect(() => {
    // Sincroniza con un sistema externo (el servidor): el estado cambia cuando llega su respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void wake();
  }, [wake]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void wake();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void wake();
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
  }, [wake]);

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
        clientId: owner,
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
    [flush, owner, reload, sessionId, store],
  );

  const sendNow = useCallback(
    async (command: ClientCommand) => {
      await enqueue(command);
      await flush();
      // Si otra parte de la app estaba enviando esta cola, la recogerá: se espera (como mucho
      // 4 s) a que el servidor la confirme, la rechace o haya que esperar por la red.
      for (let waited = 0; store && waited < 4_000; waited += 100) {
        const entry = (await store.list(owner, sessionId)).find(
          (e) => e.commandId === command.commandId,
        );
        if (!entry || entry.status === 'error' || entry.attempts > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    [enqueue, flush, owner, sessionId, store],
  );

  /** «Reintentar» (A-09): lo pendiente y, con su identificador original, los errores recuperables. */
  const retryNow = useCallback(() => {
    if (!store) return;
    void retryRecoverable(store, owner, sessionId).then(() => wake());
  }, [owner, sessionId, store, wake]);

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

  const canRetry = queue.some(
    (e) => e.status === 'queued' || (e.status === 'error' && isRecoverableError(e.error?.code)),
  );

  return {
    canRetry,
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
