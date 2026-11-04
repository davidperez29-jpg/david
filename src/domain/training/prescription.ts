import { formatNumber, formatSeconds } from '../format';

/** Objetivo de cada serie: repeticiones fijas, rango, tiempo o distancia. */
export type RepTarget =
  | { kind: 'fixed'; reps: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'seconds'; seconds: number }
  | { kind: 'meters'; meters: number };

/** Cómo se prescribe la carga. Solo `kg` permite calcular tonelaje directamente. */
export type LoadPrescription =
  | { kind: 'kg'; kg: number }
  | { kind: 'bodyweight' }
  | { kind: 'percent_1rm'; percent: number }
  | { kind: 'autoregulated' }
  | { kind: 'text'; text: string };

/**
 * Objetivo de esfuerzo:
 * - RIR: repeticiones en reserva.
 * - RPE: esfuerzo percibido en escala 1–10.
 * - Carácter del esfuerzo: repeticiones realizadas sobre las realizables, notado «6 (12)».
 */
export type EffortTarget =
  | { kind: 'rir'; rir: number }
  | { kind: 'rpe'; rpe: number }
  | { kind: 'character'; performed: number; possible: number }
  | { kind: 'none' };

/**
 * Tempo en cuatro fases, en segundos, con la convención que usa TrainPro:
 * excéntrica – pausa – concéntrica – pausa. «X» indica una fase concéntrica explosiva.
 */
export interface Tempo {
  eccentric: number;
  firstPause: number;
  concentric: number | 'X';
  secondPause: number;
}

export interface ExercisePrescription {
  id: string;
  exerciseId: string;
  /** Bloque de la sesión (A, B, C…). Los ejercicios del mismo bloque pueden alternarse. */
  block: string;
  order: number;
  sets: number;
  reps: RepTarget;
  load: LoadPrescription;
  restSeconds: number;
  tempo?: Tempo;
  effort: EffortTarget;
  notes?: string;
}

const TEMPO = /^(\d{1,2})-(\d{1,2})-(\d{1,2}|X)-(\d{1,2})$/i;

export function parseTempo(code: string): Tempo | null {
  const match = TEMPO.exec(code.trim());
  if (!match) return null;
  const concentric = match[3]!.toUpperCase() === 'X' ? 'X' : Number(match[3]);
  return {
    eccentric: Number(match[1]),
    firstPause: Number(match[2]),
    concentric,
    secondPause: Number(match[4]),
  };
}

export function formatTempo(tempo: Tempo): string {
  return `${tempo.eccentric}-${tempo.firstPause}-${tempo.concentric}-${tempo.secondPause}`;
}

/** Explicación del tempo en lenguaje claro para el cliente. */
export function describeTempo(tempo: Tempo): string[] {
  const pause = (seconds: number, where: string) =>
    seconds === 0 ? `Sin pausa ${where}` : `${seconds} s de pausa ${where}`;
  return [
    `${tempo.eccentric} s en la fase excéntrica (frenando el peso)`,
    pause(tempo.firstPause, 'al final de la fase excéntrica'),
    tempo.concentric === 'X'
      ? 'Fase concéntrica explosiva, lo más rápido posible con buena técnica'
      : `${tempo.concentric} s en la fase concéntrica (venciendo el peso)`,
    pause(tempo.secondPause, 'antes de la siguiente repetición'),
  ];
}

export function formatRepTarget(target: RepTarget): string {
  switch (target.kind) {
    case 'fixed':
      return `${target.reps}`;
    case 'range':
      return `${target.min}–${target.max}`;
    case 'seconds':
      return formatSeconds(target.seconds);
    case 'meters':
      return `${formatNumber(target.meters)} m`;
  }
}

/** «4 × 6–8», «3 × 30 s». */
export function formatSetsAndReps(sets: number, target: RepTarget): string {
  return `${sets} × ${formatRepTarget(target)}`;
}

export function formatLoad(load: LoadPrescription): string {
  switch (load.kind) {
    case 'kg':
      return `${formatNumber(load.kg)} kg`;
    case 'bodyweight':
      return 'Peso corporal';
    case 'percent_1rm':
      return `${formatNumber(load.percent)} % 1RM`;
    case 'autoregulated':
      return 'Según el esfuerzo indicado';
    case 'text':
      return load.text;
  }
}

export function formatEffort(effort: EffortTarget): string | null {
  switch (effort.kind) {
    case 'rir':
      return `RIR ${formatNumber(effort.rir)}`;
    case 'rpe':
      return `RPE ${formatNumber(effort.rpe)}`;
    case 'character':
      return `Carácter ${effort.performed} (${effort.possible})`;
    case 'none':
      return null;
  }
}

/** Repeticiones con las que se rellena el registro por defecto (el mínimo del rango). */
export function defaultRepsFor(target: RepTarget): number | null {
  if (target.kind === 'fixed') return target.reps;
  if (target.kind === 'range') return target.min;
  return null;
}

export function defaultLoadKgFor(load: LoadPrescription): number | null {
  return load.kind === 'kg' ? load.kg : null;
}

const isInt = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

/**
 * Validación de entrada (no son criterios científicos): evita prescripciones imposibles
 * o mal escritas antes de guardarlas.
 */
export function prescriptionIssues(p: ExercisePrescription): string[] {
  const issues: string[] = [];
  if (!isInt(p.sets, 1, 50)) issues.push('Las series deben ser un entero entre 1 y 50.');
  if (!isInt(p.restSeconds, 0, 1800)) issues.push('El descanso debe estar entre 0 y 1800 s.');

  const r = p.reps;
  if (r.kind === 'fixed' && !isInt(r.reps, 1, 200)) issues.push('Repeticiones no válidas.');
  if (r.kind === 'range' && !(isInt(r.min, 1, 200) && isInt(r.max, 1, 200) && r.min < r.max)) {
    issues.push('El rango de repeticiones no es válido (mínimo < máximo).');
  }
  if (r.kind === 'seconds' && !inRange(r.seconds, 1, 3600)) issues.push('Tiempo no válido.');
  if (r.kind === 'meters' && !inRange(r.meters, 1, 10_000)) issues.push('Distancia no válida.');

  const l = p.load;
  if (l.kind === 'kg' && !inRange(l.kg, 0, 1000)) issues.push('Carga en kg no válida.');
  if (l.kind === 'percent_1rm' && !inRange(l.percent, 1, 100)) {
    issues.push('El porcentaje de 1RM debe estar entre 1 y 100.');
  }
  if (l.kind === 'text' && l.text.trim() === '') issues.push('Describe la carga.');

  const e = p.effort;
  if (e.kind === 'rir' && !isInt(e.rir, 0, 10)) issues.push('El RIR debe ser un entero de 0 a 10.');
  if (e.kind === 'rpe' && !(inRange(e.rpe, 1, 10) && Number.isInteger(e.rpe * 2))) {
    issues.push('El RPE debe estar entre 1 y 10, en pasos de 0,5.');
  }
  if (
    e.kind === 'character' &&
    !(isInt(e.performed, 1, 200) && isInt(e.possible, 1, 200) && e.performed <= e.possible)
  ) {
    issues.push('En el carácter del esfuerzo, las realizadas no pueden superar a las realizables.');
  }
  return issues;
}
