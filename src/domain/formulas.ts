import { type FormulaRef, type Unit } from './measurement';
import { type IsoDate } from './time';

/**
 * Registro de fórmulas. Cada cálculo de TrainPro se identifica por id + versión, de modo que
 * un resultado guardado siempre puede rastrearse hasta la definición exacta que lo produjo.
 *
 * - `operational_definition`: definiciones aritméticas acordadas (p. ej., sumar repeticiones).
 *   No dependen de un estudio, pero se documentan igualmente con sus limitaciones.
 * - `scientific_formula`: ecuaciones procedentes de la literatura (p. ej., estimaciones de RM).
 *   Exigen al menos una referencia verificada. En la Fase 1 no se incluye ninguna: se
 *   incorporarán en la fase de evaluación, tras verificar cada fuente primaria.
 */
export type FormulaKind = 'operational_definition' | 'scientific_formula';

export interface Reference {
  citation: string;
  doi?: string;
  pmid?: string;
  /** Fecha en la que alguien comprobó la fuente primaria. */
  verifiedOn: IsoDate;
}

export interface FormulaDefinition extends FormulaRef {
  kind: FormulaKind;
  name: string;
  expression: string;
  output: { name: string; unit: Unit | null };
  limitations: string[];
  references: Reference[];
}

export const FORMULA_REGISTRY: readonly FormulaDefinition[] = [
  {
    id: 'training.completed-sets',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Series completadas',
    expression: 'Número de series registradas como completadas.',
    output: { name: 'Series', unit: null },
    limitations: ['No distingue la intensidad ni el esfuerzo de cada serie.'],
    references: [],
  },
  {
    id: 'training.total-reps',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Repeticiones totales',
    expression: 'Suma de las repeticiones de las series completadas.',
    output: { name: 'Repeticiones', unit: 'reps' },
    limitations: [
      'Solo tiene sentido para ejercicios prescritos por repeticiones.',
      'Las series por tiempo o distancia cuentan como serie completada, pero no suman repeticiones.',
    ],
    references: [],
  },
  {
    id: 'training.volume-load',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Tonelaje (volumen-carga)',
    expression:
      'Suma de (repeticiones × carga externa en kg) de las series completadas con carga externa.',
    output: { name: 'Tonelaje', unit: 'kg' },
    limitations: [
      'No incluye el peso corporal ni el recorrido del movimiento: no equivale a trabajo mecánico.',
      'Las series sin carga externa en kg se excluyen y se cuentan aparte.',
      'Sumar tonelaje de ejercicios distintos solo sirve como orientación general.',
      'En ejercicios unilaterales se usan las repeticiones tal como se prescriben (p. ej., por pierna).',
    ],
    references: [],
  },
];

export function findFormula(
  ref: FormulaRef,
  registry: readonly FormulaDefinition[] = FORMULA_REGISTRY,
): FormulaDefinition | undefined {
  return registry.find((formula) => formula.id === ref.id && formula.version === ref.version);
}

export const isRegisteredFormula = (ref: FormulaRef) => findFormula(ref) !== undefined;

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Reglas de integridad del registro; se comprueban en los tests. */
export function registryIssues(registry: readonly FormulaDefinition[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const formula of registry) {
    const key = `${formula.id}@${formula.version}`;
    if (seen.has(key)) issues.push(`Fórmula duplicada: ${key}.`);
    seen.add(key);
    if (!SEMVER.test(formula.version)) issues.push(`Versión no válida en ${key}.`);
    if (formula.kind === 'scientific_formula' && formula.references.length === 0) {
      issues.push(`${key} es una fórmula científica sin referencias verificadas.`);
    }
    if (formula.limitations.length === 0) issues.push(`${key} no documenta sus limitaciones.`);
  }
  return issues;
}
