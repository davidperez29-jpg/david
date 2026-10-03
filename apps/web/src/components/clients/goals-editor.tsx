'use client';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { LABELS } from '@/lib/labels';
import type { Catalog, GoalDraft } from './types';

const SPORT_FAMILIES = new Set(['sport_performance', 'endurance']);

/** Primary goal + secondary goals with relative weights (§9 del encargo). */
export function GoalsEditor({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: GoalDraft[];
  onChange: (v: GoalDraft[]) => void;
}) {
  const used = new Set(value.map((g) => g.goalId));
  const update = (i: number, patch: Partial<GoalDraft>) =>
    onChange(value.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const setPrimary = (i: number) =>
    onChange(
      value.map((g, j) => ({
        ...g,
        isPrimary: j === i,
        priorityWeight:
          j === i
            ? Math.max(g.priorityWeight, ...value.map((x) => x.priorityWeight))
            : g.priorityWeight,
      })),
    );
  const add = () => {
    const free = catalog.goals.find((g) => !used.has(g.id));
    if (!free) return;
    onChange([
      ...value,
      {
        goalId: free.id,
        isPrimary: value.length === 0,
        priorityWeight: value.length === 0 ? 1 : 0.5,
        targetDate: '',
        sportId: '',
        competitiveLevel: '',
      },
    ]);
  };
  return (
    <div className="flex flex-col gap-3">
      {value.map((g, i) => {
        const goal = catalog.goals.find((x) => x.id === g.goalId);
        const needsSport = goal ? SPORT_FAMILIES.has(goal.family) : false;
        return (
          <fieldset
            key={i}
            className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-12"
          >
            <legend className="sr-only">Objetivo {i + 1}</legend>
            <div className="md:col-span-4">
              <Select
                aria-label="Objetivo"
                value={g.goalId}
                onChange={(e) => update(i, { goalId: e.target.value })}
                options={catalog.goals
                  .filter((x) => x.id === g.goalId || !used.has(x.id))
                  .map((x) => ({ value: x.id, label: x.name }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="radio"
                name="primary"
                checked={g.isPrimary}
                onChange={() => setPrimary(i)}
              />{' '}
              Principal
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              Prioridad
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={g.priorityWeight}
                aria-label="Prioridad"
                onChange={(e) => update(i, { priorityWeight: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 tabular-nums">{g.priorityWeight.toFixed(1)}</span>
            </label>
            <div className="md:col-span-2">
              <Input
                type="date"
                aria-label="Fecha objetivo"
                value={g.targetDate}
                onChange={(e) => update(i, { targetDate: e.target.value })}
              />
            </div>
            <div className="md:col-span-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Quitar objetivo"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
            {needsSport ? (
              <>
                <div className="md:col-span-4">
                  <Select
                    aria-label="Deporte"
                    placeholder="Deporte"
                    value={g.sportId}
                    onChange={(e) => update(i, { sportId: e.target.value })}
                    options={catalog.sports.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="md:col-span-4">
                  <Select
                    aria-label="Nivel competitivo"
                    placeholder="Nivel competitivo"
                    value={g.competitiveLevel}
                    onChange={(e) => update(i, { competitiveLevel: e.target.value })}
                    options={Object.entries(LABELS.competitiveLevel).map(([v, l]) => ({
                      value: v,
                      label: l,
                    }))}
                  />
                </div>
              </>
            ) : null}
            {goal?.description ? (
              <p className="text-xs text-muted md:col-span-12">{goal.description}</p>
            ) : null}
          </fieldset>
        );
      })}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={add}
          disabled={used.size >= catalog.goals.length || value.length >= 10}
        >
          Añadir objetivo
        </Button>
      </div>
    </div>
  );
}
