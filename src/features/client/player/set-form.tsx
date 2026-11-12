'use client';

import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { type PlayerSetVM } from '@/contracts/execution';
import { formatNumber } from '@/domain/format';
import { type Issue } from '@/domain/issues';
import { type PerformedLoad } from '@/domain/training/load';
import {
  defaultPerformed,
  performedFieldsFor,
  performedSetIssues,
  type PerformedSetInput,
} from '@/domain/training/performance';
import { cn } from '@/ui/cn';
import { type LocalRecord } from './player-model';
import { useArmed } from './use-armed';

const parse = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() === '' || Number.isNaN(n) ? null : n;
};

/** Control −/+ de 48 px que también admite escribir (B4). */
function Stepper({
  label,
  value,
  step,
  min,
  unit,
  decimals = false,
  invalid,
  describedBy,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  min: number;
  unit?: string;
  decimals?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : formatNumber(value, 2).replace(/\s/g, ''));
  const set = (next: number | null) => {
    onChange(next);
    setText(next === null ? '' : String(next).replace('.', ','));
  };
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold tracking-wide text-ink-500 uppercase">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => set(Math.max(min, (value ?? 0) - step))}
          aria-label={`${label}: menos ${formatNumber(step, 2)}`}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink-900 active:bg-cream-200"
        >
          <Minus aria-hidden className="size-5" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            inputMode={decimals ? 'decimal' : 'numeric'}
            value={text}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(e) => {
              setText(e.target.value);
              onChange(parse(e.target.value));
            }}
            className={cn(
              'h-12 w-full rounded-2xl border bg-white px-2 text-center font-display text-2xl font-extrabold text-ink-900 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-sun-500',
              unit ? 'pr-9' : '',
              invalid ? 'border-coral-500' : 'border-line',
            )}
          />
          {unit ? (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-ink-500">
              {unit}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => set((value ?? 0) + step)}
          aria-label={`${label}: más ${formatNumber(step, 2)}`}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink-900 active:bg-cream-200"
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}

const fromRecord = (record: LocalRecord): PerformedSetInput => ({
  completed: true,
  reps: record.reps ?? null,
  durationS: record.durationS ?? null,
  distanceM: record.distanceM ?? null,
  load: record.load ?? null,
  rir: record.rir ?? null,
  rpe: record.rpe ?? null,
  note: record.note ?? null,
});

const RPE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

/**
 * Registro de una serie (B4): lo prescrito ya rellenado, la carga en su modalidad, el esfuerzo
 * real solo si se pidió (y opcional) y la observación plegada. Un toque si todo coincide.
 */
