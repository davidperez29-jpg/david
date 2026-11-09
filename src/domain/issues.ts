/**
 * Problema de validación: dónde está (`path`, p. ej. `items.0.defaults.load.kg`) y qué pasa,
 * en lenguaje claro. La interfaz lo muestra junto al campo; los casos de uso lo devuelven.
 */
export interface Issue {
  path: string;
  message: string;
}

export const issue = (path: string, message: string): Issue => ({ path, message });

export const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Múltiplo exacto de `step` (con tolerancia para los decimales binarios). */
export const isMultipleOf = (value: number, step: number) =>
  Math.abs(value / step - Math.round(value / step)) < 1e-9;

export const textWithin = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
