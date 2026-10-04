'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

/** Move every client of one trainer to another (holidays, departure, rebalancing). Audited. */
export function TransferClientsForm({
  trainers,
}: {
  trainers: { trainerId: string; name: string; active: boolean; clients: number }[];
}) {
  const { run, pending, error, fieldError } = useApiAction();
  const withClients = trainers.filter((t) => t.clients > 0);
  const [from, setFrom] = useState(withClients[0]?.trainerId ?? '');
  const [to, setTo] = useState(
    trainers.find((t) => t.active && t.trainerId !== from)?.trainerId ?? '',
  );
  const [done, setDone] = useState<string | null>(null);
  if (!withClients.length) return null;
  return (
    <form
      className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run<{ moved: number; alreadyAssigned: number }>(
          '/trainers/transfer',
          'POST',
          {
            fromTrainerId: from,
            toTrainerId: to,
          },
        );
        if (r)
          setDone(
            `${r.moved} clientes traspasados${r.alreadyAssigned ? ` (${r.alreadyAssigned} ya estaban con el entrenador de destino)` : ''}.`,
          );
      }}
    >
      <Field label="Traspasar todos los clientes de" htmlFor="tr-from">
        <Select
          id="tr-from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          options={withClients.map((t) => ({
            value: t.trainerId,
            label: `${t.name} (${t.clients})`,
          }))}
        />
      </Field>
      <Field label="A" htmlFor="tr-to" error={fieldError('toTrainerId')}>
        <Select
          id="tr-to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          options={trainers
            .filter((t) => t.active && t.trainerId !== from)
            .map((t) => ({ value: t.trainerId, label: t.name }))}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending || !to}>
        Traspasar
      </Button>
      <div className="md:col-span-3">
        <FormError error={error} />
        {done ? (
          <p role="status" className="text-sm text-ok">
            {done}
          </p>
        ) : null}
      </div>
    </form>
  );
}
