'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/field';
import { api } from '@/lib/api-client';

export interface SearchHit {
  id: string;
  name: string;
}

export function ExercisePicker({
  excludeId,
  onPick,
  ariaLabel = 'Buscar ejercicio',
}: {
  excludeId?: string;
  onPick: (hit: SearchHit) => void;
  ariaLabel?: string;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<{ items: SearchHit[] }>(
        `/exercises?${new URLSearchParams({ q, limit: '8' })}`,
      );
      if (r.ok) setHits(r.data.items.filter((h) => h.id !== excludeId));
    }, 250);
    return () => clearTimeout(t);
  }, [q, excludeId]);
  return (
    <div className="relative">
      <Input
        aria-label={ariaLabel}
        placeholder="Buscar ejercicio…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {hits.length ? (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg shadow"
        >
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface"
                onClick={() => {
                  onPick(h);
                  setQ(h.name);
                  setHits([]);
                }}
              >
                {h.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
