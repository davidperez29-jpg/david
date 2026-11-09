import { formatNumber } from '../format';
import { inRange, isInt, isMultipleOf, issue, type Issue, textWithin } from '../issues';
import { type FormulaRef } from '../measurement';
import { type IsoDate, type IsoDateTime } from '../time';

/**
 * Carga prescrita (prescripción v2, docs/DATA_MODEL.md §12 y EFFORT_AND_LOAD.md §3).
 * El modelo admite todas las modalidades; la interfaz las va ofreciendo por bloques.
 */
export type LoadBasis = 'total' | 'per_side' | 'per_implement';
export type AssistVia = 'machine' | 'band' | 'partner' | 'other';

/** kg del %1RM calculados y congelados al publicar cada versión. */
export interface PercentResolution {
  referenceKg: number;
  referenceDate: IsoDate;
  kg: number;
  formula: FormulaRef;
  resolvedAt: IsoDateTime;
}

export type LoadSpec =
  | { kind: 'external'; kg: number; basis: LoadBasis; implements?: number }
  | { kind: 'external_range'; minKg: number; maxKg: number; basis: LoadBasis; implements?: number }
  | {
      kind: 'percent_1rm';
      percent: number;
      referenceResultId: string;
      roundingStepKg: number;
      resolution?: PercentResolution;
    }
  | { kind: 'bodyweight' }
  | { kind: 'bodyweight_plus'; addedKg: number }
  | { kind: 'assisted'; assistanceKg?: number; via: AssistVia; descriptor?: string }
  | { kind: 'elastic'; descriptor: string }
  | { kind: 'device'; setting: string; unit?: string }
  | { kind: 'self_selected'; guidance?: string }
  | { kind: 'none' }
  | { kind: 'other'; text: string };

export type LoadKind = LoadSpec['kind'];

/** Carga realizada: siempre en la misma modalidad que la prescrita. */
export type PerformedLoad =
  | { kind: 'external'; kg: number }
  | { kind: 'bodyweight' }
  | { kind: 'none' }
  | { kind: 'bodyweight_plus'; addedKg: number }
  | { kind: 'assisted'; assistanceKg: number | null }
  | {
      kind: 'elastic' | 'device' | 'self_selected' | 'other';
      descriptor: string | null;
      kg?: number;
    };

/** Límites de plausibilidad (evitan errores de escritura; no son valores normativos). */
export const LOAD_LIMITS = {
  kg: { min: 0.5, max: 500 },
  addedKg: { min: 0.5, max: 200 },
  assistanceKg: { min: 0, max: 200 },
  percent: { min: 1, max: 100, step: 0.5 },
  implements: { min: 2, max: 4 },
  roundingStepsKg: [0.5, 1, 1.25, 2.5, 5],
} as const;

const ASSIST_VIA: readonly AssistVia[] = ['machine', 'band', 'partner', 'other'];
const BASES: readonly LoadBasis[] = ['total', 'per_side', 'per_implement'];

const kgIssue = (value: unknown, path: string, label = 'La carga'): Issue[] =>
  inRange(value, LOAD_LIMITS.kg.min, LOAD_LIMITS.kg.max)
    ? []
    : [issue(path, `${label} debe estar entre 0,5 y 500 kg.`)];

function basisIssues(load: { basis: LoadBasis; implements?: number }, path: string): Issue[] {
  if (!BASES.includes(load.basis)) return [issue(`${path}.basis`, 'Base de la carga no válida.')];
  if (load.basis === 'per_implement' && !isInt(load.implements, 2, 4)) {
    return [issue(`${path}.implements`, 'Indica cuántos implementos (de 2 a 4).')];
  }
  if (load.basis !== 'per_implement' && load.implements !== undefined) {
    return [
      issue(`${path}.implements`, 'El número de implementos solo se usa con «por implemento».'),
    ];
  }
  return [];
}

