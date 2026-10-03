'use client';

import { LABELS } from '@/lib/labels';
import type { Catalog, EquipmentDraft } from './types';

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

export function EquipmentPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: EquipmentDraft[];
  onChange: (v: EquipmentDraft[]) => void;
}) {
  const byCat = new Map<string, Catalog['equipment']>();
  for (const e of catalog.equipment) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e]);
  const get = (id: string) => value.find((v) => v.equipmentId === id);
  const toggle = (id: string) =>
    onChange(
      get(id)
        ? value.filter((v) => v.equipmentId !== id)
        : [...value, { equipmentId: id, location: 'gym' }],
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...byCat.entries()].map(([cat, items]) => (
        <fieldset key={cat}>
          <legend className="mb-1 text-xs font-semibold text-muted uppercase">
            {CATEGORY[cat] ?? cat}
          </legend>
          <ul className="flex flex-col gap-1">
            {items.map((e) => {
              const sel = get(e.id);
              return (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    id={`eq-${e.id}`}
                    type="checkbox"
                    checked={!!sel}
                    onChange={() => toggle(e.id)}
                  />
                  <label htmlFor={`eq-${e.id}`} className="flex-1">
                    {e.name}
                  </label>
                  {sel ? (
                    <select
                      aria-label={`Lugar de ${e.name}`}
                      className="rounded border border-border bg-bg px-1 text-xs"
                      value={sel.location}
                      onChange={(ev) =>
                        onChange(
                          value.map((v) =>
                            v.equipmentId === e.id
                              ? { ...v, location: ev.target.value as EquipmentDraft['location'] }
                              : v,
                          ),
                        )
                      }
                    >
                      {Object.entries(LABELS.equipmentLocation).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
