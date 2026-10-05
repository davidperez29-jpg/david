'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/lib/api-client';

export interface ExerciseHit {
  id: string;
  name: string;
}

/**
 * Exercise search as an accessible combobox: type (accents and case do not matter), arrows to
 * move, Enter to choose, Escape to close. Used by the session table to add or change exercises.
 */
export function ExerciseCombobox({
  label,
  initial = '',
  autoFocus = false,
  placeholder = 'Añadir ejercicio…',
  onPick,
  onCancel,
  className = '',
}: {
  label: string;
  initial?: string;
  autoFocus?: boolean;
  placeholder?: string;
  onPick: (hit: ExerciseHit) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<ExerciseHit[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.select();
  }, [autoFocus]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await api<{ items: ExerciseHit[] }>(
        `/exercises?${new URLSearchParams({ q: term, limit: '8' })}`,
      );
      if (live && r.ok) {
        setHits(r.data.items.map((h) => ({ id: h.id, name: h.name })));
        setActive(0);
        setOpen(true);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const pick = (h: ExerciseHit) => {
    setOpen(false);
    setHits([]);
    setQ('');
    onPick(h);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = hits[active];
      if (open && h) pick(h);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (open && hits.length) setOpen(false);
      else onCancel?.();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
      />
      {open && hits.length ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Ejercicios encontrados"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-md border border-border bg-bg shadow-lg"
        >
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-surface font-medium' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {h.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
