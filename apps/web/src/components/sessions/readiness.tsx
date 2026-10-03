'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';

type Key = 'energy' | 'sleepQuality' | 'soreness';
const ITEMS: { key: Key; label: string; low: string; high: string }[] = [
  { key: 'energy', label: 'Energía', low: 'Muy baja', high: 'Muy alta' },
  { key: 'sleepQuality', label: 'Sueño', low: 'Muy malo', high: 'Muy bueno' },
  { key: 'soreness', label: 'Agujetas', low: 'Ninguna', high: 'Muchas' },
];
const STEPS = [0, 2, 4, 6, 8, 10];

/**
 * Daily readiness (self-reported, 0–10). Context for the trainer, never a diagnosis. Optional:
 * the client can skip it.
 */
export function ReadinessCard({
  clientId,
  day,
  initial,
}: {
  clientId: string;
  day: string;
  initial: Partial<Record<Key, number | null>> | null;
}) {
  const [v, setV] = useState<Partial<Record<Key, number | null>>>(initial ?? {});
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    initial ? 'saved' : 'idle',
  );
  async function save(next: typeof v) {
    setV(next);
    setState('saving');
    const r = await api(`/clients/${clientId}/readiness`, {
      method: 'PUT',
      body: { recordedOn: day, ...next },
    });
    setState(r.ok ? 'saved' : 'error');
  }
  return (
    <section className="rounded-xl border border-border p-5" aria-label="¿Cómo llegas hoy?">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          ¿Cómo llegas hoy?
        </h2>
        <span className="text-xs text-muted" role="status">
          {state === 'saved' ? 'Guardado' : state === 'error' ? 'Sin conexión' : ''}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {ITEMS.map((it) => (
          <fieldset key={it.key}>
            <legend className="text-sm font-medium">{it.label}</legend>
            <div className="mt-1 grid grid-cols-6 gap-1">
              {STEPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={v[it.key] === n}
                  aria-label={`${it.label}: ${n} de 10`}
                  onClick={() => void save({ ...v, [it.key]: v[it.key] === n ? null : n })}
                  className={`h-10 rounded-md border text-sm ${v[it.key] === n ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[11px] text-muted">
              <span>{it.low}</span>
              <span>{it.high}</span>
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
