import { type Amount } from '../training/effort';
import { type LoadSpec, type PerformedLoad } from '../training/load';
import { defaultPerformed, type PerformedSet } from '../training/performance';
import { type SetTarget } from '../training/session-v2';

/**
 * Comparación de una serie con su prescripción, dimensión a dimensión (P-91; BLOCK3_SPEC §3.2
 * y §5.1). Tolerancia cero: toda diferencia se muestra. Dos niveles, que calcula TrainPro:
 *
 * 1. la diferencia observada (un número con signo, en la unidad de la serie);
 * 2. la condición prescrita (coincide, distinto, dentro o fuera del rango).
 *
 * El tercer nivel, la interpretación, es del entrenador: aquí no hay juicios.
 */
export type Condition =
  | 'matches'
  | 'differs'
  | 'within'
  | 'below'
  | 'above'
  /** Se prescribió y no se registró (un dato opcional que falta). */
  | 'no_data'
  /** No hay nada que comparar por diseño (sin objetivo, peso corporal, autoseleccionada…). */
  | 'not_applicable'
  /** Hay objetivo y valor, pero en magnitudes, modalidades o escalas distintas. */
  | 'not_comparable'
  /** Hay objetivo, pero su forma no se puede evaluar de forma inequívoca (carácter, %1RM sin resolver…). */
  | 'not_evaluable';

export const EVALUATED: readonly Condition[] = ['matches', 'differs', 'within', 'below', 'above'];

export type Measure = 'reps' | 'seconds' | 'meters' | 'load' | 'rir' | 'rpe';

