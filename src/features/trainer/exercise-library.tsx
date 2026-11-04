'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  EXERCISE_LEVEL_LABELS,
  type Exercise,
  filterExercises,
  MOVEMENT_PATTERN_LABELS,
  MOVEMENT_PATTERNS,
  type MovementPattern,
} from '@/domain/exercises';
import { PatternPictogram } from '@/features/brand/pictogram';
import { Badge } from '@/ui/badge';
import { cn } from '@/ui/cn';

export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState('');
  const [pattern, setPattern] = useState<MovementPattern | 'all'>('all');
  const patterns = useMemo(
    () => MOVEMENT_PATTERNS.filter((pattern) => exercises.some((e) => e.pattern === pattern)),
    [exercises],
  );
  const visible = filterExercises(exercises, { query, pattern });

  return (
    <div>
      <div className="mb-6 space-y-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Buscar ejercicios</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, patrón o material"
            className="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-ink-900 placeholder:text-ink-500 focus:border-ink-300"
          />
        </label>
        <div
          role="group"
          aria-label="Filtrar por patrón de movimiento"
          className="flex flex-wrap gap-2"
        >
          {(['all', ...patterns] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={pattern === value}
              onClick={() => setPattern(value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                pattern === value
                  ? 'bg-ink-900 text-cream-50'
                  : 'bg-white text-ink-700 ring-1 ring-line hover:ring-ink-300',
              )}
            >
              {value === 'all' ? 'Todos' : MOVEMENT_PATTERN_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-sm text-ink-500" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'ejercicio' : 'ejercicios'}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((exercise) => (
          <li key={exercise.id}>
            <Link
              href={`/entrenador/ejercicios/${exercise.id}`}
              className="flex h-full gap-4 rounded-3xl border border-line/70 bg-white p-4 shadow-soft transition-shadow hover:shadow-lift"
            >
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-cream-100 ring-1 ring-line">
                <PatternPictogram pattern={exercise.pattern} className="size-16" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-ink-900">{exercise.name}</span>
                <span className="mt-0.5 block text-sm text-ink-500">
                  {exercise.equipment.join(' · ')}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="sun">{MOVEMENT_PATTERN_LABELS[exercise.pattern]}</Badge>
                  <Badge tone="outline">{EXERCISE_LEVEL_LABELS[exercise.level]}</Badge>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
