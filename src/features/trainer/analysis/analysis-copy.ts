import { type Comparison, type Condition, type ProposalMatch } from '@/domain/analysis/compare';
import { type DurationGap } from '@/domain/analysis/duration';
import {
  REFERENCE_BASIS_TEXT,
  type SessionReference,
  UNDETERMINED_REASON_TEXT,
} from '@/domain/analysis/reference';
import {
  type ConditionCounts,
  type ExerciseStatus,
  type Interval,
  type SetStatus,
  type TonnageExclusion,
} from '@/domain/analysis/session';
import { formatNumber, formatSeconds } from '@/domain/format';

/**
 * Textos del análisis (B3.1). Funciones puras para poder probar el vocabulario:
 * - solo el permitido por P-91 («coincide», «distinto de lo prescrito», «dentro del rango»,
 *   «fuera del rango», «sin dato», «no aplica»…) más «no comparable» y «no evaluable»;
 * - nunca «incumplimiento», «mal», «más exigente», ni «medido», «verificado» o «confirmado» para
 *   un valor (P-120): «Serie hecha» confirma el registro, no una medición de cada valor.
 */
export const CONDITION_LABEL: Record<Condition, string> = {
  matches: 'coincide',
  differs: 'distinto de lo prescrito',
  within: 'dentro del rango',
  below: 'fuera del rango, por debajo',
  above: 'fuera del rango, por encima',
  no_data: 'sin dato',
  not_applicable: 'no aplica',
  not_comparable: 'no comparable',
  not_evaluable: 'no evaluable',
};

export const SET_STATUS_LABEL: Record<SetStatus, string> = {
  done: 'Hecha',
  not_done: 'No realizada',
  unregistered: 'Sin registrar',
};

export const EXERCISE_STATUS_LABEL: Record<ExerciseStatus, string> = {
  complete: 'completo',
  partial: 'parcial',
  not_done: 'no realizado',
  unregistered: 'sin registrar',
};

export const PROPOSAL_LABEL: Record<ProposalMatch, string> = {
  equal: 'igual a lo propuesto',
  different: 'distinto de lo propuesto',
  absent: 'sin valor',
  not_comparable: 'no comparable',
};

export const TONNAGE_EXCLUSION_TEXT: Record<TonnageExclusion, string> = {
  per_side_basis: 'carga «por lado»: falta el peso de la barra o del soporte',
  reps_per_side: 'repeticiones «por lado» (P-96, pendiente)',
  self_selected: 'carga elegida por la clienta: su prescripción no tiene base (P-115)',
  percent_unresolved: '%1RM sin kg resueltos al publicar',
  not_by_reps: 'series por tiempo o distancia: no se multiplican metros ni segundos por kg',
};

const num = (value: number, digits = 2) => formatNumber(value, digits);
const signed = (value: number, digits = 2) =>
  `${value > 0 ? '+' : '−'}${num(Math.abs(value), digits)}`;

const UNIT: Record<NonNullable<Comparison['unit']>, string> = {
  rep: 'rep.',
  s: 's',
  m: 'm',
  kg: 'kg',
  rir: '',
  rpe: '',
};

/** Nivel 1: «−1 rep.», «−3 kg (−7,5 %)», «RIR −1», «−1 respecto al mínimo»… (`null` si no hay diferencia). */
export function differenceText(c: Comparison): string | null {
  if (c.difference === null || c.unit === null) return null;
  const amount =
    c.unit === 'rir' || c.unit === 'rpe'
      ? `${c.unit.toUpperCase()} ${signed(c.difference, 1)}`
      : `${signed(c.difference)} ${UNIT[c.unit]}`;
  const prefix =
    c.label === 'added_kg' ? 'lastre ' : c.label === 'assistance_kg' ? 'asistencia ' : '';
  const bound =
    c.condition === 'below'
      ? ' respecto al mínimo'
      : c.condition === 'above'
        ? ' respecto al máximo'
        : '';
  const percent = c.differencePercent !== null ? ` (${signed(c.differencePercent, 1)} %)` : '';
  return `${prefix}${amount}${bound}${percent}`;
}

const MEASURE_NAME: Record<Comparison['measure'], string> = {
  reps: 'Repeticiones',
  seconds: 'Tiempo',
  meters: 'Distancia',
  load: 'Carga',
  rir: 'RIR',
  rpe: 'RPE',
};

/** «Carga: distinto de lo prescrito (−3 kg, −7,5 %)». */
export function comparisonText(c: Comparison): string {
  const diff = differenceText(c);
  const name =
    c.label === 'added_kg'
      ? 'Lastre'
      : c.label === 'assistance_kg'
        ? 'Asistencia'
        : MEASURE_NAME[c.measure];
  return `${name}: ${CONDITION_LABEL[c.condition]}${diff ? ` (${diff})` : ''}`;
}

const EVALUATED_KEYS = ['matches', 'within', 'differs', 'below', 'above'] as const;
const ASIDE_KEYS = ['no_data', 'not_applicable', 'not_comparable', 'not_evaluable'] as const;

export const evaluatedCount = (counts: ConditionCounts) =>
  EVALUATED_KEYS.reduce((n, k) => n + counts[k], 0);

