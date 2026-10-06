'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

/** Log a specific search of the centre (SCIENCE_SYSTEM.md §4). */
export function NewSearchForm({ today }: { today: string }) {
  const a = useApiAction();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
        Registrar una búsqueda
      </Button>
    );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
        const r = await a.run('/science/searches', 'POST', {
          ...f,
          reviewed: f.reviewed ? Number(f.reviewed) : null,
          selectedSourceIds: [],
        });
        if (r) {
          form.reset();
          setOpen(false);
        }
      }}
    >
      <Field label="Tema" htmlFor="s-topic" error={a.fieldError('topic')}>
        <Input id="s-topic" name="topic" required placeholder="lca, hipertrofia, aductores…" />
      </Field>
      <Field label="Objetivo" htmlFor="s-objective" error={a.fieldError('objective')}>
        <Input id="s-objective" name="objective" required />
      </Field>
      <Field label="Población (opcional)" htmlFor="s-population">
        <Input id="s-population" name="population" />
      </Field>
      <Field label="Lesión, fase, método, test o criterio (opcional)" htmlFor="s-criterion">
        <Input id="s-criterion" name="criterion" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Consulta exacta" htmlFor="s-query" error={a.fieldError('query')}>
          <Textarea id="s-query" name="query" required rows={2} />
        </Field>
      </div>
      <Field label="Fecha" htmlFor="s-date">
        <Input
          id="s-date"
          name="searchedOn"
          type="date"
          required
          defaultValue={today}
          max={today}
        />
      </Field>
      <Field label="Resultados revisados (opcional)" htmlFor="s-reviewed">
        <Input id="s-reviewed" name="reviewed" type="number" min={0} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Motivo de la selección (opcional)" htmlFor="s-reason">
          <Textarea id="s-reason" name="reason" rows={2} />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={a.error} />
        <div className="flex gap-2">
          <Button disabled={a.pending}>Guardar búsqueda</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
