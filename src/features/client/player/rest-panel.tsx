'use client';

import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatClock } from '@/domain/format';
import { useArmed } from './use-armed';
import { type RestTimer } from './use-rest-timer';

/**
 * Descanso (B5): cuenta atrás calculada con la hora de fin (sobrevive a recargar y a bloquear el
 * móvil), −15 s y +15 s, pausar, reiniciar y saltar; «A continuación…». Al terminar se anuncia una
 * sola vez (la región `aria-live` solo cambia entonces).
 */
export function RestPanel({ timer }: { timer: RestTimer }) {
  // Recién aparecido, no acepta toques: el segundo de un doble toque en «Serie hecha» caería aquí.
  const armed = useArmed();
  const guard = (action: () => void) => () => {
    if (armed) action();
  };
  const lock = armed ? undefined : true;
  const rest = timer.rest;
  if (!rest) return null;
  const paused = rest.endsAt === null;
  const seconds = Math.ceil(timer.remainingMs / 1000);
  const progress = rest.totalMs > 0 ? 1 - timer.remainingMs / rest.totalMs : 1;
  const ring = 2 * Math.PI * 52;

  return (
    <section
      aria-labelledby="descanso-titulo"
      className="rounded-3xl bg-ink-900 p-5 text-cream-50 shadow-lift"
    >
      <h3
        id="descanso-titulo"
        className="text-center text-sm font-bold tracking-wide text-sun-300 uppercase"
      >
        {timer.finished ? '¡Descanso terminado!' : paused ? 'Descanso en pausa' : 'Descanso'}
      </h3>
      <div className="relative mx-auto mt-3 size-36">
        <svg viewBox="0 0 120 120" className="size-36 -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-white/15" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-sun-400 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
            strokeDasharray={ring}
            strokeDashoffset={ring * Math.min(1, Math.max(0, progress))}
          />
        </svg>
        <p
          role="timer"
          aria-label={`Descanso: quedan ${seconds} segundos`}
          className="absolute inset-0 grid place-items-center font-display text-4xl font-extrabold tabular-nums"
        >
          {formatClock(timer.remainingMs / 1000)}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {timer.finished ? 'Descanso terminado. Siguiente serie.' : ''}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          aria-disabled={lock}
          onClick={guard(() => timer.adjust(-15))}
          className="h-12 rounded-2xl bg-white/10 font-semibold hover:bg-white/20"
        >
          −15 s
        </button>
        <button
          type="button"
          aria-disabled={lock}
          onClick={guard(paused ? timer.resume : timer.pause)}
          disabled={timer.finished}
          className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-semibold hover:bg-white/20 disabled:opacity-40"
        >
          {paused ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )}
          {paused ? 'Seguir' : 'Pausar'}
        </button>
        <button
          type="button"
          aria-disabled={lock}
          onClick={guard(() => timer.adjust(15))}
          className="h-12 rounded-2xl bg-white/10 font-semibold hover:bg-white/20"
        >
          +15 s
        </button>
        <button
          type="button"
          aria-disabled={lock}
          onClick={guard(timer.restart)}
          className="col-span-1 flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-semibold hover:bg-white/20"
        >
          <RotateCcw aria-hidden className="size-4" /> Reiniciar
        </button>
        <button
          type="button"
          aria-disabled={lock}
          onClick={guard(timer.skip)}
          className="col-span-2 flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-sun-400 font-bold text-ink-900 hover:bg-sun-300"
        >
          <SkipForward aria-hidden className="size-4" />{' '}
          {timer.finished ? 'Continuar' : 'Saltar descanso'}
        </button>
      </div>
      {rest.next ? (
        <p className="mt-4 text-sm text-cream-200">
          <span className="font-bold text-cream-50">A continuación: </span>
          {rest.next}
        </p>
      ) : null}
    </section>
  );
}
