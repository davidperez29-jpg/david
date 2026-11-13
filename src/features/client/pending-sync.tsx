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
 *
 * Solo envía y muestra lo de `clientId`, la persona que tiene abierta la app (A-08). Si en este
 * dispositivo hay registros pendientes de otra persona, solo dice que existen (sin contenido) y
 * que se enviarán cuando esa persona vuelva a entrar: nunca se envían con otra identidad.
 */
export function PendingSync({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    total: number;
    errors: number;
    sessionId: string;
  } | null>(null);
  const [foreign, setForeign] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** El último `run`, para reprogramarlo desde un temporizador sin referenciarse a sí mismo. */
  const runRef = useRef<(wake?: boolean) => Promise<void>>(async () => undefined);

  /** `wake`: abrir, recuperar la conexión, volver a la pestaña o «Reintentar» (sin esperar). */
  const run = useCallback(
    async (wake = false) => {
      if (timer.current) clearTimeout(timer.current);
      const store = await openLocalStore();
      const all = await store.listAll(clientId);
      let confirmed = false;
      let waitMs: number | null = null;
      for (const sessionId of [...new Set(all.map((e) => e.sessionId))]) {
        if (wake) await resetBackoff(store, clientId, sessionId);
        const result = await flushSession(store, clientId, sessionId, {
          onState: () => (confirmed = true),
        });
        if (result.waitMs !== null) waitMs = Math.min(waitMs ?? result.waitMs, result.waitMs);
      }
      if (waitMs !== null) timer.current = setTimeout(() => void runRef.current(), waitMs);
      const after = await store.listAll(clientId);
      setForeign(await store.countForeign(clientId));
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
    [clientId, router],
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

  const foreignNotice =
    foreign > 0 ? (
      <p
        role="note"
        className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-cream-200 p-3 text-sm text-ink-700"
      >
        <CloudUpload aria-hidden className="size-4" />
        Hay {foreign === 1 ? 'un registro pendiente' : `${foreign} registros pendientes`} de otra
        persona en este dispositivo. Se enviarán cuando esa persona vuelva a entrar.
      </p>
    ) : null;

  if (!pending) return foreignNotice;
  return (
    <>
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
        {pending.total} {pending.total === 1 ? 'registro pendiente' : 'registros pendientes'} de
        envío en este móvil
        {pending.errors > 0 ? (
          <Link
            href={`/cliente/sesion/${pending.sessionId}/entrenar`}
            className="inline-flex min-h-11 items-center underline"
          >
            Revisar
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void run(true)}
            className="inline-flex min-h-11 items-center gap-1 underline"
          >
            <RefreshCw aria-hidden className="size-3.5" /> Reintentar
          </button>
        )}
      </p>
      {foreignNotice}
    </>
  );
}
