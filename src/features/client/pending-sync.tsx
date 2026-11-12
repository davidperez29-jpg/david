'use client';

import { CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { openLocalStore } from './player/local-store';
import { flushSession } from './player/sync-engine';

/**
 * Fuera del reproductor (Hoy, Semana, Progreso y el detalle): envía lo que haya quedado
 * pendiente en el móvil (al abrir, al recuperar la conexión, al volver a la pestaña y con
 * «Reintentar») y, cuando el servidor lo confirma, actualiza la pantalla. Si no hay nada
 * pendiente, no muestra nada.
 */
export function PendingSync() {
  const router = useRouter();
  const [pending, setPending] = useState<{
    total: number;
    errors: number;
    sessionId: string;
  } | null>(null);

  const run = useCallback(
    async (retry = false) => {
      const store = await openLocalStore();
      const all = await store.listAll();
      let confirmed = false;
      for (const sessionId of [...new Set(all.map((e) => e.sessionId))]) {
        if (retry) {
          for (const entry of await store.list(sessionId)) {
            if (entry.status === 'queued') await store.put({ ...entry, nextAttemptAt: 0 });
          }
        }
        await flushSession(store, sessionId, { onState: () => (confirmed = true) });
      }
      const after = await store.listAll();
      setPending(
        after.length > 0
          ? {
              total: after.length,
              errors: after.filter((e) => e.status === 'error').length,
              sessionId: after[0]!.sessionId,
            }
          : null,
      );
      if (confirmed) router.refresh();
    },
    [router],
  );

  useEffect(() => {
    // Sincroniza con un sistema externo (el servidor): el estado cambia cuando llega su respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    const onOnline = () => void run();
    const onVisible = () => document.visibilityState === 'visible' && void run();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => void run(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [run]);

  if (!pending) return null;
  return (
    <p
      role="status"
      className={
        pending.errors > 0
          ? 'mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-coral-100 p-3 text-sm font-semibold text-coral-700'
          : 'mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-sky-100/70 p-3 text-sm font-semibold text-sky-700'
      }
    >
      {pending.errors > 0 ? (
        <TriangleAlert aria-hidden className="size-4" />
      ) : (
        <CloudUpload aria-hidden className="size-4" />
      )}
      {pending.total} {pending.total === 1 ? 'registro pendiente' : 'registros pendientes'} de envío
      en este móvil
      {pending.errors > 0 ? (
        <Link href={`/cliente/sesion/${pending.sessionId}/entrenar`} className="underline">
          Revisar
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void run(true)}
          className="inline-flex items-center gap-1 underline"
        >
          <RefreshCw aria-hidden className="size-3.5" /> Reintentar
        </button>
      )}
    </p>
  );
}
