import { type FormulaRef } from '../measurement';
import { addDays, type IsoDate, isoWeekKey, startOfIsoWeek } from '../time';

/** Fórmulas del registro que implementa este módulo (ver formulas.ts). */
export const VOLUME_FORMULAS = {
  completedSets: { id: 'training.completed-sets', version: '1.0.0' },
  totalReps: { id: 'training.total-reps', version: '1.0.0' },
  volumeLoad: { id: 'training.volume-load', version: '1.0.0' },
} as const satisfies Record<string, FormulaRef>;

export interface PerformedSet {
  reps: number;
  /** Carga externa en kg; `null` si no hay carga externa (peso corporal, banda…). */
  loadKg: number | null;
  completed: boolean;
}

export interface VolumeSummary {
  completedSets: number;
  totalReps: number;
  volumeLoadKg: number;
  /** Series completadas que no entran en el tonelaje por no tener carga externa en kg. */
  setsWithoutExternalLoad: number;
}

export const EMPTY_VOLUME: VolumeSummary = Object.freeze({
  completedSets: 0,
  totalReps: 0,
  volumeLoadKg: 0,
  setsWithoutExternalLoad: 0,
});

function assertValidSet(set: PerformedSet): void {
  if (!Number.isInteger(set.reps) || set.reps < 0) {
    throw new RangeError(`Repeticiones no válidas: ${set.reps}`);
  }
  if (set.loadKg !== null && !(Number.isFinite(set.loadKg) && set.loadKg >= 0)) {
    throw new RangeError(`Carga no válida: ${set.loadKg}`);
  }
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Implementa training.completed-sets, training.total-reps y training.volume-load (v1.0.0). */
export function summarizeVolume(sets: readonly PerformedSet[]): VolumeSummary {
  let completedSets = 0;
  let totalReps = 0;
  let volumeLoadKg = 0;
  let setsWithoutExternalLoad = 0;

  for (const set of sets) {
    assertValidSet(set);
    if (!set.completed) continue;
    completedSets += 1;
    totalReps += set.reps;
    if (set.loadKg !== null && set.loadKg > 0) volumeLoadKg += set.reps * set.loadKg;
    else setsWithoutExternalLoad += 1;
  }
  return { completedSets, totalReps, volumeLoadKg: round3(volumeLoadKg), setsWithoutExternalLoad };
}

export function addVolume(a: VolumeSummary, b: VolumeSummary): VolumeSummary {
  return {
    completedSets: a.completedSets + b.completedSets,
    totalReps: a.totalReps + b.totalReps,
    volumeLoadKg: round3(a.volumeLoadKg + b.volumeLoadKg),
    setsWithoutExternalLoad: a.setsWithoutExternalLoad + b.setsWithoutExternalLoad,
  };
}

export interface DatedSets {
  date: IsoDate;
  sets: readonly PerformedSet[];
}

export interface WeeklyVolume extends VolumeSummary {
  week: string;
  weekStart: IsoDate;
  /** Sesiones con al menos una serie completada. */
  sessions: number;
}

/**
 * Agrega por semana ISO todas las semanas entre `from` y `to` (ambas incluidas), también
 * las que no tienen registros, para que los gráficos no oculten semanas vacías.
 */
export function weeklyVolume(
  entries: readonly DatedSets[],
  range: { from: IsoDate; to: IsoDate },
): WeeklyVolume[] {
  const weeks = new Map<string, WeeklyVolume>();
  for (let start = startOfIsoWeek(range.from); start <= range.to; start = addDays(start, 7)) {
    weeks.set(isoWeekKey(start), {
      week: isoWeekKey(start),
      weekStart: start,
      sessions: 0,
      ...EMPTY_VOLUME,
    });
  }
  for (const entry of entries) {
    if (entry.date < range.from || entry.date > range.to) continue;
    const week = weeks.get(isoWeekKey(entry.date));
    if (!week) continue;
    const summary = summarizeVolume(entry.sets);
    Object.assign(week, addVolume(week, summary));
    if (summary.completedSets > 0) week.sessions += 1;
  }
  return [...weeks.values()];
}
