'use client';

import type { FormulaListItem } from '@tp/application';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

const num = (v: string) => Number(v.trim().replace(',', '.'));
const show = (x: number) => String(x).replace('.', ',');

/** The centre's constants of one formula (a, b…), saved as its own copy; reset restores. */
export function FormulaConstantsForm({ f }: { f: FormulaListItem }) {
  const a = useApiAction();
  const [vals, setVals] = useState(
    Object.fromEntries(Object.entries(f.constants).map(([k, v]) => [k, show(v)])),
  );
  const changed = Object.entries(vals).some(([k, v]) => num(v) !== f.constants[k]);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label={`Constantes de ${f.name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        const constants = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, num(v)]));
        await a.run(`/derived-formulas/${f.slug}`, 'PUT', {
          constants,
          ...(f.own ? { expectedVersion: f.version } : {}),
        });
      }}
    >
      {Object.keys(vals).map((k) => (
        <Field key={k} label={`Constante ${k}`} htmlFor={`${f.slug}-${k}`}>
          <Input
            id={`${f.slug}-${k}`}
            inputMode="decimal"
            value={vals[k]}
            onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
            className="w-28 text-right tabular-nums"
          />
        </Field>
      ))}
      <Button size="sm" disabled={a.pending || !changed}>
        Guardar constantes
      </Button>
      {f.own && f.platformConstants ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={a.pending}
          onClick={() => a.run(`/derived-formulas/${f.slug}`, 'DELETE')}
        >
          Volver a las de la plataforma
        </Button>
      ) : null}
      <FormError error={a.error} />
    </form>
  );
}

/** A new formula of the centre, in the same small language (no code is ever run). */
export function NewFormulaForm() {
  const a = useApiAction();
  const [f, setF] = useState({
    slug: '',
    name: '',
    unit: '',
    expression: '',
    betterDirection: 'higher',
    definition: '',
  });
  const bind = (k: keyof typeof f) => ({
    id: `nf-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const { slug, ...body } = f;
        const r = await a.run(`/derived-formulas/${slug}`, 'PUT', body);
        if (r) setF({ ...f, slug: '', name: '', expression: '', definition: '' });
      }}
    >
      <Field label="Nombre" htmlFor="nf-name" error={a.fieldError('name')}>
        <Input {...bind('name')} required placeholder="Σ3 pliegues" />
      </Field>
      <Field
        label="Identificador (para usarla en otras fórmulas)"
        htmlFor="nf-slug"
        error={a.fieldError('slug')}
      >
        <Input {...bind('slug')} required pattern="[a-z_][a-z0-9_]+" placeholder="sum_3_pliegues" />
      </Field>
      <Field label="Expresión" htmlFor="nf-expression" error={a.fieldError('expression')}>
        <Input
          {...bind('expression')}
          required
          placeholder="sum(skinfold_triceps, skinfold_subscapular, skinfold_abdominal)"
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Unidad" htmlFor="nf-unit">
          <Input {...bind('unit')} className="w-24" />
        </Field>
        <Field label="Sentido" htmlFor="nf-betterDirection">
          <Select
            {...bind('betterDirection')}
            options={[
              { value: 'higher', label: 'Más es mejor' },
              { value: 'lower', label: 'Menos es mejor' },
              { value: 'target_range', label: 'Descriptivo' },
            ]}
          />
        </Field>
      </div>
      <Field label="Qué significa (se muestra junto al valor)" htmlFor="nf-definition">
        <Textarea {...bind('definition')} rows={2} />
      </Field>
      <div className="flex items-end">
        <Button disabled={a.pending}>Crear fórmula</Button>
      </div>
      <div className="sm:col-span-2">
        <FormError error={a.error} />
        {a.done ? <p className="text-sm text-ok">Fórmula creada.</p> : null}
      </div>
    </form>
  );
}
