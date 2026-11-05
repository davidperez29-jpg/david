import { type FormulaRef, type Measurement, type Unit } from './measurement';
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

export type AttemptAggregation = 'best' | 'mean';

export const AGGREGATION_LABELS: Record<AttemptAggregation, string> = {
  best: 'Mejor intento',
  mean: 'Promedio de intentos',
};

export const AGGREGATION_FORMULAS: Record<AttemptAggregation, FormulaRef> = {
  best: { id: 'assessment.best-attempt', version: '1.0.0' },
  mean: { id: 'assessment.mean-attempts', version: '1.0.0' },
};

export interface AssessmentResult {
  id: string;
  clientId: string;
  testId: string;
  date: IsoDate;
  /**
   * Resultado de la prueba. Si hay intentos, es un valor calculado (procedencia `calculated`)
   * con la fórmula de la regla de agregación; los intentos conservan su procedencia original.
   */
  measurement: Measurement;
  attempts?: Measurement[];
  aggregation?: AttemptAggregation;
  note?: string;
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Implementa assessment.best-attempt y assessment.mean-attempts (v1.0.0). */
export function aggregateAttempts(
  values: readonly number[],
  rule: AttemptAggregation,
  betterWhen: AssessmentTest['betterWhen'],
): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) throw new RangeError('No hay intentos válidos.');
  if (rule === 'mean') return round4(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  return betterWhen === 'higher' ? Math.max(...valid) : Math.min(...valid);
}

/** Coherencia de un resultado con sus intentos (se comprueba en los tests de los datos). */
export function resultIssues(result: AssessmentResult): string[] {
  const issues: string[] = [];
  const test = findAssessmentTest(result.testId);
  if (!test) return [`Prueba desconocida: ${result.testId}.`];
  if (result.attempts && result.attempts.length > 0) {
    if (!result.aggregation) issues.push('Hay intentos pero no se indica la regla de agregación.');
    else {
      const expected = aggregateAttempts(
        result.attempts.map((a) => a.value),
        result.aggregation,
        test.betterWhen,
      );
      if (Math.abs(expected - result.measurement.value) > 1e-9) {
        issues.push(
          `El resultado (${result.measurement.value}) no coincide con la regla (${expected}).`,
        );
      }
      const formula = AGGREGATION_FORMULAS[result.aggregation];
      const used = result.measurement.provenance.formula;
      if (
        result.measurement.provenance.origin !== 'calculated' ||
        used?.id !== formula.id ||
        used.version !== formula.version
      ) {
        issues.push('Un resultado agregado debe ser «calculado» con la fórmula de su regla.');
      }
    }
    if (result.attempts.some((a) => a.unit !== result.measurement.unit))
      issues.push('Los intentos usan otra unidad.');
  }
  return issues;
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
  if ((previous.aggregation ?? null) !== (current.aggregation ?? null)) {
    return { comparable: false, reason: 'La regla de agregación de intentos no coincide.' };
  }
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
