'use client';

import type { BatteryProposalView } from '@tp/application';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { LABELS } from '@/lib/labels';

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));
const nul = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

// ── Catalogue ────────────────────────────────────────────────────────────────

export function NewTestForm() {
  const router = useRouter();
  const a = useApiAction();
  const [f, setF] = useState({
    name: '',
    category: 'strength',
    unit: '',
    valueType: 'number',
    betterDirection: 'higher',
    defaultAttempts: '2',
    aggregation: 'best',
    protocol: '',
  });
  const [sided, setSided] = useState(false);
  const bind = (k: keyof typeof f) => ({
    id: `t-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          '/assessment-tests',
          'POST',
          { ...f, defaultAttempts: Number(f.defaultAttempts), protocol: nul(f.protocol), sided },
          { refresh: false },
        );
        if (r) router.push(`/app/assessments/tests/${r.id}`);
      }}
    >
      <Field label="Nombre" htmlFor="t-name" error={a.fieldError('name')}>
        <Input {...bind('name')} required />
      </Field>
      <Field label="Categoría" htmlFor="t-category">
        <Select {...bind('category')} options={opts(LABELS.testCategory)} />
      </Field>
      <Field label="Unidad" htmlFor="t-unit" error={a.fieldError('unit')}>
        <Input {...bind('unit')} required placeholder="kg, cm, s…" />
      </Field>
      <Field label="Mejor si" htmlFor="t-betterDirection">
        <Select {...bind('betterDirection')} options={opts(LABELS.betterDirection)} />
      </Field>
      <Field label="Intentos" htmlFor="t-defaultAttempts">
        <Input {...bind('defaultAttempts')} inputMode="numeric" />
      </Field>
      <Field label="Valor que se usa" htmlFor="t-aggregation">
        <Select
          {...bind('aggregation')}
          options={[
            { value: 'best', label: 'Mejor intento' },
            { value: 'mean', label: 'Media' },
            { value: 'mean_of_best_n', label: 'Media de los 2 mejores' },
            { value: 'last', label: 'Último intento' },
            { value: 'median', label: 'Mediana (p. ej., pliegues: mediana de 3)' },
            { value: 'min', label: 'Mínimo' },
            { value: 'max', label: 'Máximo' },
          ]}
        />
      </Field>
      <div className="sm:col-span-3">
        <Field label="Protocolo" htmlFor="t-protocol">
          <Textarea {...bind('protocol')} rows={3} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sided} onChange={(e) => setSided(e.target.checked)} />
        Se registra por lados (izquierdo y derecho)
      </label>
      <div className="sm:col-span-3">
        <FormError error={a.error} />
        <Button disabled={a.pending}>Crear test</Button>
      </div>
    </form>
  );
}

export function LocalReliabilityForm({ testId, unit }: { testId: string; unit: string }) {
  const a = useApiAction();
  const [f, setF] = useState({
    measurementMethod: '',
    icc: '',
    cvPercent: '',
    sem: '',
    mdc95: '',
    notes: '',
  });
  const bind = (k: keyof typeof f) => ({
    id: `r-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-2 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run(`/assessment-tests/${testId}/reliability`, 'POST', {
          measurementMethod: nul(f.measurementMethod),
          icc: numOrNull(f.icc),
          cvPercent: numOrNull(f.cvPercent),
          sem: numOrNull(f.sem),
          semUnit: unit,
          mdc95: numOrNull(f.mdc95),
          notes: nul(f.notes),
        });
        if (r)
          setF({ measurementMethod: '', icc: '', cvPercent: '', sem: '', mdc95: '', notes: '' });
      }}
    >
      <Field label="Método/dispositivo" htmlFor="r-measurementMethod">
        <Input {...bind('measurementMethod')} />
      </Field>
      <Field label="ICC" htmlFor="r-icc">
        <Input {...bind('icc')} inputMode="decimal" />
      </Field>
      <Field label="CV (%)" htmlFor="r-cvPercent">
        <Input {...bind('cvPercent')} inputMode="decimal" />
      </Field>
      <Field label={`SEM (${unit})`} htmlFor="r-sem" error={a.fieldError('sem')}>
        <Input {...bind('sem')} inputMode="decimal" />
      </Field>
      <Field label={`MDC95 (${unit})`} htmlFor="r-mdc95">
        <Input {...bind('mdc95')} inputMode="decimal" />
      </Field>
      <div className="sm:col-span-5">
        <Field label="Notas (n, intervalo entre mediciones, evaluador…)" htmlFor="r-notes">
          <Input {...bind('notes')} />
        </Field>
      </div>
      <div className="sm:col-span-5">
        <FormError error={a.error} />
        <Button variant="secondary" disabled={a.pending}>
          Guardar fiabilidad
        </Button>
      </div>
    </form>
  );
}

export function DeleteReliabilityButton({ id }: { id: string }) {
  const a = useApiAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={a.pending}
      onClick={() => void a.run(`/assessment-reliability/${id}`, 'DELETE')}
    >
      Eliminar
    </Button>
  );
}