/**
 * Resumen de una dimensión con su denominador: «2 de 3 series coinciden · 1 distinta», y aparte
 * «sin dato», «no aplica», «no comparable» y «no evaluable» (fuera del denominador).
 */
export function countsText(counts: ConditionCounts): { main: string | null; aside: string[] } {
  const total = evaluatedCount(counts);
  const parts: string[] = [];
  const asPrescribed = counts.matches + counts.within;
  if (total > 0) {
    parts.push(
      `${asPrescribed} de ${total} ${total === 1 ? 'serie' : 'series'} ${counts.within > 0 && counts.matches === 0 ? 'dentro del rango' : counts.within > 0 ? 'coinciden o dentro del rango' : asPrescribed === 1 ? 'coincide' : 'coinciden'}`,
    );
    if (counts.differs > 0)
      parts.push(`${counts.differs} ${counts.differs === 1 ? 'distinta' : 'distintas'}`);
    if (counts.below > 0) parts.push(`${counts.below} por debajo del rango`);
    if (counts.above > 0) parts.push(`${counts.above} por encima del rango`);
  }
  const aside = ASIDE_KEYS.filter((k) => counts[k] > 0).map(
    (k) => `${counts[k]} ${CONDITION_LABEL[k]}`,
  );
  return { main: parts.length > 0 ? parts.join(' · ') : null, aside };
}

/** Un valor o un intervalo: «30» o «24–30». */
export const intervalText = (value: Interval | null, unit = '', digits = 2): string | null => {
  if (value === null) return null;
  const suffix = unit ? ` ${unit}` : '';
  return value.min === value.max
    ? `${num(value.min, digits)}${suffix}`
    : `${num(value.min, digits)}–${num(value.max, digits)}${suffix}`;
};

export const secondsText = (value: number | null) => (value === null ? null : formatSeconds(value));

export const minutesText = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/** Frase completa: «Se compara con la v2 (versión del último registro de la sesión).» o la de no determinada. */
export function referenceText(reference: SessionReference): string {
  return reference.kind === 'determined'
    ? `Se compara con la v${reference.version} (${REFERENCE_BASIS_TEXT[reference.basis]}).`
    : `Referencia histórica no determinada: ${UNDETERMINED_REASON_TEXT[reference.reason]}`;
}

/** «hh:mm» en una zona. */
export function timeText(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(instant),
  );
}

/** «9 nov, 21:10» en una zona. */
export function dateTimeText(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
    .format(new Date(instant))
    .replace('.', '');
}

const ACTIVITY: Record<DurationGap['fromActivity'], string> = {
  start: 'el inicio',
  set: 'una serie',
  finish: 'el fin',
};

/** Texto de un hueco, sin decir dónde estuvieron las pausas ni descontar nada. */
export function gapText(gap: DurationGap, timeZone: string): string {
  const span = `${minutesText(gap.seconds)} sin actividad registrada entre ${ACTIVITY[gap.fromActivity]} (${dateTimeText(gap.from, timeZone)}) y ${ACTIVITY[gap.toActivity]} (${dateTimeText(gap.to, timeZone)})`;
  switch (gap.level) {
    case 'warning':
      return `Advertencia: ${span}. Supera en más de 30 min el total de pausas registradas, así que la duración puede no representar el tiempo real de entrenamiento.`;
    case 'notice':
      return `Aviso: ${span}. Las pausas registradas podrían explicarlo; no se sabe dónde ocurrieron.`;
    case 'not_evaluable':
      return `Hueco no evaluable: ${span}. Alguna de sus dos horas se ajustó porque el reloj del móvil no era fiable.`;
  }
}

/** «en su día», «1 día después», «2 días antes». */
export function offsetText(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'en su día';
  const n = Math.abs(days);
  return `${n} ${n === 1 ? 'día' : 'días'} ${days > 0 ? 'después' : 'antes'}`;
}

/** «28 dic 2026» (fecha civil, sin zona). */
export function shortDateText(date: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '');
}

/** «28 dic 2026 – 3 ene 2027» (AC-B3-14). */
export const weekRangeText = (week: { start: string; end: string }) =>
  `${shortDateText(week.start)} – ${shortDateText(week.end)}`;

/** Número y año ISO de una clave «2026-W53». */
export function weekParts(key: string): { year: number; week: number } {
  const [year, n] = key.split('-W') as [string, string];
  return { year: Number(year), week: Number(n) };
}

/** «Semana 53 de 2026 (ISO): 28 dic 2026 – 3 ene 2027». */
export function weekText(week: { key: string; start: string; end: string }): string {
  const { year, week: n } = weekParts(week.key);
  return `Semana ${n} de ${year} (ISO): ${weekRangeText(week)}`;
}

/** Palabras que el análisis no usa (P-91, P-120). Lo comprueban las pruebas. */
export const FORBIDDEN_WORDS = [
  /incumpl/i,
  /no cumplid/i,
  /\bmal\b/i,
  /más exigente/i,
  /menos exigente/i,
  /\bmedid[oa]s?\b/i,
  /verificad[oa]s?/i,
  /\bconfirmad[oa]s? individualmente/i,
  /carga medida/i,
  /diagnóstic/i,
];
