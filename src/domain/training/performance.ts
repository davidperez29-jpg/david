import { formatNumber, formatSeconds } from '../format';
import { inRange, isInt, isMultipleOf, issue, type Issue } from '../issues';
import { type Amount, type RpeScale } from './effort';
import { type LoadSpec, type PerformedLoad } from './load';
import { type SetTarget } from './session-v2';

/**
 * Lo REALIZADO en una serie (docs/V1_SPEC.md §5.6 y docs/EXECUTION.md): qué datos pide cada serie
 * según su prescripción, cómo se validan, con qué valores se rellena el formulario y cómo se
 * compara con lo prescrito. Lo usan igual el servidor (que es quien decide) y el reproductor.
 *
 * Nada de esto calcula tonelaje, 1RM ni porcentajes de cumplimiento.
 */

/** Datos de una serie tal como los envía el cliente. */
export interface PerformedSetInput {
  completed: boolean;
  reps?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  load?: PerformedLoad | null;
  rir?: number | null;
  rpe?: number | null;
  note?: string | null;
}

/** Qué se registra en una serie, según lo prescrito. */
export interface PerformedFields {
  /** Lo principal: repeticiones, segundos o metros. */
  primary: 'reps' | 'seconds' | 'meters';
  /** En series por distancia, el tiempo se puede anotar (opcional). */
  optionalDuration: boolean;
  /** Modalidad de la carga realizada: siempre la de lo prescrito. */
  loadKind: PerformedLoad['kind'];
  /** Qué valor de carga se pide. */
  loadValue: 'kg' | 'added_kg' | 'assistance_kg' | 'descriptor' | 'kg_or_descriptor' | null;
  rir: boolean;
  rpe: RpeScale | null;
}

export const PERFORMED_LIMITS = {
  reps: { min: 1, max: 100 },
  seconds: { min: 1, max: 3600 },
  meters: { min: 1, max: 10_000 },
  kg: { min: 0.5, max: 500 },
  addedKg: { min: 0, max: 200 },
  assistanceKg: { min: 0, max: 200 },
  descriptor: 120,
  note: 300,
} as const;

/** Modalidad de la carga realizada para una carga prescrita. */
export function performedLoadKind(load: LoadSpec): PerformedLoad['kind'] {
  switch (load.kind) {
    case 'external':
    case 'external_range':
    case 'percent_1rm':
      return 'external';
    default:
      return load.kind;
  }
}

export function performedFieldsFor(target: SetTarget): PerformedFields {
  const loadKind = performedLoadKind(target.load);
  const effort = target.effort;
  return {
    primary:
      target.reps.kind === 'seconds'
        ? 'seconds'
        : target.reps.kind === 'meters'
          ? 'meters'
          : 'reps',
    optionalDuration: target.reps.kind === 'meters',
    loadKind,
    loadValue:
      loadKind === 'external'
        ? 'kg'
        : loadKind === 'bodyweight_plus'
          ? 'added_kg'
          : loadKind === 'assisted'
            ? 'assistance_kg'
            : loadKind === 'self_selected'
              ? 'kg_or_descriptor'
              : loadKind === 'elastic' || loadKind === 'device' || loadKind === 'other'
                ? 'descriptor'
                : null,
    rir: effort.kind === 'rir' || effort.kind === 'rir_and_rpe',
    rpe: effort.kind === 'rpe' || effort.kind === 'rir_and_rpe' ? effort.scale : null,
  };
}

const lower = (amount: Amount) => (typeof amount === 'number' ? amount : amount.min);

/** kg prescritos para rellenar el formulario (el valor fijo, el mínimo del rango o el resuelto). */
export function prescribedKg(load: LoadSpec): number | null {
  switch (load.kind) {
    case 'external':
      return load.kg;
    case 'external_range':
      return load.minKg;
    case 'percent_1rm':
      return load.resolution?.kg ?? null;
    case 'bodyweight_plus':
      return load.addedKg;
    case 'assisted':
      return load.assistanceKg ?? null;
    default:
      return null;
  }
}