/** Validación de la carga prescrita (tipos y rangos). */
export function loadIssues(load: LoadSpec, path: string): Issue[] {
  switch (load.kind) {
    case 'external':
      return [...kgIssue(load.kg, `${path}.kg`), ...basisIssues(load, path)];
    case 'external_range': {
      const issues = [
        ...kgIssue(load.minKg, `${path}.minKg`, 'El mínimo'),
        ...kgIssue(load.maxKg, `${path}.maxKg`, 'El máximo'),
        ...basisIssues(load, path),
      ];
      if (issues.length === 0 && load.minKg >= load.maxKg) {
        issues.push(issue(`${path}.maxKg`, 'El máximo debe ser mayor que el mínimo.'));
      }
      return issues;
    }
    case 'percent_1rm': {
      const issues: Issue[] = [];
      if (
        !inRange(load.percent, LOAD_LIMITS.percent.min, LOAD_LIMITS.percent.max) ||
        !isMultipleOf(load.percent, LOAD_LIMITS.percent.step)
      ) {
        issues.push(
          issue(`${path}.percent`, 'El porcentaje debe estar entre 1 y 100, en pasos de 0,5.'),
        );
      }
      if (!textWithin(load.referenceResultId, 1, 80)) {
        issues.push(issue(`${path}.referenceResultId`, 'Elige el 1RM de referencia.'));
      }
      if (!(LOAD_LIMITS.roundingStepsKg as readonly number[]).includes(load.roundingStepKg)) {
        issues.push(issue(`${path}.roundingStepKg`, 'Redondeo no válido.'));
      }
      return issues;
    }
    case 'bodyweight':
    case 'none':
      return [];
    case 'bodyweight_plus':
      return inRange(load.addedKg, LOAD_LIMITS.addedKg.min, LOAD_LIMITS.addedKg.max)
        ? []
        : [issue(`${path}.addedKg`, 'El lastre debe estar entre 0,5 y 200 kg.')];
    case 'assisted': {
      const issues: Issue[] = [];
      if (
        load.assistanceKg !== undefined &&
        !inRange(load.assistanceKg, LOAD_LIMITS.assistanceKg.min, LOAD_LIMITS.assistanceKg.max)
      ) {
        issues.push(issue(`${path}.assistanceKg`, 'La asistencia debe estar entre 0 y 200 kg.'));
      }
      if (!ASSIST_VIA.includes(load.via)) {
        issues.push(
          issue(`${path}.via`, 'Indica cómo se asiste (máquina, banda, compañero u otro).'),
        );
      }
      if (load.descriptor !== undefined && !textWithin(load.descriptor, 1, 80)) {
        issues.push(issue(`${path}.descriptor`, 'La descripción no puede superar 80 caracteres.'));
      }
      return issues;
    }
    case 'elastic':
      return textWithin(load.descriptor, 1, 80)
        ? []
        : [issue(`${path}.descriptor`, 'Describe la banda (color, nivel o configuración).')];
    case 'device':
      return textWithin(load.setting, 1, 40)
        ? []
        : [issue(`${path}.setting`, 'Indica el ajuste del dispositivo.')];
    case 'self_selected':
      return load.guidance === undefined || textWithin(load.guidance, 1, 200)
        ? []
        : [issue(`${path}.guidance`, 'La orientación no puede superar 200 caracteres.')];
    case 'other':
      return textWithin(load.text, 1, 120) ? [] : [issue(`${path}.text`, 'Describe la carga.')];
  }
}

const kgText = (kg: number) => `${formatNumber(kg, 2)} kg`;
const basisText = (load: { basis: LoadBasis; implements?: number }, kg: number) =>
  load.basis === 'per_implement'
    ? `${load.implements ?? 2} × ${kgText(kg)}`
    : load.basis === 'per_side'
      ? `${kgText(kg)} por lado`
      : kgText(kg);

/** Texto breve de la carga prescrita («60 kg», «Peso corporal + 5 kg», «Sin carga»…). */
export function describeLoad(load: LoadSpec): string {
  switch (load.kind) {
    case 'external':
      return basisText(load, load.kg);
    case 'external_range':
      return `${formatNumber(load.minKg, 2)}–${formatNumber(load.maxKg, 2)} kg`;
    case 'percent_1rm':
      return load.resolution
        ? `${kgText(load.resolution.kg)} (${formatNumber(load.percent)} % 1RM)`
        : `${formatNumber(load.percent)} % 1RM`;
    case 'bodyweight':
      return 'Peso corporal';
    case 'bodyweight_plus':
      return `Peso corporal + ${kgText(load.addedKg)}`;
    case 'assisted':
      return load.assistanceKg !== undefined
        ? `Asistencia de ${kgText(load.assistanceKg)}`
        : 'Asistida';
    case 'elastic':
      return load.descriptor;
    case 'device':
      return load.unit ? `${load.setting} ${load.unit}` : load.setting;
    case 'self_selected':
      return 'Carga a elegir';
    case 'none':
      return 'Sin carga';
    case 'other':
      return load.text;
  }
}

/**
 * kg externos totales por repetición de lo prescrito, o `null` si la modalidad no tiene carga
 * externa en kg (peso corporal, lastre, asistencia, bandas…). Solo la base «total» en V1:
 * las otras bases se calcularán con `training.volume-load` 2.0.0 (bloque 3).
 */
export function prescribedExternalKg(load: LoadSpec): number | null {
  if (load.kind === 'external' && load.basis === 'total') return load.kg;
  if (load.kind === 'percent_1rm' && load.resolution) return load.resolution.kg;
  return null;
}