export interface Comparison {
  measure: Measure;
  condition: Condition;
  /** Nivel 1, con signo: registrado − prescrito (en un rango, respecto al límite más cercano). */
  difference: number | null;
  /** Solo para kg con un valor fijo prescrito. */
  differencePercent: number | null;
  /** Unidad de la diferencia. */
  unit: 'rep' | 's' | 'm' | 'kg' | 'rir' | 'rpe' | null;
  /** Qué se compara cuando hay más de una magnitud de carga («lastre», «asistencia»). */
  label?: 'kg' | 'added_kg' | 'assistance_kg' | 'descriptor';
  /** Motivo de «no aplica», «no comparable» o «no evaluable». */
  reason?: string;
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function againstAmount(
  measure: Measure,
  unit: Comparison['unit'],
  value: number,
  amount: Amount,
  withPercent = false,
): Comparison {
  if (typeof amount === 'number') {
    const difference = round(value - amount);
    return {
      measure,
      unit,
      condition: difference === 0 ? 'matches' : 'differs',
      difference: difference === 0 ? null : difference,
      differencePercent:
        withPercent && difference !== 0 && amount !== 0
          ? round((difference / amount) * 100, 1)
          : null,
    };
  }
  if (value < amount.min) {
    return {
      measure,
      unit,
      condition: 'below',
      difference: round(value - amount.min),
      differencePercent: null,
    };
  }
  if (value > amount.max) {
    return {
      measure,
      unit,
      condition: 'above',
      difference: round(value - amount.max),
      differencePercent: null,
    };
  }
  return { measure, unit, condition: 'within', difference: null, differencePercent: null };
}

const special = (
  measure: Measure,
  condition: Condition,
  reason?: string,
  label?: Comparison['label'],
): Comparison => ({
  measure,
  condition,
  difference: null,
  differencePercent: null,
  unit: null,
  ...(label ? { label } : {}),
  ...(reason ? { reason } : {}),
});

/** Repeticiones, segundos o metros (dimensión cuantitativa). */
export function compareQuantity(target: SetTarget, set: PerformedSet): Comparison {
  const reps = target.reps;
  switch (reps.kind) {
    case 'fixed':
    case 'range':
      return set.reps === undefined
        ? special('reps', 'not_comparable', 'La serie se registró en otra magnitud.')
        : againstAmount(
            'reps',
            'rep',
            set.reps,
            reps.kind === 'fixed' ? reps.reps : { min: reps.min, max: reps.max },
          );
    case 'seconds':
      return set.durationS === undefined || set.reps !== undefined || set.distanceM !== undefined
        ? special('seconds', 'not_comparable', 'La serie se registró en otra magnitud.')
        : againstAmount('seconds', 's', set.durationS, reps.seconds);
    case 'meters':
      return set.distanceM === undefined
        ? special('meters', 'not_comparable', 'La serie se registró en otra magnitud.')
        : againstAmount('meters', 'm', set.distanceM, reps.meters);
  }
}

const sameText = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

function prescribedDescriptor(load: LoadSpec): string | null {
  switch (load.kind) {
    case 'elastic':
      return load.descriptor;
    case 'device':
      return load.unit ? `${load.setting} ${load.unit}` : load.setting;
    case 'other':
      return load.text;
    default:
      return null;
  }
}

/** Carga (dimensión de intensidad), siempre en la misma modalidad y base. */
export function compareLoad(target: SetTarget, set: PerformedSet): Comparison {
  const load = target.load;
  const done: PerformedLoad | undefined = set.load;
  switch (load.kind) {
    case 'bodyweight':
      return special('load', 'not_applicable', 'Peso corporal: no hay kg que comparar.');
    case 'none':
      return special('load', 'not_applicable', 'Sin carga.');
    case 'self_selected':
      return special(
        'load',
        'not_applicable',
        'Carga a elegir por la clienta: no hay valor prescrito.',
      );
    case 'external':
    case 'external_range':
    case 'percent_1rm': {
      if (done?.kind !== 'external')
        return special('load', 'not_comparable', 'Modalidad de carga distinta.', 'kg');
      if (load.kind === 'percent_1rm') {
        if (!load.resolution)
          return special('load', 'not_evaluable', '%1RM sin kg resueltos al publicar.', 'kg');
        return { ...againstAmount('load', 'kg', done.kg, load.resolution.kg, true), label: 'kg' };
      }
      return {
        ...againstAmount(
          'load',
          'kg',
          done.kg,
          load.kind === 'external' ? load.kg : { min: load.minKg, max: load.maxKg },
          load.kind === 'external',
        ),
        label: 'kg',
      };
    }
    case 'bodyweight_plus':
      if (done?.kind !== 'bodyweight_plus')
        return special('load', 'not_comparable', 'Modalidad de carga distinta.', 'added_kg');
      return { ...againstAmount('load', 'kg', done.addedKg, load.addedKg), label: 'added_kg' };
    case 'assisted':
      if (done?.kind !== 'assisted')
        return special('load', 'not_comparable', 'Modalidad de carga distinta.', 'assistance_kg');
      if (load.assistanceKg === undefined) {
        return special('load', 'not_applicable', 'Asistencia sin kg prescritos.', 'assistance_kg');
      }
      if (done.assistanceKg === null) return special('load', 'no_data', undefined, 'assistance_kg');
      return {
        ...againstAmount('load', 'kg', done.assistanceKg, load.assistanceKg),
        label: 'assistance_kg',
      };
    case 'elastic':
    case 'device':
    case 'other': {
      if (done?.kind !== load.kind)
        return special('load', 'not_comparable', 'Modalidad de carga distinta.', 'descriptor');
      const expected = prescribedDescriptor(load)!;
      if (done.descriptor === null) return special('load', 'no_data', undefined, 'descriptor');
      return {
        measure: 'load',
        unit: null,
        label: 'descriptor',
        condition: sameText(done.descriptor, expected) ? 'matches' : 'differs',
        difference: null,
        differencePercent: null,
      };
    }
  }
}

/** Esfuerzo: RIR y RPE por separado, cada uno en su escala. Nunca se convierten entre sí. */
export function compareEffort(
  target: SetTarget,
  set: PerformedSet & { rpeScale?: string },
): Comparison[] {
  const effort = target.effort;
  switch (effort.kind) {
    case 'none':
      return [];
    case 'character':
      return [
        special(
          'rir',
          'not_evaluable',
          'Objetivo de carácter del esfuerzo: no hay nada registrable que comparar.',
        ),
      ];
    case 'quality':
      return [
        special(
          'rir',
          'not_evaluable',
          'Objetivo de calidad: no hay nada registrable que comparar.',
        ),
      ];
    case 'rir':
      return [rirComparison(effort.rir, set)];
    case 'rpe':
      return [rpeComparison(effort.rpe, effort.scale, set)];
    case 'rir_and_rpe':
      return [rirComparison(effort.rir, set), rpeComparison(effort.rpe, effort.scale, set)];
  }
}

const rirComparison = (amount: Amount, set: PerformedSet): Comparison =>
  set.rir === undefined ? special('rir', 'no_data') : againstAmount('rir', 'rir', set.rir, amount);

function rpeComparison(
  amount: Amount,
  scale: string,
  set: PerformedSet & { rpeScale?: string },
): Comparison {
  if (set.rpe === undefined) return special('rpe', 'no_data');
  if (set.rpeScale !== undefined && set.rpeScale !== scale) {
    return special('rpe', 'not_comparable', 'El RPE se registró en otra escala.');
  }
  return againstAmount('rpe', 'rpe', set.rpe, amount);
}

// ── P-120 · Igual o distinto de lo propuesto ─────────────────────────────────────────────

export type ProposalMatch = 'equal' | 'different' | 'absent' | 'not_comparable';

export interface ProposalCheck {
  /** Repeticiones, segundos o metros. */
  amount: ProposalMatch;
  /** El valor de carga que pide la serie (kg, lastre, asistencia o descripción); `null` si no pide ninguno. */
  load: ProposalMatch | null;
  /** «different» si algún valor se cambió; «equal» si ninguno (lo que no demuestra que se revisara). */
  overall: 'equal' | 'different';
}

const sameNumber = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? null) === (b ?? null);

