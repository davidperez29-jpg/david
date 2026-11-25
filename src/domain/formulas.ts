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
  // ── Análisis de la sesión (bloque 3, B3.1; docs/BLOCK3_SPEC.md §12) ──────────────────────
  // Todas son definiciones operativas (de diseño), no fórmulas científicas: no miden el
  // estímulo, la fatiga ni la adaptación.
  {
    id: 'training.prescribed-volume',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Volumen prescrito',
    expression:
      'Por tipo de serie: número de series y suma de repeticiones, segundos o metros prescritos en la referencia de cada serie (original o vigente). Un rango suma como [mínimo, máximo].',
    output: { name: 'Volumen prescrito', unit: null },
    limitations: [
      'Cada magnitud va por separado: no se suman repeticiones, segundos ni metros.',
      'Las series cuya referencia histórica no está determinada no entran: se cuentan aparte.',
    ],
    references: [],
  },
  {
    id: 'training.total-reps',
    version: '2.0.0',
    kind: 'operational_definition',
    name: 'Repeticiones registradas',
    expression:
      'Suma de las repeticiones de las series hechas que se prescriben en repeticiones. Las prescritas «por lado» se suman aparte.',
    output: { name: 'Repeticiones', unit: 'reps' },
    limitations: [
      'Es lo que registró la clienta: las repeticiones se proponen con lo prescrito y una cifra igual a la propuesta puede no haberse revisado (P-120).',
      'No incluye las series por tiempo o distancia.',
    ],
    references: [],
  },
  {
    id: 'training.duration-total',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Tiempo registrado en series por tiempo',
    expression: 'Suma de los segundos de las series hechas que se prescriben en segundos.',
    output: { name: 'Tiempo', unit: 's' },
    limitations: [
      'No es la duración de la sesión ni incluye descansos.',
      'El tiempo se propone con lo prescrito (P-120).',
    ],
    references: [],
  },
  {
    id: 'training.distance-total',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Distancia registrada',
    expression: 'Suma de los metros de las series hechas que se prescriben en metros.',
    output: { name: 'Distancia', unit: 'm' },
    limitations: ['La distancia se propone con lo prescrito (P-120).'],
    references: [],
  },
  {
    id: 'training.volume-load',
    version: '2.0.0',
    kind: 'operational_definition',
    name: 'Tonelaje externo nominal',
    expression:
      'Suma de (repeticiones × kg externos declarados) de las series hechas por repeticiones, con la base de la carga prescrita: «total» tal cual; «por implemento», multiplicado por el número de implementos prescrito.',
    output: { name: 'Tonelaje externo nominal', unit: 'kg' },
    limitations: [
      'Son kg declarados, no la carga realmente desplazada ni el trabajo mecánico: no representa el estímulo ni la fatiga.',
      'Sin calcular, con su motivo: carga «por lado» (falta el peso de la barra), repeticiones «por lado» (P-96), carga autoseleccionada (P-115), %1RM sin resolver y series por tiempo o distancia.',
      'No incluye peso corporal, lastre ni asistencia.',
      '«Por implemento» supone implementos iguales: no se puede registrar uno distinto en cada mano.',
      'Sumar tonelaje de ejercicios distintos solo es una orientación general.',
    ],
    references: [],
  },
  {
    id: 'training.prescribed-volume-load',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Tonelaje externo nominal prescrito',
    expression:
      'La misma definición que training.volume-load 2.0.0 sobre lo prescrito en la referencia de cada serie. Los rangos de repeticiones o de kg dan un intervalo [mínimo, máximo].',
    output: { name: 'Tonelaje prescrito', unit: 'kg' },
    limitations: [
      'Las mismas exclusiones que training.volume-load 2.0.0.',
      'Las series sin referencia histórica determinada no entran.',
    ],
    references: [],
  },
  {
    id: 'training.rep-deviation',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Diferencia de repeticiones, tiempo o distancia',
    expression:
      'Registrado − prescrito, en la unidad de la serie. En un rango: 0 si está dentro; si no, respecto al límite más cercano.',
    output: { name: 'Diferencia', unit: null },
    limitations: [
      'Tolerancia cero (P-91): toda diferencia se muestra; mostrarla no es un juicio.',
      'Solo entre la misma magnitud: si la serie se registró en otra, «no comparable».',
    ],
    references: [],
  },
  {
    id: 'training.load-deviation',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Diferencia de carga',
    expression:
      'En la misma modalidad y base: kg registrados − kg prescritos (y el porcentaje sobre lo prescrito si es un valor fijo); en un rango, respecto al límite más cercano. Lastre y asistencia, en su propia magnitud. Bandas, máquina u «otra»: misma descripción o distinta.',
    output: { name: 'Diferencia de carga', unit: 'kg' },
    limitations: [
      'Peso corporal, sin carga y carga autoseleccionada: «no aplica».',
      'Modalidades distintas: «no comparable». %1RM sin resolver: «no evaluable».',
      'La carga se propone con lo prescrito (P-120).',
    ],
    references: [],
  },
  {
    id: 'training.effort-deviation',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Diferencia de esfuerzo',
    expression:
      'RIR registrado − RIR prescrito, o RPE registrado − RPE prescrito en la misma escala. En un rango, respecto al límite más cercano.',
    output: { name: 'Diferencia de esfuerzo', unit: null },
    limitations: [
      'Nunca se convierte el RIR en RPE ni al revés.',
      'Escalas distintas: «no comparable». Objetivos de carácter o de calidad: «no evaluable».',
      'Es una estimación de la propia persona, con error.',
    ],
    references: [],
  },
  {
    id: 'training.prescribed-condition',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Condición prescrita',
    expression:
      'Por serie y dimensión: coincide o es distinto (valor fijo), dentro o fuera del rango (rango); o sin dato, no aplica, no comparable o no evaluable.',
    output: { name: 'Condición', unit: null },
    limitations: [
      'Describe, no interpreta: que una serie esté fuera de lo prescrito no es un incumplimiento.',
    ],
    references: [],
  },
  {
    id: 'training.compliance-profile',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Perfil de cumplimiento',
    expression:
      'Recuentos por dimensión (estructural, cuantitativa, intensidad y esfuerzo) y por condición, cada uno con su denominador. «Sin dato», «no aplica», «no comparable» y «no evaluable» van aparte y no entran en el denominador.',
    output: { name: 'Recuentos', unit: null },
    limitations: [
      'No hay índice ni puntuación global, ni se combinan dimensiones (P-90).',
      'Al agregar se suman recuentos; nunca se promedian porcentajes.',
    ],
    references: [],
  },
  {
    id: 'training.exercise-status',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Estado de un ejercicio',
    expression:
      'Completo (todas sus series hechas), sin registrar (ninguna registrada), no realizado (ninguna hecha y alguna «no realizada») o parcial (el resto).',
    output: { name: 'Estado', unit: null },
    limitations: ['No hay motivos registrados: no se sabe por qué algo no se hizo.'],
    references: [],
  },
  {
    id: 'training.proposed-value-match',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Valor igual o distinto del propuesto',
    expression:
      'Por serie hecha: compara lo registrado (repeticiones, segundos o metros, y la carga) con lo que el formulario proponía según la versión de esa serie.',
    output: { name: 'Igual o distinto', unit: null },
    limitations: [
      '«Distinto» indica que la clienta lo cambió; «igual» no distingue si lo aceptó sin revisar o si escribió el mismo valor (P-120).',
      '«Serie hecha» confirma el registro de la serie, no una medición independiente de cada valor.',
    ],
    references: [],
  },
  {
    id: 'training.schedule-offset',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Días entre la fecha prevista y la de ejecución',
    expression:
      'Fecha de ejecución (fecha local del inicio en la zona del móvil) − fecha prevista de la versión vigente, en días.',
    output: { name: 'Días', unit: null },
    limitations: [
      'Si la hora de inicio se ajustó (ADR-28), la fecha sale de la hora ajustada y se dice.',
    ],
    references: [],
  },
  {
    id: 'training.session-elapsed',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Duración transcurrida',
    expression: 'Fin − inicio de la ejecución.',
    output: { name: 'Duración transcurrida', unit: 's' },
    limitations: [
      'Sin calcular si el inicio o el fin usaron una hora ajustada, o si los datos son incoherentes.',
    ],
    references: [],
  },
  {
    id: 'training.session-calculated-duration',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Duración calculada',
    expression: 'Duración transcurrida − pausas registradas con «Pausar».',
    output: { name: 'Duración calculada', unit: 's' },
    limitations: [
      'No es tiempo activo ni fisiológico: no se descuentan los huecos sin pausa ni se supone inactividad (P-95).',
      'No se sabe dónde ocurrió cada pausa: solo su total.',
    ],
    references: [],
  },
  {
    id: 'training.session-gap-warning',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Huecos sin actividad registrada',
    expression:
      'Entre actividades consecutivas (inicio, cada registro de serie y fin), un hueco de más de 30 min da: «advertencia» si supera en más de 30 min el total de pausas registradas; «aviso» si las pausas podrían explicarlo; «no evaluable» si alguna de sus dos horas se ajustó.',
    output: { name: 'Nivel', unit: null },
    limitations: [
      'Los 30 min son una decisión de diseño (P-95), no un valor científico.',
      'Se evalúa hueco a hueco (P-116, P-122): no se dice dónde estuvieron las pausas ni se descuenta nada.',
    ],
    references: [],
  },
  {
    id: 'training.executed-day-totals',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Totales del día de ejecución',
    expression:
      'Por fecha de ejecución (la del inicio de cada sesión, en la zona del móvil): suma, magnitud a magnitud, de lo registrado en esas sesiones, con las mismas fórmulas que la sesión.',
    output: { name: 'Totales del día', unit: null },
    limitations: [
      'Una serie de después de la medianoche cuenta en el día de inicio de su sesión.',
      'Lo planificado va por fecha prevista y no se suma con lo ejecutado.',
    ],
    references: [],
  },
  // ── Cliente por periodos y evolución (bloque 3, B3.2; docs/BLOCK3_SPEC.md §12 y §23) ────
  {
    id: 'training.added-load-volume',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Volumen de lastre',
    expression:
      'Suma de (repeticiones × kg de lastre) de las series hechas por repeticiones con peso corporal más lastre (P-123).',
    output: { name: 'Volumen de lastre', unit: 'kg' },
    limitations: [
      'Va aparte del tonelaje externo: no se suman nunca.',
      'No incluye el peso corporal, que no se mide: no es la carga total desplazada.',
      'Las series por tiempo o distancia con lastre se cuentan aparte, sin multiplicar.',
    ],
    references: [],
  },
  {
    id: 'training.assistance-summary',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Resumen de la asistencia',
    expression:
      'Series y repeticiones asistidas hechas; asistencia media ponderada por repeticiones = Σ (rep. × kg de asistencia) ÷ Σ rep. de las series con los kg anotados (P-123).',
    output: { name: 'Asistencia', unit: 'kg' },
    limitations: [
      'Más asistencia significa menos carga para la persona: no se suma al tonelaje ni al lastre.',
      'Las series sin los kg anotados quedan como «sin dato» y no entran en la media.',
      'Al agregar se suman los productos y las repeticiones; nunca se promedian medias.',
    ],
    references: [],
  },
  {
    id: 'training.weekly-executed-volume',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Volumen ejecutado por semana',
    expression:
      'Por semana ISO de la fecha de ejecución (la del inicio de cada sesión, en la zona del móvil): suma, magnitud a magnitud, de lo registrado, con las mismas fórmulas que la sesión.',
    output: { name: 'Volumen semanal', unit: null },
    limitations: [
      'Las semanas sin sesiones se muestran con cero.',
      'Una sesión trasladada cuenta en la semana en que se hizo.',
    ],
    references: [],
  },
  {
    id: 'training.weekly-planned-volume',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Volumen planificado por semana',
    expression:
      'Por semana ISO de la fecha prevista (la de la versión original o la vigente, según la perspectiva; P-118): suma de lo prescrito, magnitud a magnitud; los rangos, como intervalo.',
    output: { name: 'Volumen planificado', unit: null },
    limitations: [
      'Va por fecha prevista: no se suma con lo ejecutado, que va por fecha de ejecución.',
      'Las sesiones sin fecha prevista original determinada (P-121) no se agrupan: se listan aparte.',
      'Si alguna serie no tiene referencia determinada, lo prescrito de esa semana está incompleto y se dice.',
    ],
    references: [],
  },
  {
    id: 'training.session-adherence',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Sesiones previstas y su estado',
    expression:
      'De las sesiones con fecha prevista en el periodo: cuántas hay en cada estado (programada, sin hacer, en curso, en pausa, interrumpida, completada o parcial) y cuántas se hicieron otro día.',
    output: { name: 'Sesiones', unit: null },
    limitations: [
      'Es un recuento, no un porcentaje de cumplimiento ni una valoración.',
      '«Completada» se calcula frente a la versión vigente.',
    ],
    references: [],
  },
  {
    id: 'training.period-duration-totals',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Duración del periodo',
    expression:
      'Total y media por sesión de la duración calculada de las sesiones ejecutadas en el periodo, con y sin las que tienen un hueco de nivel «advertencia» o «no evaluable» (P-114), diciendo cuántas son.',
    output: { name: 'Duración del periodo', unit: 's' },
    limitations: [
      'Las sesiones sin duración calculada (sin terminar, incoherentes o con el inicio o el fin ajustados) no entran y se cuentan aparte.',
      'La duración calculada no es tiempo activo ni fisiológico.',
    ],
    references: [],
  },
  {
    id: 'training.pattern-set-count',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Series por patrón de movimiento',
    expression:
      'Series hechas por patrón según la biblioteca, con dos recuentos separados y sin pesos (P-98): «solo principal» (cada serie, una vez) y «principal y secundarios» (cada serie, en cada uno de sus patrones).',
    output: { name: 'Series', unit: null },
    limitations: [
      'En «principal y secundarios» una serie cuenta en varios patrones: la suma supera el total de series.',
      'Los patrones son los de la biblioteca hoy, no los de la fecha de la sesión.',
      'No es volumen por grupo muscular ni por cualidad (P-99, P-100).',
    ],
    references: [],
  },
  {
    id: 'training.repeated-differences',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Diferencias repetidas',
    expression:
      'Ejercicios con alguna serie fuera de la condición prescrita (distinto, por debajo o por encima del rango) en al menos N de sus últimas M sesiones del periodo (P-104; N = 3 y M = 5 por defecto).',
    output: { name: 'Sesiones', unit: null },
    limitations: [
      'Lista descriptiva, sin alertas ni juicios: la interpretación es del entrenador.',
      'N y M se eligen en pantalla y no se guardan.',
      '«Sin dato», «no aplica», «no comparable» y «no evaluable» no cuentan como diferencia.',
    ],
    references: [],
  },
  {
    id: 'training.exercise-evolution',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Evolución de un ejercicio',
    expression:
      'Sesión a sesión, en orden de ejecución, las series de una variante con lo prescrito, lo registrado y su condición, en tramos de una misma modalidad (tipo de serie y carga con su base).',
    output: { name: 'Evolución', unit: null },
    limitations: [
      'Si cambia la modalidad, la evolución se corta y no se compara a través del corte.',
      'Sin estimación del 1RM, tendencias ni predicciones.',
      'Los valores se proponen con lo prescrito (P-120).',
    ],
    references: [],
  },
  {
    id: 'assessment.best-attempt',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Mejor intento',
    expression:
      'El mejor de los intentos válidos según el sentido de la prueba: el mayor si un valor más alto es mejor, el menor si es más bajo.',
    output: { name: 'Resultado de la prueba', unit: null },
    limitations: [
      'Es sensible a un intento atípico: conviene revisar los intentos individuales.',
      'Solo es comparable con otros resultados calculados con la misma regla.',
    ],
    references: [],
  },
  {
    id: 'assessment.mean-attempts',
    version: '1.0.0',
    kind: 'operational_definition',
    name: 'Promedio de intentos',
    expression: 'Media aritmética de los intentos válidos.',
    output: { name: 'Resultado de la prueba', unit: null },
    limitations: [
      'Depende del número de intentos: debe mantenerse igual entre evaluaciones.',
      'Solo es comparable con otros resultados calculados con la misma regla.',
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
