/**
 * Post-session progression proposals (§12.7). They never change a plan: they return a proposal
 * with its reason, to be stored as a recommendation the trainer accepts or rejects (§12.2).
 * Rules are practical (level F) and configurable.
 */
export interface LoggedSet {
  reps: number;
  loadKg: number | null;
  rir: number | null;
  /** Mean concentric velocity of the set (m/s), when measured (phase 14). */
  meanVelocityMps?: number | null;
}

export interface ProgressionProposal {
  action: 'increase_load' | 'decrease_load' | 'hold';
  fromKg: number | null;
  toKg: number | null;
  reason: string;
  level: 'F';
}

/** Double progression: all sets reach repsMax with RIR ≥ target → +load and back to repsMin. */
export function doubleProgression(
  target: { repsMax: number; rirMin: number | null; loadKg: number | null },
  sets: LoggedSet[],
  incrementKg: number,
): ProgressionProposal {
  const load = target.loadKg;
  if (!sets.length || load == null)
    return {
      action: 'hold',
      fromKg: load,
      toKg: load,
      reason: 'Sin registros o sin carga en kg.',
      level: 'F',
    };
  const allTop = sets.every(
    (s) =>
      s.reps >= target.repsMax &&
      (target.rirMin == null || s.rir == null || s.rir >= target.rirMin),
  );
  if (allTop) {
    return {
      action: 'increase_load',
      fromKg: load,
      toKg: load + incrementKg,
      reason: `Todas las series llegaron a ${target.repsMax} repeticiones con el RIR objetivo: +${incrementKg} kg y volver al mínimo del rango.`,
      level: 'F',
    };
  }
  return {
    action: 'hold',
    fromKg: load,
    toKg: load,
    reason: 'Todavía no se completa el máximo del rango en todas las series.',
    level: 'F',
  };
}

/**
 * RIR adjustment: if the logged RIR is above target + 1 in ≥ 2 sessions → propose +load;
 * if below target − 1 → propose −load (or keep). Self-reported RIR is imprecise far from failure.
 */
export function rirAdjustment(
  target: { rirMin: number; rirMax: number; loadKg: number | null },
  sessionsMeanRir: number[],
  incrementKg: number,
): ProgressionProposal {
  const load = target.loadKg;
  const recent = sessionsMeanRir.slice(-2);
  if (recent.length < 2 || load == null)
    return {
      action: 'hold',
      fromKg: load,
      toKg: load,
      reason: 'Se necesitan al menos 2 sesiones registradas con RIR.',
      level: 'F',
    };
  if (recent.every((r) => r > target.rirMax + 1)) {
    return {
      action: 'increase_load',
      fromKg: load,
      toKg: load + incrementKg,
      reason: `RIR registrado por encima del objetivo (${target.rirMin}–${target.rirMax}) en 2 sesiones seguidas.`,
      level: 'F',
    };
  }
  if (recent.every((r) => r < target.rirMin - 1)) {
    return {
      action: 'decrease_load',
      fromKg: load,
      toKg: Math.max(0, load - incrementKg),
      reason: `RIR registrado por debajo del objetivo (${target.rirMin}–${target.rirMax}) en 2 sesiones seguidas.`,
      level: 'F',
    };
  }
  return {
    action: 'hold',
    fromKg: load,
    toKg: load,
    reason: 'RIR dentro del objetivo.',
    level: 'F',
  };
}

/**
 * Margin around the target velocity before the load changes (restructure phase 14). Practical
 * rule (level F): small differences are within the day-to-day and sensor variation.
 */
export const VELOCITY_MARGIN_MPS = 0.06;

/**
 * Velocity-based load adjustment (phase 14): the mean velocity of the last 2 sessions at the
 * planned load is compared with the prescribed target. Clearly faster in both → more load;
 * clearly slower in both → less load. Practical rule (level F); velocity reflects relative load
 * (González-Badillo & Sánchez-Medina 2010, bench press), with exercise- and sensor-dependent
 * precision.
 */
export function velocityAdjustment(
  target: { velocityTargetMps: number; loadKg: number | null },
  sessionsMeanVelocity: number[],
  incrementKg: number,
): ProgressionProposal {
  const load = target.loadKg;
  const recent = sessionsMeanVelocity.slice(-2);
  const v = (x: number) => `${x.toFixed(2).replace('.', ',')} m/s`;
  if (recent.length < 2 || load == null)
    return {
      action: 'hold',
      fromKg: load,
      toKg: load,
      reason: 'Se necesitan al menos 2 sesiones con velocidad medida.',
      level: 'F',
    };
  const t = target.velocityTargetMps;
  if (recent.every((x) => x >= t + VELOCITY_MARGIN_MPS))
    return {
      action: 'increase_load',
      fromKg: load,
      toKg: load + incrementKg,
      reason: `Velocidad media por encima del objetivo (${v(t)}) en 2 sesiones seguidas: ${recent.map(v).join(' y ')}.`,
      level: 'F',
    };
  if (recent.every((x) => x <= t - VELOCITY_MARGIN_MPS))
    return {
      action: 'decrease_load',
      fromKg: load,
      toKg: Math.max(0, load - incrementKg),
      reason: `Velocidad media por debajo del objetivo (${v(t)}) en 2 sesiones seguidas: ${recent.map(v).join(' y ')}.`,
      level: 'F',
    };
  return {
    action: 'hold',
    fromKg: load,
    toKg: load,
    reason: `Velocidad dentro del margen del objetivo (${v(t)} ± ${v(VELOCITY_MARGIN_MPS)}).`,
    level: 'F',
  };
}

/** Sets with more repetitions to failure than this are not used to estimate the 1RM. */
export const E1RM_MAX_REPS = 10;

/**
 * Estimated 1RM (phase 14), informative only: the practical equation attributed to Epley
 * (level F; its original source is not indexed: [REQUIERE VERIFICACIÓN]), load × (1 + RTF/30),
 * where RTF = repetitions done + RIR reported (the repetitions the set allowed to failure). Only
 * sets with RTF ≤ 10 are used (estimates from multiple-RM tests lose accuracy beyond ~10
 * repetitions; Reynolds et al. 2006) and never with an assumed RIR. Returns the best set.
 */
export function estimateOneRm(
  sets: { loadKg: number | null; reps: number; rir: number | null }[],
): { kg: number; loadKg: number; repsToFailure: number } | null {
  let best: { kg: number; loadKg: number; repsToFailure: number } | null = null;
  for (const s of sets) {
    if (s.loadKg == null || s.loadKg <= 0 || s.rir == null || s.reps < 1) continue;
    const rtf = s.reps + s.rir;
    if (rtf > E1RM_MAX_REPS) continue;
    const kg = rtf === 1 ? s.loadKg : s.loadKg * (1 + rtf / 30);
    const rounded = Math.round(kg * 2) / 2;
    if (!best || rounded > best.kg) best = { kg: rounded, loadKg: s.loadKg, repsToFailure: rtf };
  }
  return best;
}
