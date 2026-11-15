import { type IsoDateTime } from '../time';
import { type ClockAdjustment, type SessionLogV2, type SetLogV2 } from '../training/execution';

/**
 * Duración y calidad del dato temporal (P-95, P-116 y P-122; BLOCK3_SPEC §3.6, §4.5 y §21.7).
 *
 * - **Transcurrida** = fin − inicio. **Calculada** = transcurrida − pausas registradas.
 * - La calculada **no** es tiempo activo ni fisiológico: no se descuentan los huecos sin pausa
 *   ni se supone inactividad, y no se modifica ningún registro.
 * - Solo se guarda el **total** de las pausas, no dónde ocurrió cada una: un hueco se evalúa
 *   frente a ese total sin decir dónde estuvieron.
 * - Una hora ajustada (ADR-28) no es la del móvil: el intervalo que la usa no se evalúa.
 */
export const GAP_THRESHOLD_SECONDS = 30 * 60;

export type Activity = 'start' | 'set' | 'finish';

export interface DurationGap {
  from: IsoDateTime;
  to: IsoDateTime;
  fromActivity: Activity;
  toActivity: Activity;
  seconds: number;
  /**
   * - `warning`: el hueco supera en más de 30 min el total de pausas registradas (seguro que
   *   hubo más de 30 min sin pausa registrada en él);
   * - `notice`: pasa de 30 min, pero las pausas registradas podrían explicarlo;
   * - `not_evaluable`: alguna de sus dos horas se ajustó.
   */
  level: 'warning' | 'notice' | 'not_evaluable';
}

export type DurationState =
  | { kind: 'not_started' }
  | { kind: 'unfinished'; startedAt: IsoDateTime; lastActivityAt: IsoDateTime; paused: boolean }
  | {
      kind: 'incoherent';
      startedAt: IsoDateTime;
      finishedAt: IsoDateTime;
      reason: 'finish_before_start' | 'pauses_exceed_elapsed';
    }
  | {
      kind: 'not_calculable';
      startedAt: IsoDateTime;
      finishedAt: IsoDateTime;
      adjusted: { start: ClockAdjustment | null; finish: ClockAdjustment | null };
    }
  | {
      kind: 'calculated';
      startedAt: IsoDateTime;
      finishedAt: IsoDateTime;
      elapsedSeconds: number;
      calculatedSeconds: number;
    };

export interface DurationAnalysis {
  state: DurationState;
  /** Total de las pausas que la clienta hizo con «Pausar» (siempre se muestra tal cual). */
  pausedSeconds: number;
  gaps: DurationGap[];
  /** Duración prevista por el entrenador, si la puso; nunca se calcula una diferencia en %. */
  estimatedMinutes: number | null;
  /** Alguna hora de la sesión (inicio, series o fin) se ajustó. */
  anyAdjusted: boolean;
}

const seconds = (from: IsoDateTime, to: IsoDateTime) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 1000);

/** Hora de un registro de serie y si se ajustó (las filas antiguas solo tienen la marca). */
const setAdjusted = (log: SetLogV2) => (log.clockAdjustment ?? null) !== null || log.clockAdjusted;

export function analyzeDuration(input: {
  log: SessionLogV2 | null;
  /** Todos los registros, también los sustituidos por una corrección: cada uno es actividad. */
  setLogs: readonly SetLogV2[];
  estimatedMinutes: number | null;
}): DurationAnalysis {
  const { log } = input;
  const estimatedMinutes = input.estimatedMinutes;
  if (!log) {
    return {
      state: { kind: 'not_started' },
      pausedSeconds: 0,
      gaps: [],
      estimatedMinutes,
      anyAdjusted: false,
    };
  }
  const startAdjusted = log.startClockAdjustment ?? null;
  const finishAdjusted = log.finishClockAdjustment ?? null;
  const anyAdjusted =
    startAdjusted !== null || finishAdjusted !== null || input.setLogs.some(setAdjusted);
  const base = { pausedSeconds: log.pausedSeconds, estimatedMinutes, anyAdjusted };
  if (!log.finishedAt) {
    return {
      ...base,
      state: {
        kind: 'unfinished',
        startedAt: log.startedAt,
        lastActivityAt: log.lastActivityAt,
        paused: log.pausedAt !== undefined,
      },
      gaps: [],
    };
  }
  const finishedAt = log.finishedAt;
  const elapsed = seconds(log.startedAt, finishedAt);
  let state: DurationState;
  if (elapsed < 0) {
    state = {
      kind: 'incoherent',
      startedAt: log.startedAt,
      finishedAt,
      reason: 'finish_before_start',
    };
  } else if (log.pausedSeconds > elapsed) {
    state = {
      kind: 'incoherent',
      startedAt: log.startedAt,
      finishedAt,
      reason: 'pauses_exceed_elapsed',
    };
  } else if (startAdjusted !== null || finishAdjusted !== null) {
    state = {
      kind: 'not_calculable',
      startedAt: log.startedAt,
      finishedAt,
      adjusted: { start: startAdjusted, finish: finishAdjusted },
    };
  } else {
    state = {
      kind: 'calculated',
      startedAt: log.startedAt,
      finishedAt,
      elapsedSeconds: elapsed,
      calculatedSeconds: elapsed - log.pausedSeconds,
    };
  }

  // Con datos incoherentes no se calcula nada: ni duración ni huecos (BLOCK3_SPEC §4.5).
  if (state.kind === 'incoherent') return { ...base, state, gaps: [] };

  const activities = [
    { at: log.startedAt, activity: 'start' as const, adjusted: startAdjusted !== null },
    ...input.setLogs.map((s) => ({
      at: s.performedAt,
      activity: 'set' as const,
      adjusted: setAdjusted(s),
    })),
    { at: finishedAt, activity: 'finish' as const, adjusted: finishAdjusted !== null },
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const gaps: DurationGap[] = [];
  for (let i = 1; i < activities.length; i += 1) {
    const from = activities[i - 1]!;
    const to = activities[i]!;
    const gap = seconds(from.at, to.at);
    if (gap <= GAP_THRESHOLD_SECONDS) continue;
    gaps.push({
      from: from.at,
      to: to.at,
      fromActivity: from.activity,
      toActivity: to.activity,
      seconds: gap,
      level:
        from.adjusted || to.adjusted
          ? 'not_evaluable'
          : gap - log.pausedSeconds > GAP_THRESHOLD_SECONDS
            ? 'warning'
            : 'notice',
    });
  }
  return { ...base, state, gaps };
}
