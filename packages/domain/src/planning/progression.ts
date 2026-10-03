/**
 * Post-session progression proposals (§12.7). They never change a plan: they return a proposal
 * with its reason, to be stored as a recommendation the trainer accepts or rejects (§12.2).
 * Rules are practical (level F) and configurable.
 */
export interface LoggedSet {
  reps: number;
  loadKg: number | null;
  rir: number | null;
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
