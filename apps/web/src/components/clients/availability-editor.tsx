'use client';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { LABELS } from '@/lib/labels';
import type { SlotDraft } from './types';

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: SlotDraft[];
  onChange: (v: SlotDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<SlotDraft>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="flex flex-col gap-2">
      {value.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Día"
            className="w-36"
            value={String(s.weekday)}
            onChange={(e) => update(i, { weekday: Number(e.target.value) })}
            options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
              value: String(d),
              label: LABELS.weekday[d]!,
            }))}
          />
          <Input
            type="time"
            aria-label="Desde"
            className="w-32"
            value={s.startTime}
            onChange={(e) => update(i, { startTime: e.target.value })}
          />
          <span className="text-sm text-muted">a</span>
          <Input
            type="time"
            aria-label="Hasta"
            className="w-32"
            value={s.endTime}
            onChange={(e) => update(i, { endTime: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Quitar franja"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...value, { weekday: 1, startTime: '', endTime: '' }])}
        >
          Añadir día
        </Button>
      </div>
    </div>
  );
}
