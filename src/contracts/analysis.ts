import { type ExerciseEvolution } from '@/domain/analysis/exercise';
import { type Period, type PeriodAnalysis, type PeriodKind } from '@/domain/analysis/period';
import { type Perspective } from '@/domain/analysis/reference';
import { type ExecutedVolume, type SessionAnalysis } from '@/domain/analysis/session';
import { type IsoDate, type IsoDateTime } from '@/domain/time';
import { type ExecutionStatusV2 } from '@/domain/training/execution';

/**
 * Modelos de vista del análisis (B3.1, solo para el entrenador). Los cálculos son los del
 * dominio (`src/domain/analysis`); aquí solo se añade lo que la pantalla necesita para situarse.
 */
export interface SessionAnalysisVM {
  sessionId: string;
  clientId: string;
  clientFirstName: string;
  title: string;
  label: string | null;
  focus: string;
  dayOrder: number;
  /** Zona de la aplicación (la de las fechas previstas). */
  appTimeZone: string;
  perspective: Perspective;
  analysis: SessionAnalysis;
}

/** Una sesión empezada en el día (fecha de ejecución), con lo que se registró. */
export interface DayExecutedSessionVM {
  sessionId: string;
  title: string;
  label: string | null;
  plannedDate: IsoDate;
  daysFromPlanned: number;
  status: ExecutionStatusV2;
  startedAt: IsoDateTime;
  startTimeZone: string;
  executed: ExecutedVolume;
}

/** Una sesión prevista para el día (fecha prevista vigente) y su estado. */
export interface DayPlannedSessionVM {
  sessionId: string;
  title: string;
  label: string | null;
  dayOrder: number;
  status: ExecutionStatusV2;
  executedOn: IsoDate | null;
  daysFromPlanned: number | null;
}

export interface ExecutionDayVM {
  clientId: string;
  clientFirstName: string;
  date: IsoDate;
  week: { key: string; start: IsoDate; end: IsoDate };
  /** Lo ejecutado ese día (por fecha de ejecución), sesión a sesión. */
  executed: DayExecutedSessionVM[];
  /** Suma de lo ejecutado ese día, magnitud a magnitud. */
  totals: ExecutedVolume;
  /** Lo previsto ese día (por fecha prevista vigente). No se suma con lo ejecutado. */
  planned: DayPlannedSessionVM[];
}

/** Panel (A1): sesiones empezadas en los últimos 7 días, con acceso a su análisis. */
export interface RecentExecutionVM {
  clientId: string;
  clientName: string;
  sessionId: string;
  title: string;
  label: string | null;
  executedOn: IsoDate;
  startedAt: IsoDateTime;
  status: ExecutionStatusV2;
}

/** Magnitud del gráfico semanal de A9 (cada una en su unidad; nunca se mezclan). */
export type WeeklyMagnitude = 'sets' | 'reps' | 'tonnage' | 'seconds' | 'meters' | 'addedLoad';

/**
 * Valores de la URL de A9 y A10 (en español, como el resto de parámetros) y su equivalente
 * interno. Los comparten el servicio, que los interpreta, y la pantalla, que construye enlaces.
 */
export const PERIOD_PARAM = {
  semana: 'week',
  '4-semanas': 'weeks4',
  '12-semanas': 'weeks12',
  rango: 'range',
} as const satisfies Record<string, PeriodKind>;

export const MAGNITUDE_PARAM = {
  series: 'sets',
  repeticiones: 'reps',
  tonelaje: 'tonnage',
  tiempo: 'seconds',
  distancia: 'meters',
  lastre: 'addedLoad',
} as const satisfies Record<string, WeeklyMagnitude>;

const reverse = <T extends Record<string, string>>(map: T) =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as { [K in keyof T as T[K]]: K };

export const PERIOD_PARAM_OF = reverse(PERIOD_PARAM);
export const MAGNITUDE_PARAM_OF = reverse(MAGNITUDE_PARAM);

export interface AnalysisFilters {
  /** Patrón de la biblioteca (P-98) o `null`. */
  pattern: string | null;
  /** «Solo principal» o «principal y secundarios»: para el filtro y para el recuento que se muestra. */
  patternMode: 'primary' | 'all';
  variantId: string | null;
  /** P-104: N de las últimas M sesiones (ajustables, no se guardan). */
  repeat: { n: number; m: number };
  sort: 'asc' | 'desc';
  magnitude: WeeklyMagnitude;
}

/** A9 · Análisis del cliente por periodos (B3.2). */
export interface ClientAnalysisVM {
  clientId: string;
  clientFirstName: string;
  today: IsoDate;
  appTimeZone: string;
  perspective: Perspective;
  /** El periodo pedido no era válido: se muestra el de por defecto y se avisa. */
  invalidPeriod: boolean;
  filters: AnalysisFilters;
  options: {
    patterns: { id: string; name: string }[];
    exercises: { variantId: string; name: string }[];
  };
  names: { variants: Record<string, string>; patterns: Record<string, string> };
  analysis: PeriodAnalysis;
}

/** A10 · Evolución de un ejercicio (B3.2). */
export interface ExerciseEvolutionVM {
  clientId: string;
  clientFirstName: string;
  variantId: string;
  name: string;
  today: IsoDate;
  appTimeZone: string;
  perspective: Perspective;
  period: Period;
  invalidPeriod: boolean;
  evolution: ExerciseEvolution;
}
