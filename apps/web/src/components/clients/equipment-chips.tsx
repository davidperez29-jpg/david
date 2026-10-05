'use client';

import type { Catalog } from './types';

const CATEGORY: Record<string, string> = {
  free_weights: 'Peso libre',
  machines: 'Máquinas',
  bodyweight: 'Peso corporal',
  accommodating: 'Resistencias acomodadas',
  plyometrics: 'Pliometría',
  speed: 'Velocidad',
  eccentric: 'Excéntrico',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  measurement: 'Medición',
};

/** Quick starting sets; the trainer adjusts them chip by chip. */
const PRESETS: { label: string; slugs: string[] }[] = [
  {
    label: 'Gimnasio completo',
    slugs: [
      'barbell',
      'plates',
      'squat_rack',
      'bench',
      'dumbbells',
      'kettlebells',
      'landmine',
      'cable_station',
      'leg_press',
      'machines_other',
      'pull_up_bar',
      'resistance_bands',
      'medicine_ball',
      'plyo_box',
      'step',
      'mat',
      'foam_roller',
      'treadmill',
      'bike_erg',
      'rower',
      'cones',
    ],
  },
  { label: 'Casa básica', slugs: ['dumbbells', 'resistance_bands', 'mat'] },
  { label: 'Sin material', slugs: [] },
];

/**
 * Equipment as removable chips plus an «Añadir material» selector (docs/UX_FLOW.md §4). Works on
 * equipment ids; where it is available (home, gym or both) is decided by the caller.
 */
export function EquipmentChips({
  catalog,
  value,
  onChange,
  id = 'equipment-add',
}: {
  catalog: Catalog;
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
}) {
  const byId = new Map(catalog.equipment.map((e) => [e.id, e]));
  const free = catalog.equipment.filter((e) => !value.includes(e.id));
  const groups = new Map<string, Catalog['equipment']>();
  for (const e of free) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  const preset = (slugs: string[]) =>
    onChange(catalog.equipment.filter((e) => slugs.includes(e.slug)).map((e) => e.id));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" aria-live="polite">
        {value.length === 0 ? (
          <span className="text-sm text-muted">Sin material (peso corporal)</span>
        ) : (
          value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-1 pl-3 text-sm"
            >
              {byId.get(v)?.name ?? v}
              <button
                type="button"
                aria-label={`Quitar ${byId.get(v)?.name ?? 'material'}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text"
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          aria-label="Añadir material"
          className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        >
          <option value="">+ Añadir material…</option>
          {[...groups.entries()].map(([cat, items]) => (
            <optgroup key={cat} label={CATEGORY[cat] ?? cat}>
              {items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="h-10 rounded-md border border-border px-3 text-sm text-muted hover:text-text"
            onClick={() => preset(p.slugs)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
