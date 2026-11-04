import { type Measurement, type Unit } from './measurement';
import { type IsoDate } from './time';

export type AssessmentCategory =
  'jump' | 'sprint' | 'change_of_direction' | 'strength' | 'function';

export const ASSESSMENT_CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  jump: 'Salto',
  sprint: 'Sprint y aceleración',
  change_of_direction: 'Cambio de dirección',
  strength: 'Fuerza',
  function: 'Capacidad funcional',
};

/**
 * Prueba del catálogo. En la Fase 1 todas están en `protocol_pending`: aún no tienen protocolo,
 * fórmulas ni valores de referencia verificados, así que no se interpretan resultados.
 */
export interface AssessmentTest {
  id: string;
  name: string;
  category: AssessmentCategory;
  outcome: { name: string; unit: Unit | null };
  /** `lower` cuando un valor menor es mejor (p. ej., tiempos de sprint). */
  betterWhen: 'higher' | 'lower';
  status: 'protocol_pending' | 'ready';
}

export const ASSESSMENT_CATALOG: readonly AssessmentTest[] = [
  {
    id: 'cmj',
    name: 'Salto con contramovimiento (CMJ)',
    category: 'jump',
    outcome: { name: 'Altura de salto', unit: 'cm' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'sj',
    name: 'Squat jump (SJ)',
    category: 'jump',
    outcome: { name: 'Altura de salto', unit: 'cm' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'cmj-unilateral',
    name: 'CMJ unilateral',
    category: 'jump',
    outcome: { name: 'Altura de salto por pierna', unit: 'cm' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'rsi-mod',
    name: 'RSI modificado',
    category: 'jump',
    outcome: { name: 'Índice (definición pendiente de verificar)', unit: null },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'sprint-10',
    name: 'Sprint 10 m',
    category: 'sprint',
    outcome: { name: 'Tiempo', unit: 's' },
    betterWhen: 'lower',
    status: 'protocol_pending',
  },
  {
    id: 'sprint-20',
    name: 'Sprint 20 m',
    category: 'sprint',
    outcome: { name: 'Tiempo', unit: 's' },
    betterWhen: 'lower',
    status: 'protocol_pending',
  },
  {
    id: 'sprint-30',
    name: 'Sprint 30 m',
    category: 'sprint',
    outcome: { name: 'Tiempo', unit: 's' },
    betterWhen: 'lower',
    status: 'protocol_pending',
  },
  {
    id: 'cod-505',
    name: 'Cambio de dirección 505',
    category: 'change_of_direction',
    outcome: { name: 'Tiempo', unit: 's' },
    betterWhen: 'lower',
    status: 'protocol_pending',
  },
  {
    id: '1rm-direct',
    name: '1RM directa',
    category: 'strength',
    outcome: { name: 'Carga máxima', unit: 'kg' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'rm-estimate',
    name: 'Estimación de RM',
    category: 'strength',
    outcome: { name: 'RM estimada (ecuación por verificar)', unit: 'kg' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
  {
    id: 'chair-stand-30',
    name: 'Levantarse de la silla en 30 s',
    category: 'function',
    outcome: { name: 'Repeticiones', unit: 'reps' },
    betterWhen: 'higher',
    status: 'protocol_pending',
  },
];

export function findAssessmentTest(id: string): AssessmentTest | undefined {
  return ASSESSMENT_CATALOG.find((test) => test.id === id);
}

export interface AssessmentResult {
  id: string;
  clientId: string;
  testId: string;
  date: IsoDate;
  measurement: Measurement;
  note?: string;
}

export type Comparison =
  | { comparable: true; absolute: number; percent: number; improved: boolean | null }
  | { comparable: false; reason: string };

/**
 * Compara dos resultados de la misma prueba. Solo es válido si coinciden la unidad, el método
 * y el instrumento; si no, la diferencia podría deberse al método y no al cliente.
 * Nota: saber si un cambio es *relevante* exige datos de fiabilidad (fases posteriores).
 */
export function compareResults(
  previous: AssessmentResult,
  current: AssessmentResult,
  betterWhen: AssessmentTest['betterWhen'],
): Comparison {
  const [a, b] = [previous.measurement, current.measurement];
  if (previous.testId !== current.testId)
    return { comparable: false, reason: 'Son pruebas distintas.' };
  if (a.unit !== b.unit) return { comparable: false, reason: 'Las unidades no coinciden.' };
  if (
    a.provenance.method !== b.provenance.method ||
    a.provenance.instrument !== b.provenance.instrument
  ) {
    return { comparable: false, reason: 'El método o el instrumento no coinciden.' };
  }
  if (a.value === 0) return { comparable: false, reason: 'El valor de partida es 0.' };
  const absolute = b.value - a.value;
  const improved = absolute === 0 ? null : betterWhen === 'higher' ? absolute > 0 : absolute < 0;
  return { comparable: true, absolute, percent: (absolute / a.value) * 100, improved };
}

/** Resultados agrupados por prueba y ordenados por fecha (del más antiguo al más reciente). */
export function groupByTest(results: readonly AssessmentResult[]): Map<string, AssessmentResult[]> {
  const groups = new Map<string, AssessmentResult[]>();
  for (const result of [...results].sort((a, b) => a.date.localeCompare(b.date))) {
    groups.set(result.testId, [...(groups.get(result.testId) ?? []), result]);
  }
  return groups;
}
