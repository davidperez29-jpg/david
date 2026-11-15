import { Sigma } from 'lucide-react';
import { findFormula } from '@/domain/formulas';
import { type FormulaRef } from '@/domain/measurement';

/**
 * Insignia de la fórmula que produce una cifra (AC-B3-15): id, versión, definición y
 * limitaciones, desplegables. Todas las del análisis son definiciones de diseño, no fórmulas
 * científicas, y lo dicen.
 */
export function FormulaBadge({ formula }: { formula: FormulaRef }) {
  const definition = findFormula(formula);
  const label = `${formula.id} ${formula.version}`;
  if (!definition)
    return <span className="text-xs text-coral-700">Fórmula no registrada: {label}</span>;
  return (
    <details className="group inline-block align-middle text-xs text-ink-500">
      <summary className="inline-flex min-h-7 cursor-pointer list-none items-center gap-1 rounded-full border border-line bg-white px-2 font-mono hover:border-ink-300 [&::-webkit-details-marker]:hidden">
        <Sigma aria-hidden className="size-3.5" />
        <span className="sr-only">Fórmula </span>
        {label}
      </summary>
      <div className="mt-1 max-w-sm rounded-2xl border border-line bg-cream-50 p-3 text-left font-sans text-ink-700">
        <p className="font-semibold text-ink-900">
          {definition.name} · definición de diseño (no es una fórmula científica)
        </p>
        <p className="mt-1">{definition.expression}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {definition.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
