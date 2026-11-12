'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type LocalStore } from './local-store';

/**
 * Descanso (B5): el tiempo restante se calcula con la HORA DE FIN, guardada en el dispositivo.
 * No hay un contador que se pierda al cambiar de pantalla, bloquear el móvil o recargar.
 */
export interface RestState {
  /** Instante (ms) en que termina, si está corriendo. */
  endsAt: number | null;
  /** Lo que quedaba al pausarlo, si está en pausa. */
  pausedRemainingMs: number | null;
  totalMs: number;
  /** «A continuación…». */
  next: string | null;
}

export interface RestTimer {
  rest: RestState | null;
  remainingMs: number;
  finished: boolean;
  start: (seconds: number, next: string | null) => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  adjust: (deltaSeconds: number) => void;
  skip: () => void;
}

const remainingOf = (rest: RestState | null, now: number) =>
  !rest ? 0 : rest.endsAt !== null ? Math.max(0, rest.endsAt - now) : (rest.pausedRemainingMs ?? 0);

export function useRestTimer(store: LocalStore | null, key: string): RestTimer {
  const [rest, setRest] = useState<RestState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const announced = useRef(false);

  // Recuperar el descanso en curso tras una recarga.
  useEffect(() => {
    if (!store) return;
    void store.getUi<RestState>(key).then((saved) => {
      if (saved) setRest(saved);
    });
  }, [key, store]);

  const save = useCallback(
    (next: RestState | null) => {
      setRest(next);
      setNow(Date.now());
      if (!store) return;
      void (next ? store.setUi(key, next) : store.deleteUi(key));
    },
    [key, store],
  );

  // Refresco de la pantalla (el cálculo no depende de él).
  useEffect(() => {
    if (!rest || rest.endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const remainingMs = remainingOf(rest, now);
  const finished = rest !== null && rest.endsAt !== null && remainingMs === 0;

  // Al terminar: vibración (si se puede) una sola vez.
  useEffect(() => {
    if (finished && !announced.current) {
      announced.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(200);
    }
    if (!finished) announced.current = false;
  }, [finished]);

  return {
    rest,
    remainingMs,
    finished,
    start: (seconds, next) =>
      save({
        endsAt: Date.now() + seconds * 1000,
        pausedRemainingMs: null,
        totalMs: seconds * 1000,
        next,
      }),
    pause: () =>
      rest?.endsAt !== null && rest
        ? save({ ...rest, endsAt: null, pausedRemainingMs: remainingOf(rest, Date.now()) })
        : undefined,
    resume: () =>
      rest && rest.endsAt === null
        ? save({
            ...rest,
            endsAt: Date.now() + (rest.pausedRemainingMs ?? 0),
            pausedRemainingMs: null,
          })
        : undefined,
    restart: () =>
      rest
        ? save({ ...rest, endsAt: Date.now() + rest.totalMs, pausedRemainingMs: null })
        : undefined,
    adjust: (delta) => {
      if (!rest) return;
      const nowMs = Date.now();
      const left = Math.max(0, remainingOf(rest, nowMs) + delta * 1000);
      save(
        rest.endsAt !== null
          ? { ...rest, endsAt: nowMs + left, totalMs: Math.max(rest.totalMs + delta * 1000, left) }
          : {
              ...rest,
              pausedRemainingMs: left,
              totalMs: Math.max(rest.totalMs + delta * 1000, left),
            },
      );
    },
    skip: () => save(null),
  };
}
