'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { type CreateSessionOutcome, type NewSessionFormVM } from '@/contracts/sessions';
import { type Issue } from '@/domain/issues';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';

type Action = (
  previous: CreateSessionOutcome | null,
  form: FormData,
) => Promise<CreateSessionOutcome>;

const FIELDS = ['plannedDate', 'label', 'title', 'focus', 'estimatedMinutes'] as const;

export const fieldClasses = (invalid: boolean) =>
  cn(
    'mt-1 block w-full rounded-2xl border bg-white px-3.5 py-3 text-base text-ink-900 shadow-sm outline-none',
    'focus-visible:ring-2 focus-visible:ring-sun-500',
    invalid ? 'border-coral-500' : 'border-line',
  );

/** A4 · Nueva sesión: fecha, contexto, título, objetivo y duración. Lleva al constructor. */
export function NewSessionForm({ vm, action }: { vm: NewSessionFormVM; action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [date, setDate] = useState(vm.defaultDate);
  const formRef = useRef<HTMLFormElement>(null);
  const issues: Issue[] = state && !state.ok && state.reason === 'invalid' ? state.issues : [];
  const issueFor = (field: string) => issues.find((i) => i.path === field)?.message;

  // El foco va al primer campo con error.
  useEffect(() => {
    if (!state || state.ok || state.reason !== 'invalid') return;
    const first = FIELDS.find((field) => state.issues.some((i) => i.path === field));
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [state]);

  const field = (name: (typeof FIELDS)[number]) => ({
    name,
    id: `campo-${name}`,
    'aria-invalid': issueFor(name) ? true : undefined,
    'aria-describedby': issueFor(name) ? `error-${name}` : undefined,
    className: fieldClasses(!!issueFor(name)),
  });
  const error = (name: (typeof FIELDS)[number]) =>
    issueFor(name) ? (
      <p id={`error-${name}`} className="mt-1 text-sm font-semibold text-coral-700">
        {issueFor(name)}
      </p>
    ) : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="sessionId" value={vm.sessionId} />
      <input type="hidden" name="clientId" value={vm.clientId} />
      {state && !state.ok && state.reason === 'not_found' ? (
        <p
          role="alert"
          className="rounded-2xl bg-coral-100 p-3 text-sm font-semibold text-coral-700"
        >
          No se ha podido crear la sesión. Vuelve a la ficha e inténtalo de nuevo.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="campo-plannedDate" className="font-semibold text-ink-900">
            Fecha prevista
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            {...field('plannedDate')}
          />
          {error('plannedDate')}
          {date && date < vm.today ? (
            <p className="mt-1 text-sm text-sun-800">
              La fecha ya ha pasado: {vm.clientFirstName} la verá como pendiente de otro día.
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="campo-label" className="font-semibold text-ink-900">
            Contexto <span className="font-normal text-ink-500">(opcional)</span>
          </label>
          <input
            type="text"
            maxLength={40}
            list="sugerencias-contexto"
            placeholder="Mañana, Tarde, Club…"
            {...field('label')}
          />
          <datalist id="sugerencias-contexto">
            {vm.labelSuggestions.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
          <p className="mt-1 text-sm text-ink-500">
            Distingue las sesiones del mismo día. Va al final del día; el orden se cambia en la
            lista.
          </p>
          {error('label')}
        </div>
      </div>

      <div>
        <label htmlFor="campo-title" className="font-semibold text-ink-900">
          Título
        </label>
        <input
          type="text"
          required
          maxLength={80}
          placeholder="Fuerza · pierna"
          {...field('title')}
        />
        {error('title')}
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor="campo-focus" className="font-semibold text-ink-900">
            Objetivo <span className="font-normal text-ink-500">(obligatorio para publicar)</span>
          </label>
          <input
            type="text"
            maxLength={120}
            placeholder="Fuerza del tren inferior"
            {...field('focus')}
          />
          {error('focus')}
        </div>
        <div>
          <label htmlFor="campo-estimatedMinutes" className="font-semibold text-ink-900">
            Duración (min)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={300}
            step={5}
            {...field('estimatedMinutes')}
          />
          {error('estimatedMinutes')}
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Creando…' : 'Crear borrador'}
      </Button>
    </form>
  );
}
