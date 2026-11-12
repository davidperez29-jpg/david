'use client';

import { CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { openLocalStore } from './player/local-store';
import { flushSession, resetBackoff } from './player/sync-engine';

/**
 * Fuera del reproductor (Hoy, Semana, Progreso y el detalle): envía lo que haya quedado
 * pendiente en el móvil (al abrir, al recuperar la conexión, al volver a la pestaña y con
 * «Reintentar», sin esperar; tras un fallo, con la misma espera creciente que el reproductor) y,
 * cuando el servidor lo confirma, actualiza la pantalla. Si no hay nada
 * pendiente, no muestra nada.
 */
export function PendingSync() {
  const router = useRouter();
  const [pending, setPending] = useState<{
    total: number;
    errors: number;
    sessionId: string;
  } | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** El último `run`, para reprogramarlo desde un temporizador sin referenciarse a sí mismo. */
  const runRef = useRef<(wake?: boolean) => Promise<void>>(async () => undefined);

  /** `wake`: abrir, recuperar la conexión, volver a la pestaña o «Reintentar» (sin esperar). */
  const run = useCallback(
    async (wake = false) => {
      if (timer.current) clearTimeout(timer.current);
      const store = await openLocalStore();
      const all = await store.listAll();
      let confirmed = false;
      let waitMs: number | null = null;
      for (const sessionId of [...new Set(all.map((e) => e.sessionId))]) {
        if (wake) await resetBackoff(store, sessionId);
        const result = await flushSession(store, sessionId, { onState: () => (confirmed = true) });
        if (result.waitMs !== null) waitMs = Math.min(waitMs ?? result.waitMs, result.waitMs);
      }
      if (waitMs !== null) timer.current = setTimeout(() => void runRef.current(), waitMs);
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
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    // Sincroniza con un sistema externo (el servidor): el estado cambia cuando llega su respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(true);
    const onOnline = () => void run(true);
    const onVisible = () => document.visibilityState === 'visible' && void run(true);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => void run(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
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