/** The centre's own reference values (imported) can be removed; the platform's cannot. */
export function DeleteReferenceButton({ id }: { id: string }) {
  const a = useApiAction();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={a.pending}
        onClick={() => void a.run(`/assessment-references/${id}`, 'DELETE')}
      >
        Eliminar
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

// ── Client assessments ───────────────────────────────────────────────────────

export function NewAssessmentForm({
  clientId,
  proposal,
  batteries,
  tests,
}: {
  clientId: string;
  proposal: BatteryProposalView;
  batteries: { id: string; name: string; testIds: Record<string, string> }[];
  tests: { id: string; name: string; category: string }[];
}) {
  const router = useRouter();
  const a = useApiAction();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [batteryId, setBatteryId] = useState(proposal.batteryId ?? '');
  const initial = proposal.tests.filter((t) => t.included && t.testId).map((t) => t.testId!);
  const [selected, setSelected] = useState<string[]>(initial);
  const [context, setContext] = useState('');
  const chooseBattery = (id: string) => {
    setBatteryId(id);
    const b = batteries.find((x) => x.id === id);
    if (b) {
      const excluded = new Set(
        proposal.tests.filter((t) => !t.included && t.testId).map((t) => t.testId!),
      );
      setSelected(Object.values(b.testIds).filter((t) => !excluded.has(t)));
    }
  };
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          `/clients/${clientId}/assessments`,
          'POST',
          {
            assessedOn: date,
            batteryId: batteryId || null,
            testIds: selected,
            context: nul(context),
          },
          { refresh: false },
        );
        if (r) router.push(`/app/clients/${clientId}/assessments/${r.id}`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Fecha" htmlFor="as-date">
          <Input
            id="as-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Batería" htmlFor="as-battery">
          <Select
            id="as-battery"
            value={batteryId}
            onChange={(e) => chooseBattery(e.target.value)}
            placeholder="Sin batería (tests sueltos)"
            options={batteries.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Field label="Contexto" htmlFor="as-context">
          <Input
            id="as-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Inicial, reevaluación…"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Tests ({selected.length})</legend>
        <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
          {tests.map((t) => {
            const excluded = proposal.tests.find((p) => p.testId === t.id && !p.included);
            return (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  id={`as-t-${t.id}`}
                  checked={selected.includes(t.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id),
                    )
                  }
                />
                <label htmlFor={`as-t-${t.id}`}>
                  {t.name}
                  {excluded ? (
                    <span className="block text-xs text-warn">{excluded.reason}</span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <FormError error={a.error} />
      <Button disabled={a.pending || selected.length === 0} className="self-start">
        Crear evaluación
      </Button>
    </form>
  );
}

export function RecordResultForm({
  assessmentId,
  test,
}: {
  assessmentId: string;
  test: { id: string; name: string; unit: string; sided: boolean; defaultAttempts: number };
}) {
  const a = useApiAction();
  const blank = Array.from({ length: test.defaultAttempts }, () => '');
  const [side, setSide] = useState(test.sided ? 'left' : 'both');
  const [attempts, setAttempts] = useState<string[]>(blank);
  const [method, setMethod] = useState('');
  const [valid, setValid] = useState(true);
  const [notes, setNotes] = useState('');
  return (
    <form
      className="flex flex-col gap-2"
      aria-label={`Registrar ${test.name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        const values = attempts.map((x) => numOrNull(x)).filter((x): x is number => x != null);
        const r = await a.run(`/assessments/${assessmentId}/results`, 'POST', {
          testId: test.id,
          side,
          attempts: values,
          measurementMethod: nul(method),
          valid,
          notes: nul(notes),
        });
        if (r) setAttempts(blank);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        {test.sided ? (
          <Field label="Lado" htmlFor={`side-${test.id}`}>
            <Select
              id={`side-${test.id}`}
              value={side}
              onChange={(e) => setSide(e.target.value)}
              options={[
                { value: 'left', label: 'Izquierdo' },
                { value: 'right', label: 'Derecho' },
              ]}
            />
          </Field>
        ) : null}
        {attempts.map((v, i) => (
          <Field key={i} label={`Intento ${i + 1} (${test.unit})`} htmlFor={`att-${test.id}-${i}`}>
            <Input
              id={`att-${test.id}-${i}`}
              inputMode="decimal"
              value={v}
              className="w-28"
              onChange={(e) => setAttempts(attempts.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </Field>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAttempts([...attempts, ''])}
          disabled={attempts.length >= 20}
        >
          + intento
        </Button>
        <Field label="Método/dispositivo" htmlFor={`method-${test.id}`}>
          <Input
            id={`method-${test.id}`}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-44"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!valid} onChange={(e) => setValid(!e.target.checked)} />
          Intento no válido (test detenido o mal ejecutado)
        </label>
        <Input
          aria-label={`Notas de ${test.name}`}
          placeholder="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="max-w-sm"
        />
        <Button size="sm" disabled={a.pending || attempts.every((x) => x.trim() === '')}>
          Guardar
        </Button>
      </div>
      <FormError error={a.error} />
    </form>
  );
}

export function DeleteResultButton({ id }: { id: string }) {
  const a = useApiAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={a.pending}
      onClick={() => void a.run(`/assessment-results/${id}`, 'DELETE')}
    >
      Borrar
    </Button>
  );
}

export function AssessmentStatusActions({ id, status }: { id: string; status: string }) {
  const a = useApiAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>
        {LABELS.assessmentStatus[status as keyof typeof LABELS.assessmentStatus] ?? status}
      </Badge>
      {status !== 'completed' ? (
        <Button
          size="sm"
          disabled={a.pending}
          onClick={() => void a.run(`/assessments/${id}/status`, 'POST', { status: 'completed' })}
        >
          Marcar como completada
        </Button>
      ) : null}
      {status !== 'cancelled' && status !== 'completed' ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={a.pending}
          onClick={() => void a.run(`/assessments/${id}/status`, 'POST', { status: 'cancelled' })}
        >
          Cancelar
        </Button>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}