function prescribedDescriptor(load: LoadSpec): string | null {
  switch (load.kind) {
    case 'elastic':
      return load.descriptor;
    case 'device':
      return load.unit ? `${load.setting} ${load.unit}` : load.setting;
    case 'other':
      return load.text;
    case 'assisted':
      return load.descriptor ?? null;
    default:
      return null;
  }
}

/** Formulario de una serie rellenado con lo prescrito (la serie se registra con un toque). */
export function defaultPerformed(target: SetTarget): PerformedSetInput {
  const fields = performedFieldsFor(target);
  const kg = prescribedKg(target.load);
  const descriptor = prescribedDescriptor(target.load);
  const load: PerformedLoad =
    fields.loadKind === 'external'
      ? { kind: 'external', kg: kg ?? 0 }
      : fields.loadKind === 'bodyweight_plus'
        ? { kind: 'bodyweight_plus', addedKg: kg ?? 0 }
        : fields.loadKind === 'assisted'
          ? { kind: 'assisted', assistanceKg: kg }
          : fields.loadKind === 'bodyweight' || fields.loadKind === 'none'
            ? { kind: fields.loadKind }
            : { kind: fields.loadKind, descriptor };
  return {
    completed: true,
    reps:
      target.reps.kind === 'fixed'
        ? target.reps.reps
        : target.reps.kind === 'range'
          ? target.reps.min
          : null,
    durationS: target.reps.kind === 'seconds' ? target.reps.seconds : null,
    distanceM: target.reps.kind === 'meters' ? target.reps.meters : null,
    load,
    // El esfuerzo real es opcional: no se rellena para no darlo por hecho.
    rir: null,
    rpe: null,
    note: null,
  };
}

const present = (value: unknown) => value !== null && value !== undefined;

/**
 * Validación de una serie realizada frente a su prescripción (la del servidor es la que manda;
 * el reproductor la usa para mostrar el error junto al campo antes de enviar).
 */
