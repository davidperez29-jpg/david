import { type ReactNode } from 'react';
import { type Period } from '@/domain/analysis/period';
import { cn } from '@/ui/cn';
import { periodOptions } from './analysis-links';

/**
 * Piezas comunes de A9 y A10 (B3.2): campos con su etiqueta explícita (y su ayuda enlazada) y
 * las tablas anchas, que en el móvil se desplazan en horizontal dentro de una región que se
 * puede enfocar con el teclado.
 */
export const fieldClass =
  'mt-1 block h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm text-ink-900';
const labelClass = 'block text-sm font-semibold text-ink-700';

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-ayuda`} className="mt-0.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Periodo, semana de referencia y rango libre (los cuatro campos de la URL). */
export function PeriodFields({ period, kind }: { period: Period; kind: string }) {
  const range = period.kind === 'range';
  return (
    <>
      <Field id="f-periodo" label="Periodo">
        <select id="f-periodo" name="periodo" defaultValue={kind} className={fieldClass}>
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="f-fecha"
        label="Semana que contiene"
        hint="La última semana del periodo. No se usa en el rango libre."
      >
        <input
          id="f-fecha"
          type="date"
          name="fecha"
          defaultValue={range ? '' : period.anchor}
          aria-describedby="f-fecha-ayuda"
          className={fieldClass}
        />
      </Field>
      <Field id="f-desde" label="Desde (rango libre)">
        <input
          id="f-desde"
          type="date"
          name="desde"
          defaultValue={range ? period.from : ''}
          className={fieldClass}
        />
      </Field>
      <Field id="f-hasta" label="Hasta (rango libre)" hint="Como mucho 53 semanas.">
        <input
          id="f-hasta"
          type="date"
          name="hasta"
          defaultValue={range ? period.to : ''}
          aria-describedby="f-hasta-ayuda"
          className={fieldClass}
        />
      </Field>
    </>
  );
}

/** Tabla ancha: región con nombre, enfocable, que se desplaza en horizontal si no cabe. */
export function ScrollTable({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'overflow-x-auto rounded-xl focus-visible:outline-3 focus-visible:outline-ink-900',
        className,
      )}
    >
      {children}
    </div>
  );
}
