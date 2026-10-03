'use client';

import { useState } from 'react';
import { ExercisePicker } from '@/components/library/exercise-picker';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

export function ResolveLogButton({ logId }: { logId: string }) {
  const a = useApiAction();
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={a.pending}
        onClick={() => void a.run(`/set-logs/${logId}/resolve`, 'POST', {})}
      >
        Marcar revisado
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

/** The trainer decides on a pending substitution: approve (optionally as a standing alternative) or reject. */
export function SubstitutionDecision({
  substitutionId,
  requested,
  alternatives,
}: {
  substitutionId: string;
  requested: { id: string; name: string } | null;
  alternatives: { id: string; name: string }[];
}) {
  const a = useApiAction();
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(requested);
  const [keep, setKeep] = useState(false);
  const options = [...(requested ? [requested] : []), ...alternatives].filter(
    (x, i, arr) => arr.findIndex((y) => y.id === x.id) === i,
  );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Sustituir por:</span>
        {options.map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant={chosen?.id === o.id ? 'primary' : 'secondary'}
            onClick={() => setChosen(o)}
          >
            {o.name}
          </Button>
        ))}
        <span className="w-56">
          <ExercisePicker
            ariaLabel="Elegir otro ejercicio"
            onPick={(h) => setChosen({ id: h.id, name: h.name })}
          />
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Añadirlo a las alternativas aprobadas de este ejercicio
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!chosen || a.pending}
          onClick={() =>
            void a.run(`/substitutions/${substitutionId}/decision`, 'POST', {
              approve: true,
              chosenExerciseId: chosen?.id,
              addAsAlternative: keep,
            })
          }
        >
          Aprobar {chosen ? chosen.name : ''}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={a.pending}
          onClick={() =>
            void a.run(`/substitutions/${substitutionId}/decision`, 'POST', { approve: false })
          }
        >
          Rechazar
        </Button>
      </div>
      <FormError error={a.error} />
    </div>
  );
}
