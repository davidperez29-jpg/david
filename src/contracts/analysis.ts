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