function matchOf(
  performed: number | string | null | undefined,
  proposed: number | string | null | undefined,
): ProposalMatch {
  const p = performed ?? null;
  const q = proposed ?? null;
  if (p === null && q === null) return 'absent';
  if (typeof p === 'string' && typeof q === 'string') return sameText(p, q) ? 'equal' : 'different';
  return p === q ? 'equal' : 'different';
}

/**
 * Compara una serie HECHA con lo que el formulario proponía según la versión con la que se
 * registró (`defaultPerformed`). El RIR y el RPE nunca se proponen: no entran.
 */
export function checkProposal(ownTarget: SetTarget, set: PerformedSet): ProposalCheck {
  const proposed = defaultPerformed(ownTarget);
  const amount =
    proposed.reps !== null && proposed.reps !== undefined
      ? matchOf(set.reps, proposed.reps)
      : proposed.durationS !== null && proposed.durationS !== undefined
        ? matchOf(set.durationS, proposed.durationS)
        : matchOf(set.distanceM, proposed.distanceM);
  const want = proposed.load;
  const got = set.load;
  let load: ProposalMatch | null = null;
  if (want && want.kind !== 'bodyweight' && want.kind !== 'none') {
    if (!got || got.kind !== want.kind) load = 'not_comparable';
    else if (want.kind === 'external' && got.kind === 'external') load = matchOf(got.kg, want.kg);
    else if (want.kind === 'bodyweight_plus' && got.kind === 'bodyweight_plus')
      load = matchOf(got.addedKg, want.addedKg);
    else if (want.kind === 'assisted' && got.kind === 'assisted')
      load = matchOf(got.assistanceKg, want.assistanceKg);
    else if ('descriptor' in want && 'descriptor' in got) {
      const kgChanged = !sameNumber(got.kg, want.kg);
      const descriptor = matchOf(got.descriptor, want.descriptor);
      load = kgChanged ? 'different' : descriptor;
    }
  }
  return {
    amount,
    load,
    overall: amount === 'different' || load === 'different' ? 'different' : 'equal',
  };
}

// ── Modalidad (A10): la evolución de un ejercicio solo se compara dentro de la misma ──────

/**
 * Clave y texto de la modalidad de una serie prescrita: tipo de serie (repeticiones, «por lado»,
 * segundos o metros) y modalidad de carga con su base. Si cambia, la evolución se corta (A10).
 */
export function modalityOf(target: SetTarget): { key: string; text: string } {
  const reps = target.reps;
  const kind =
    reps.kind === 'seconds'
      ? ['s', 'por tiempo']
      : reps.kind === 'meters'
        ? ['m', 'por distancia']
        : reps.perSide
          ? ['rep-lado', 'repeticiones por lado']
          : ['rep', 'repeticiones'];
  const load = target.load;
  const [loadKey, loadText] = ((): [string, string] => {
    switch (load.kind) {
      case 'external':
      case 'external_range':
        return load.basis === 'per_implement'
          ? [`kg-impl-${load.implements ?? 2}`, `kg por implemento (× ${load.implements ?? 2})`]
          : load.basis === 'per_side'
            ? ['kg-lado', 'kg por lado']
            : ['kg', 'kg externos'];
      case 'percent_1rm':
        return ['kg', 'kg externos'];
      case 'bodyweight':
        return ['pc', 'peso corporal'];
      case 'bodyweight_plus':
        return ['lastre', 'peso corporal con lastre'];
      case 'assisted':
        return ['asistida', 'asistida'];
      case 'elastic':
        return ['banda', 'banda elástica'];
      case 'device':
        return ['maquina', 'ajuste de máquina'];
      case 'self_selected':
        return ['elegida', 'carga a elegir'];
      case 'none':
        return ['sin-carga', 'sin carga'];
      case 'other':
        return ['otra', 'otra carga'];
    }
  })();
  return { key: `${kind[0]}|${loadKey}`, text: `${kind[1]} · ${loadText}` };
}
