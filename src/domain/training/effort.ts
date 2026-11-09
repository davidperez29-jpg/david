import { formatNumber } from '../format';
import { inRange, isInt, isMultipleOf, issue, type Issue, textWithin } from '../issues';
import { type RepTarget } from './prescription';

/**
 * Objetivo de esfuerzo (prescripción v2, EFFORT_AND_LOAD.md §4). Empieza siempre en «ninguno»:
 * nunca se impone una escala. RIR y RPE juntos solo con justificación y otra escala (§4.4).
 */
export type Amount = number | { min: number; max: number };
export type RpeScale = 'rir_based' | 'omni_res' | 'borg_cr10';

export type EffortTargetV2 =
  | { kind: 'none' }
  | { kind: 'rir'; rir: Amount }
  | { kind: 'rpe'; rpe: Amount; scale: RpeScale }
  | {
      kind: 'rir_and_rpe';
      rir: Amount;
      rpe: Amount;
      scale: Exclude<RpeScale, 'rir_based'>;
      justification: string;
    }
  | { kind: 'character'; performed: number; possible: number }
  | { kind: 'quality'; focus: string };

export type EffortKind = EffortTargetV2['kind'];

export const RPE_SCALE_LABELS: Record<RpeScale, string> = {
  rir_based: 'escala basada en RIR',
  omni_res: 'OMNI-RES',
  borg_cr10: 'Borg CR10',
};

const SCALES: readonly RpeScale[] = ['rir_based', 'omni_res', 'borg_cr10'];

function amountIssues(
  value: Amount,
  path: string,
  valid: (n: number) => boolean,
  message: string,
): Issue[] {
  if (typeof value === 'number') return valid(value) ? [] : [issue(path, message)];
  if (!valid(value.min) || !valid(value.max)) return [issue(path, message)];
  return value.min < value.max
    ? []
    : [issue(path, 'En un rango, el mínimo debe ser menor que el máximo.')];
}

const validRir = (n: number) => isInt(n, 0, 10);
const validRpe = (n: number) => inRange(n, 1, 10) && isMultipleOf(n, 0.5);

/** Validación del objetivo de esfuerzo según el tipo de repeticiones de la serie. */
export function effortIssues(effort: EffortTargetV2, reps: RepTarget, path: string): Issue[] {
  const byTime = reps.kind === 'seconds' || reps.kind === 'meters';
  switch (effort.kind) {
    case 'none':
      return [];
    case 'rir':
      return byTime
        ? [
            issue(
              path,
              'El RIR se define en repeticiones: no se usa en series por tiempo o distancia.',
            ),
          ]
        : amountIssues(effort.rir, `${path}.rir`, validRir, 'El RIR debe ser un entero de 0 a 10.');
    case 'rpe':
      return [
        ...amountIssues(
          effort.rpe,
          `${path}.rpe`,
          validRpe,
          'El RPE debe estar entre 1 y 10, en pasos de 0,5.',
        ),
        ...(SCALES.includes(effort.scale)
          ? []
          : [issue(`${path}.scale`, 'Indica la escala del RPE.')]),
      ];
    case 'rir_and_rpe': {
      const issues = [
        ...(byTime ? [issue(path, 'El RIR no se usa en series por tiempo o distancia.')] : []),
        ...amountIssues(
          effort.rir,
          `${path}.rir`,
          validRir,
          'El RIR debe ser un entero de 0 a 10.',
        ),
        ...amountIssues(
          effort.rpe,
          `${path}.rpe`,
          validRpe,
          'El RPE debe estar entre 1 y 10, en pasos de 0,5.',
        ),
      ];
      if ((effort.scale as string) === 'rir_based' || !SCALES.includes(effort.scale)) {
        issues.push(
          issue(
            `${path}.scale`,
            'Con la escala basada en RIR, RIR y RPE son el mismo dato: elige solo uno.',
          ),
        );
      }
      if (!textWithin(effort.justification, 3, 200)) {
        issues.push(issue(`${path}.justification`, 'Explica por qué se piden RIR y RPE a la vez.'));
      }
      return issues;
    }
    case 'character':
      return isInt(effort.performed, 1, 200) &&
        isInt(effort.possible, 1, 200) &&
        effort.performed <= effort.possible
        ? []
        : [
            issue(
              path,
              'En el carácter del esfuerzo, las realizadas no pueden superar a las realizables.',
            ),
          ];
    case 'quality':
      return textWithin(effort.focus, 1, 200)
        ? []
        : [issue(`${path}.focus`, 'Describe el criterio de calidad.')];
  }
}

const amountText = (value: Amount) =>
  typeof value === 'number'
    ? formatNumber(value)
    : `${formatNumber(value.min)}–${formatNumber(value.max)}`;

/** Texto breve del objetivo («RIR 2», «RPE 7–8»), o `null` si no hay objetivo de esfuerzo. */
export function describeEffort(effort: EffortTargetV2): string | null {
  switch (effort.kind) {
    case 'none':
      return null;
    case 'rir':
      return `RIR ${amountText(effort.rir)}`;
    case 'rpe':
      return `RPE ${amountText(effort.rpe)}`;
    case 'rir_and_rpe':
      return `RIR ${amountText(effort.rir)} · RPE ${amountText(effort.rpe)}`;
    case 'character':
      return `Carácter ${effort.performed} (${effort.possible})`;
    case 'quality':
      return 'Prioridad: calidad';
  }
}
