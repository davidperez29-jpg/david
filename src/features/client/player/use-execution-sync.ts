'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ClientCommand,
  type CommandResponse,
  type ExecutionStateVM,
} from '@/contracts/execution';
import { type LocalStore, openLocalStore, type QueuedCommand } from './local-store';

/**
 * Sincronización de la ejecución (V1_SPEC §5.7, docs/EXECUTION.md):
 * 1. Cada comando se guarda en el dispositivo ANTES de enviarse.
 * 2. Se envían en orden, de uno en uno, con su identificador estable (los reintentos no duplican).
 * 3. Solo se borra del dispositivo cuando el servidor lo confirma (200); el estado que devuelve
 *    el servidor manda sobre lo local.
 * 4. Un fallo de red o del servidor (5xx) se reintenta solo: a los 2, 4, 8, 16 y 30 s, al
 *    recuperar la conexión, al volver a la pestaña y con «Reintentar».
 * 5. Un rechazo (4xx) no se descarta en silencio: queda visible con su motivo.
 */
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];
const TIMEOUT_MS = 15_000;

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
  retryNow: () => void;
  discard: (commandId: string) => Promise<void>;
  dismissNotice: () => void;
}

const api = (sessionId: string, path: 'comandos' | 'estado') =>
  `/api/cliente/sesiones/${encodeURIComponent(sessionId)}/${path}`;

export function useExecutionSync(sessionId: string, initial: ExecutionStateVM): ExecutionSync {
  const [store, setStore] = useState<LocalStore | null>(null);
  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [serverState, setServerState] = useState(initial);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const order = useRef(0);

  const reload = useCallback(
    async (s: LocalStore) => setQueue(await s.list(sessionId)),
    [sessionId],
  );

  /** Pide al servidor el estado confirmado (al volver a la pestaña o recuperar la conexión). */
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(api(sessionId, 'estado'), { cache: 'no-store' });
      if (response.ok) {
        const body = (await response.json()) as { ok: true; state: ExecutionStateVM };
        setServerState(body.state);
      }
    } catch {
      // Sin conexión: se usará lo que ya hay.
    }
  }, [sessionId]);

  const flush = useCallback(async () => {
    const s = store;
    if (!s || flushing.current) return;
    flushing.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      for (;;) {
        const pending = (await s.list(sessionId)).filter((e) => e.status !== 'error');
        const next = pending[0];
        if (!next) break;
        const wait = next.nextAttemptAt - Date.now();
        if (wait > 0) {
          timer.current = setTimeout(() => void flush(), wait);
          break;
        }
        await s.put({ ...next, status: 'sending' });
        await reload(s);

        let response: Response | null = null;
        try {
          const controller = new AbortController();
          const abort = setTimeout(() => controller.abort(), TIMEOUT_MS);
          response = await fetch(api(sessionId, 'comandos'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(next.command),
            signal: controller.signal,
          });
          clearTimeout(abort);
        } catch {
          response = null;
        }

        if (!response || response.status >= 500 || response.status === 408) {
          // Fallo de red o del servidor: sigue en el dispositivo y se reintenta, en orden.
          const attempts = next.attempts + 1;
          await s.put({
            ...next,
            status: 'queued',
            attempts,
            nextAttemptAt: Date.now() + BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]!,
          });
          await reload(s);
          if (!response) setOnline(navigator.onLine);
          continue;
        }

        const body = (await response.json().catch(() => null)) as CommandResponse | null;
        if (body?.ok) {
          await s.remove(next.commandId);
          setServerState(body.state);
          setOnline(true);
        } else if (body && !body.ok && body.error === 'set_already_logged') {
          // Otro envío (u otro dispositivo) ya registró esa serie: manda lo del servidor.
          await s.remove(next.commandId);
          if (body.state) setServerState(body.state);
          setNotice('Esa serie ya estaba registrada: se muestra la que guardó el servidor.');
        } else {
          await s.put({
            ...next,
            status: 'error',
            error: {
              code: body && !body.ok ? body.error : `http_${response.status}`,
              message:
                body && !body.ok ? body.message : 'El servidor no ha aceptado este registro.',
              ...(body && !body.ok && body.issues ? { issues: body.issues } : {}),
            },
          });
          if (body && !body.ok && body.state) setServerState(body.state);
        }
        await reload(s);
      }
    } finally {
      flushing.current = false;
    }
  }, [reload, sessionId, store]);

  // Abrir el almacén y recuperar lo pendiente (también lo que se estaba enviando al cerrar).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await openLocalStore();
      for (const entry of await s.list(sessionId)) {
        if (entry.status === 'sending')
          await s.put({ ...entry, status: 'queued', nextAttemptAt: 0 });
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
    retryNow,
    discard,
    dismissNotice: () => setNotice(null),
  };
}