export function performedSetIssues(target: SetTarget, input: PerformedSetInput): Issue[] {
  const L = PERFORMED_LIMITS;
  const fields = performedFieldsFor(target);
  const issues: Issue[] = [];
  if (input.note !== null && input.note !== undefined) {
    if (typeof input.note !== 'string' || input.note.trim().length > L.note) {
      issues.push(issue('note', 'La observación no puede superar 300 caracteres.'));
    }
  }
  if (!input.completed) {
    for (const field of ['reps', 'durationS', 'distanceM', 'load', 'rir', 'rpe'] as const) {
      if (present(input[field])) {
        issues.push(issue(field, 'Una serie no realizada no lleva datos de ejecución.'));
      }
    }
    return issues;
  }

  // Lo principal: repeticiones, segundos o metros (y nada de lo que no corresponde).
  if (fields.primary === 'reps') {
    if (!isInt(input.reps, L.reps.min, L.reps.max)) {
      issues.push(issue('reps', 'Las repeticiones deben ser un entero de 1 a 100.'));
    }
    if (present(input.durationS) || present(input.distanceM)) {
      issues.push(issue('reps', 'Esta serie se registra en repeticiones.'));
    }
  } else if (fields.primary === 'seconds') {
    if (!isInt(input.durationS, L.seconds.min, L.seconds.max)) {
      issues.push(issue('durationS', 'La duración debe ser de 1 a 3600 segundos.'));
    }
    if (present(input.reps) || present(input.distanceM)) {
      issues.push(issue('durationS', 'Esta serie se registra en segundos.'));
    }
  } else {
    if (!inRange(input.distanceM, L.meters.min, L.meters.max)) {
      issues.push(issue('distanceM', 'La distancia debe ser de 1 a 10.000 metros.'));
    }
    if (present(input.durationS) && !isInt(input.durationS, L.seconds.min, L.seconds.max)) {
      issues.push(issue('durationS', 'La duración debe ser de 1 a 3600 segundos.'));
    }
    if (present(input.reps)) issues.push(issue('distanceM', 'Esta serie se registra en metros.'));
  }

  // La carga, en la modalidad prescrita.
  const load = input.load;
  if (!load || load.kind !== fields.loadKind) {
    issues.push(issue('load', 'La carga debe registrarse en la misma modalidad que la prescrita.'));
  } else {
    switch (load.kind) {
      case 'external':
        if (!inRange(load.kg, L.kg.min, L.kg.max)) {
          issues.push(issue('load.kg', 'Los kg deben estar entre 0,5 y 500.'));
        }
        break;
      case 'bodyweight_plus':
        if (!inRange(load.addedKg, L.addedKg.min, L.addedKg.max)) {
          issues.push(issue('load.addedKg', 'El lastre debe estar entre 0 y 200 kg.'));
        }
        break;
      case 'assisted':
        if (
          load.assistanceKg !== null &&
          !inRange(load.assistanceKg, L.assistanceKg.min, L.assistanceKg.max)
        ) {
          issues.push(issue('load.assistanceKg', 'La asistencia debe estar entre 0 y 200 kg.'));
        }
        break;
      case 'bodyweight':
      case 'none':
        break;
      default:
        if (
          load.descriptor !== null &&
          (typeof load.descriptor !== 'string' ||
            load.descriptor.trim().length === 0 ||
            load.descriptor.trim().length > L.descriptor)
        ) {
          issues.push(issue('load.descriptor', 'Describe la carga en 120 caracteres como mucho.'));
        }
        if (load.kg !== undefined) {
          if (load.kind !== 'self_selected') {
            issues.push(issue('load.kg', 'Esta carga se describe, sin kilogramos.'));
          } else if (!inRange(load.kg, L.kg.min, L.kg.max)) {
            issues.push(issue('load.kg', 'Los kg deben estar entre 0,5 y 500.'));
          }
        }
    }
  }

  // El esfuerzo real: opcional y solo si se prescribió.
  if (present(input.rir)) {
    if (!fields.rir) issues.push(issue('rir', 'En esta serie no se pidió RIR.'));
    else if (!isInt(input.rir, 0, 10)) issues.push(issue('rir', 'El RIR es un entero de 0 a 10.'));
  }
  if (present(input.rpe)) {
    if (!fields.rpe) issues.push(issue('rpe', 'En esta serie no se pidió RPE.'));
    else if (!inRange(input.rpe, 1, 10) || !isMultipleOf(input.rpe as number, 0.5)) {
      issues.push(issue('rpe', 'El RPE va de 1 a 10, en pasos de 0,5.'));
    }
  }
  return issues;
}

/** Datos de lo realizado que se muestran o comparan (los de un registro guardado o pendiente). */
export interface PerformedSet {
  completed: boolean;
  reps?: number;
  durationS?: number;
  distanceM?: number;
  load?: PerformedLoad;
  rir?: number;
  rpe?: number;
}

const kg = (value: number) => `${formatNumber(value, 2)} kg`;

/** «16 kg», «Tu peso + 5 kg», «Banda verde»… (o `null` si no hay carga que mostrar). */
export function describePerformedLoad(load: PerformedLoad | undefined): string | null {
  if (!load) return null;
  switch (load.kind) {
    case 'external':
      return kg(load.kg);
    case 'bodyweight':
      return 'Peso corporal';
    case 'none':
      return null;
    case 'bodyweight_plus':
      return `Peso corporal + ${kg(load.addedKg)}`;
    case 'assisted':
      return load.assistanceKg !== null ? `Asistencia de ${kg(load.assistanceKg)}` : 'Asistida';
    default:
      return load.descriptor ?? (load.kg !== undefined ? kg(load.kg) : null);
  }
}

