import { type IsoDateTime } from './time';

/**
 * Procedencia de cada dato. TrainPro nunca mezcla un valor medido con uno estimado o
 * declarado: el origen viaja siempre con el valor y se muestra en la interfaz.
 */
export const DATA_ORIGINS = [
  'direct',
  'calculated',
  'estimated',
  'imported',
  'self_reported',
] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const DATA_ORIGIN_INFO: Record<DataOrigin, { label: string; description: string }> = {
  direct: {
    label: 'Medición directa',
    description:
      'El instrumento mide esta magnitud directamente (p. ej., un tiempo con fotocélulas).',
  },
  calculated: {
    label: 'Cálculo',
    description: 'Resultado de aplicar una fórmula registrada y versionada a otros datos.',
  },
  estimated: {
    label: 'Estimación',
    description: 'Valor predicho con un modelo o ecuación; lleva asociado un error de estimación.',
  },
  imported: {
    label: 'Dato importado',
    description: 'Valor recibido de un dispositivo o archivo externo; se conserva su procedencia.',
  },
  self_reported: {
    label: 'Autodeclarado',
    description: 'Valor que comunica la propia persona (p. ej., el esfuerzo percibido).',
  },
};

export const UNIT_SYMBOLS = {
  kg: 'kg',
  cm: 'cm',
  m: 'm',
  s: 's',
  ms: 'ms',
  'm/s': 'm/s',
  reps: 'rep.',
  au: 'UA',
} as const;
export type Unit = keyof typeof UNIT_SYMBOLS;

export type RecordedBy = 'trainer' | 'client' | 'device' | 'system';

/** Referencia a una fórmula del registro (ver formulas.ts). */
export interface FormulaRef {
  id: string;
  version: string;
}

export interface Provenance {
  origin: DataOrigin;
  /** Método o protocolo con el que se obtuvo el dato, en lenguaje claro. */
  method: string;
  /** Instrumento o dispositivo utilizado, si lo hay. */
  instrument?: string;
  /** Obligatoria para datos calculados o estimados. */
  formula?: FormulaRef;
  /** Obligatoria para datos importados: archivo, aplicación o dispositivo de origen. */
  importedFrom?: string;
  measuredAt: IsoDateTime;
  recordedAt: IsoDateTime;
  recordedBy: RecordedBy;
}

export interface Measurement {
  value: number;
  unit: Unit;
  provenance: Provenance;
}

const isDateTime = (value: string) => !Number.isNaN(Date.parse(value));

/**
 * Comprueba que la procedencia es completa y coherente. Devuelve la lista de problemas
 * (vacía si es válida) para poder mostrarlos al usuario en lugar de fallar en silencio.
 */
export function provenanceIssues(
  provenance: Provenance,
  isRegisteredFormula: (ref: FormulaRef) => boolean = () => true,
): string[] {
  const issues: string[] = [];
  const derived = provenance.origin === 'calculated' || provenance.origin === 'estimated';

  if (provenance.method.trim() === '') issues.push('Falta el método de obtención.');
  if (derived && !provenance.formula) {
    issues.push('Un valor calculado o estimado debe indicar la fórmula y su versión.');
  }
  if (!derived && provenance.formula) {
    issues.push('Solo los valores calculados o estimados pueden hacer referencia a una fórmula.');
  }
  if (provenance.formula && !isRegisteredFormula(provenance.formula)) {
    issues.push(
      `La fórmula ${provenance.formula.id} v${provenance.formula.version} no está registrada.`,
    );
  }
  if (provenance.origin === 'imported' && !provenance.importedFrom?.trim()) {
    issues.push('Un dato importado debe indicar de dónde procede.');
  }
  if (!isDateTime(provenance.measuredAt)) issues.push('La fecha de medición no es válida.');
  if (!isDateTime(provenance.recordedAt)) issues.push('La fecha de registro no es válida.');
  if (
    isDateTime(provenance.measuredAt) &&
    isDateTime(provenance.recordedAt) &&
    Date.parse(provenance.measuredAt) > Date.parse(provenance.recordedAt)
  ) {
    issues.push('La medición no puede ser posterior a su registro.');
  }
  return issues;
}

export function measurementIssues(
  measurement: Measurement,
  isRegisteredFormula?: (ref: FormulaRef) => boolean,
): string[] {
  const issues = Number.isFinite(measurement.value) ? [] : ['El valor no es un número válido.'];
  if (!(measurement.unit in UNIT_SYMBOLS)) issues.push(`Unidad desconocida: ${measurement.unit}.`);
  return [...issues, ...provenanceIssues(measurement.provenance, isRegisteredFormula)];
}
