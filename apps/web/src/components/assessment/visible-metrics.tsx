'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

/** The trainer picks up to 5 tests the client sees in "Progreso" (§9.5). None = all. */
export function VisibleMetricsPicker({
  clientId,
  tests,
  selected,
}: {
  clientId: string;
  tests: { id: string; name: string }[];
  selected: string[];
}) {
  const a = useApiAction();
  const [ids, setIds] = useState(selected);
  const toggle = (id: string) =>
    setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : x.length < 5 ? [...x, id] : x));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Elige hasta 5 tests para la pantalla «Progreso» del cliente. Sin selección, ve todos.
      </p>
      <ul className="flex flex-wrap gap-2">
        {tests.map((t) => (
          <li key={t.id}>
            <label className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2 text-sm">
              <input type="checkbox" checked={ids.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={a.pending}
          onClick={() =>
            void a.run(`/clients/${clientId}/progress-metrics`, 'PUT', { testIds: ids })
          }
        >
          Guardar selección
        </Button>
        {a.done ? <span className="text-sm text-ok">Guardado</span> : null}
        <span className="text-xs text-muted">{ids.length}/5</span>
      </div>
      <FormError error={a.error} />
    </div>
  );
}