/** «10 × 16 kg · RIR 1», «45 s», «No realizada». */
export function describePerformed(set: PerformedSet): string {
  if (!set.completed) return 'No realizada';
  const amount =
    set.reps !== undefined
      ? `${set.reps}`
      : set.durationS !== undefined && set.distanceM === undefined
        ? formatSeconds(set.durationS)
        : set.distanceM !== undefined
          ? `${formatNumber(set.distanceM)} m${set.durationS !== undefined ? ` en ${formatSeconds(set.durationS)}` : ''}`
          : '—';
  const load = describePerformedLoad(set.load);
  return [
    load ? `${amount} × ${load}` : amount,
    set.rir !== undefined ? `RIR ${set.rir}` : null,
    set.rpe !== undefined ? `RPE ${formatNumber(set.rpe)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const signed = (value: number, unit: string) =>
  `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), 2)} ${unit}`;

const outside = (value: number, min: number, max: number) => value < min || value > max;

/**
 * Diferencias entre lo realizado y lo prescrito, en lenguaje claro («−2 rep.», «+2,5 kg»,
 * «RIR 1 (previsto 2)»). Solo cuando la comparación tiene sentido: nada de porcentajes.
 */
export function setDifferences(target: SetTarget, set: PerformedSet): string[] {
  if (!set.completed) return ['No realizada'];
  const out: string[] = [];
  const reps = target.reps;
  if (reps.kind === 'fixed' && set.reps !== undefined && set.reps !== reps.reps) {
    out.push(signed(set.reps - reps.reps, 'rep.'));
  }
  if (reps.kind === 'range' && set.reps !== undefined && outside(set.reps, reps.min, reps.max)) {
    out.push(
      set.reps < reps.min
        ? `${set.reps} rep. (por debajo de ${reps.min}–${reps.max})`
        : `${set.reps} rep. (por encima de ${reps.min}–${reps.max})`,
    );
  }
  if (reps.kind === 'seconds' && set.durationS !== undefined && set.durationS !== reps.seconds) {
    out.push(signed(set.durationS - reps.seconds, 's'));
  }
  if (reps.kind === 'meters' && set.distanceM !== undefined && set.distanceM !== reps.meters) {
    out.push(signed(set.distanceM - reps.meters, 'm'));
  }

  const load = target.load;
  if (set.load?.kind === 'external') {
    if (load.kind === 'external' && set.load.kg !== load.kg)
      out.push(signed(set.load.kg - load.kg, 'kg'));
    if (load.kind === 'external_range' && outside(set.load.kg, load.minKg, load.maxKg)) {
      out.push(`${kg(set.load.kg)} (fuera de ${formatNumber(load.minKg, 2)}–${kg(load.maxKg)})`);
    }
    if (load.kind === 'percent_1rm' && load.resolution && set.load.kg !== load.resolution.kg) {
      out.push(signed(set.load.kg - load.resolution.kg, 'kg'));
    }
  }
  if (
    set.load?.kind === 'bodyweight_plus' &&
    load.kind === 'bodyweight_plus' &&
    set.load.addedKg !== load.addedKg
  ) {
    out.push(`lastre ${signed(set.load.addedKg - load.addedKg, 'kg')}`);
  }

  const effort = target.effort;
  if (set.rir !== undefined && (effort.kind === 'rir' || effort.kind === 'rir_and_rpe')) {
    const planned = effort.rir;
    const differs =
      typeof planned === 'number'
        ? set.rir !== planned
        : outside(set.rir, planned.min, planned.max);
    if (differs) out.push(`RIR ${set.rir} (previsto ${amountText(planned)})`);
  }
  if (set.rpe !== undefined && (effort.kind === 'rpe' || effort.kind === 'rir_and_rpe')) {
    const planned = effort.rpe;
    const differs =
      typeof planned === 'number'
        ? set.rpe !== planned
        : outside(set.rpe, planned.min, planned.max);
    if (differs) out.push(`RPE ${formatNumber(set.rpe)} (previsto ${amountText(planned)})`);
  }
  return out;
}

const amountText = (value: Amount) =>
  typeof value === 'number'
    ? formatNumber(value)
    : `${formatNumber(value.min)}–${formatNumber(value.max)}`;

/** Valor inferior de un objetivo de esfuerzo (para mostrar «RIR 2» en el formulario). */
export const effortHint = (amount: Amount) => lower(amount);