export function SetForm({
  set,
  totalSets,
  exerciseName,
  correcting,
  disabled,
  onDone,
  onSkip,
  onCancel,
}: {
  set: PlayerSetVM;
  totalSets: number;
  exerciseName: string;
  /** Si se está corrigiendo un registro ya confirmado. */
  correcting: LocalRecord | null;
  disabled: boolean;
  onDone: (input: PerformedSetInput) => void;
  onSkip: (note: string | null) => void;
  onCancel?: () => void;
}) {
  const fields = performedFieldsFor(set.target);
  const [input, setInput] = useState<PerformedSetInput>(() =>
    correcting ? fromRecord(correcting) : defaultPerformed(set.target),
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const errorId = useId();
  const issueFor = (path: string) =>
    issues.find((i) => i.path === path || i.path.startsWith(`${path}.`));
  const update = (patch: Partial<PerformedSetInput>) => setInput((v) => ({ ...v, ...patch }));
  const load = input.load ?? null;
  const setLoad = (patch: Partial<PerformedLoad>) =>
    update({ load: { ...(load ?? { kind: fields.loadKind }), ...patch } as PerformedLoad });

  const armed = useArmed();
  const submit = () => {
    if (!armed) return;
    const found = performedSetIssues(set.target, input);
    setIssues(found);
    if (found.length === 0) onDone(input);
  };

  const heading = correcting
    ? `Corregir serie ${set.setNumber}`
    : `Serie ${set.setNumber} de ${totalSets}`;

  return (
    <section
      aria-label={`${heading} de ${exerciseName}`}
      className="rounded-3xl bg-white p-4 shadow-soft"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold tracking-wide text-ink-900 uppercase">{heading}</h3>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            <X aria-hidden className="size-4" /> Cancelar
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.primary === 'reps' ? (
          <Stepper
            label="Repeticiones"
            value={input.reps ?? null}
            step={1}
            min={0}
            invalid={!!issueFor('reps')}
            describedBy={issueFor('reps') ? errorId : undefined}
            onChange={(reps) => update({ reps })}
          />
        ) : fields.primary === 'seconds' ? (
          <Stepper
            label="Segundos"
            value={input.durationS ?? null}
            step={5}
            min={0}
            unit="s"
            invalid={!!issueFor('durationS')}
            onChange={(durationS) => update({ durationS })}
          />
        ) : (
          <>
            <Stepper
              label="Metros"
              value={input.distanceM ?? null}
              step={10}
              min={0}
              unit="m"
              decimals
              invalid={!!issueFor('distanceM')}
              onChange={(distanceM) => update({ distanceM })}
            />
            <Stepper
              label="Tiempo (opcional)"
              value={input.durationS ?? null}
              step={5}
              min={0}
              unit="s"
              invalid={!!issueFor('durationS')}
              onChange={(durationS) => update({ durationS })}
            />
          </>
        )}

        {load?.kind === 'external' ? (
          <Stepper
            label="Carga"
            value={load.kg}
            step={1}
            min={0}
            unit="kg"
            decimals
            invalid={!!issueFor('load')}
            onChange={(kg) => setLoad({ kg: kg ?? 0 } as Partial<PerformedLoad>)}
          />
        ) : load?.kind === 'bodyweight_plus' ? (
          <Stepper
            label="Lastre"
            value={load.addedKg}
            step={1}
            min={0}
            unit="kg"
            decimals
            invalid={!!issueFor('load')}
            onChange={(addedKg) => setLoad({ addedKg: addedKg ?? 0 } as Partial<PerformedLoad>)}
          />
        ) : load?.kind === 'assisted' ? (
          <Stepper
            label="Asistencia"
            value={load.assistanceKg}
            step={1}
            min={0}
            unit="kg"
            decimals
            invalid={!!issueFor('load')}
            onChange={(assistanceKg) => setLoad({ assistanceKg } as Partial<PerformedLoad>)}
          />
        ) : load && 'descriptor' in load ? (
          <label className="block">
            <span className="text-xs font-bold tracking-wide text-ink-500 uppercase">Carga</span>
            <input
              value={load.descriptor ?? ''}
              maxLength={120}
              placeholder="Banda verde, nivel 3…"
              onChange={(e) =>
                setLoad({
                  descriptor: e.target.value.trim() === '' ? null : e.target.value,
                } as Partial<PerformedLoad>)
              }
              className="mt-1 h-12 w-full rounded-2xl border border-line bg-white px-3 font-semibold text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-sun-500"
            />
          </label>
        ) : (
          <p className="self-end rounded-2xl bg-cream-100 px-3 py-3 text-sm font-semibold text-ink-700">
            {fields.loadKind === 'bodyweight' ? 'Con tu peso corporal' : 'Sin carga externa'}
          </p>
        )}
      </div>

      {fields.rir ? (
        <fieldset className="mt-3">
          <legend className="text-sm font-semibold text-ink-900">
            ¿Cuántas repeticiones te quedaban?{' '}
            <span className="font-normal text-ink-500">(RIR, opcional)</span>
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={input.rir === value}
                onClick={() => update({ rir: input.rir === value ? null : value })}
                className={cn(
                  'grid size-12 place-items-center rounded-2xl border text-lg font-bold',
                  input.rir === value
                    ? 'border-ink-900 bg-ink-900 text-cream-50'
                    : 'border-line bg-white text-ink-900',
                )}
              >
                {value}
              </button>
            ))}
            <select
              aria-label="RIR de 6 a 10"
              value={
                input.rir !== null && input.rir !== undefined && input.rir > 5
                  ? String(input.rir)
                  : ''
              }
              onChange={(e) =>
                update({ rir: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="h-12 rounded-2xl border border-line bg-white px-2 font-semibold text-ink-900"
            >
              <option value="">6+</option>
              {[6, 7, 8, 9, 10].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      ) : null}

      {fields.rpe ? (
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-ink-900">
            Esfuerzo percibido <span className="font-normal text-ink-500">(RPE, opcional)</span>
          </span>
          <select
            value={input.rpe ?? ''}
            onChange={(e) => update({ rpe: e.target.value === '' ? null : Number(e.target.value) })}
            className="mt-1 h-12 w-full rounded-2xl border border-line bg-white px-3 font-semibold text-ink-900"
          >
            <option value="">Sin indicar</option>
            {RPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {formatNumber(v)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <details className="group mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-sun-800">
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          Añadir observación
        </summary>
        <textarea
          aria-label="Observación de la serie"
          value={input.note ?? ''}
          maxLength={300}
          rows={2}
          onChange={(e) => update({ note: e.target.value === '' ? null : e.target.value })}
          className="mt-1 w-full rounded-2xl border border-line bg-white p-3 text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-sun-500"
        />
      </details>

      {issues.length > 0 ? (
        <ul
          id={errorId}
          role="alert"
          className="mt-3 space-y-0.5 text-sm font-semibold text-coral-700"
        >
          {issues.map((i) => (
            <li key={`${i.path}-${i.message}`}>{i.message}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        aria-disabled={armed ? undefined : true}
        onClick={submit}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 hover:bg-ink-700 disabled:opacity-50"
      >
        <Check aria-hidden className="size-5" /> {correcting ? 'Guardar corrección' : 'Serie hecha'}
      </button>
      {correcting ? null : (
        <button
          type="button"
          disabled={disabled}
          aria-disabled={armed ? undefined : true}
          onClick={() => {
            if (armed) onSkip(input.note?.trim() ? input.note.trim() : null);
          }}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-ink-500 hover:bg-cream-100 hover:text-ink-900 disabled:opacity-50"
        >
          No la he hecho
        </button>
      )}
    </section>
  );
}
