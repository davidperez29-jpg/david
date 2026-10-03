/**
 * Descriptive plan indicators (§12.8). Weekly sets per muscle group (primary = 1, secondary = 0.5,
 * configurable), sets per pattern, pull:push ratio, plyometric contacts, sprint metres and
 * estimated duration. Warning thresholds are configurable and show their evidence level.
 */
export interface IndicatorExercise {
  sets: number | null;
  repsMax: number | null;
  repsMin: number | null;
  durationS: number | null;
  distanceM: number | null;
  contacts: number | null;
  restS: number | null;
  patternSlug: string | null;
  profileSlug: string | null;
  contactsPerRep: number | null;
  muscles: { group: string; role: 'primary' | 'secondary' | 'stabilizer' }[];
}
export interface IndicatorSession {
  id: string;
  exercises: IndicatorExercise[];
}

export interface IndicatorConfig {
  primaryWeight: number;
  secondaryWeight: number;
  /** Weekly sets per muscle group above which a warning is shown. */
  maxSetsPerGroup: number;
  thresholdLevel: string;
}
export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  primaryWeight: 1,
  secondaryWeight: 0.5,
  maxSetsPerGroup: 20,
  thresholdLevel: 'F · recomendación práctica configurable',
};

const PULL = new Set(['horizontal_pull', 'vertical_pull']);
const PUSH = new Set(['horizontal_push', 'vertical_push']);

/** Rough duration estimate: work (≈4 s per rep or the prescribed duration) + rest between sets + 1 min per exercise for set-up. */
export function estimateExerciseMinutes(e: IndicatorExercise): number {
  const sets = e.sets ?? 1;
  const reps = e.repsMax ?? e.repsMin ?? 0;
  const work = e.durationS ?? (reps ? reps * 4 : e.distanceM ? Math.max(5, e.distanceM / 5) : 30);
  const rest = e.restS ?? 60;
  return (sets * work + Math.max(0, sets - 1) * rest) / 60 + 1;
}

export interface WeekIndicators {
  setsByMuscleGroup: Record<string, number>;
  setsByPattern: Record<string, number>;
  pullPushRatio: number | null;
  plyoContacts: number;
  sprintMetres: number;
  sessionMinutes: Record<string, number>;
  warnings: { message: string; level: string }[];
}

export function weekIndicators(
  sessions: IndicatorSession[],
  cfg: IndicatorConfig = DEFAULT_INDICATOR_CONFIG,
): WeekIndicators {
  const byGroup: Record<string, number> = {};
  const byPattern: Record<string, number> = {};
  let pull = 0;
  let push = 0;
  let contacts = 0;
  let metres = 0;
  const minutes: Record<string, number> = {};
  for (const s of sessions) {
    let m = 0;
    for (const e of s.exercises) {
      const sets = e.sets ?? 0;
      // A muscle counts once per exercise with its strongest role (no double counting).
      const roles = new Map<string, number>();
      for (const mu of e.muscles) {
        const w =
          mu.role === 'primary'
            ? cfg.primaryWeight
            : mu.role === 'secondary'
              ? cfg.secondaryWeight
              : 0;
        roles.set(mu.group, Math.max(roles.get(mu.group) ?? 0, w));
      }
      for (const [g, w] of roles) if (w > 0) byGroup[g] = (byGroup[g] ?? 0) + sets * w;
      if (e.patternSlug) {
        byPattern[e.patternSlug] = (byPattern[e.patternSlug] ?? 0) + sets;
        if (PULL.has(e.patternSlug)) pull += sets;
        if (PUSH.has(e.patternSlug)) push += sets;
      }
      if (e.profileSlug === 'plyometric' || e.patternSlug === 'jump_plyometric') {
        contacts += e.contacts ?? sets * (e.repsMax ?? e.repsMin ?? 0) * (e.contactsPerRep ?? 1);
      }
      if (e.profileSlug === 'sprint' || e.patternSlug === 'sprint_cod') {
        metres += (e.distanceM ?? 0) * (e.sets ?? e.repsMax ?? 1);
      }
      m += estimateExerciseMinutes(e);
    }
    minutes[s.id] = Math.round(m);
  }
  const warnings: WeekIndicators['warnings'] = [];
  for (const [g, n] of Object.entries(byGroup)) {
    if (n > cfg.maxSetsPerGroup)
      warnings.push({
        message: `Más de ${cfg.maxSetsPerGroup} series semanales en «${g}» (${n}).`,
        level: cfg.thresholdLevel,
      });
  }
  return {
    setsByMuscleGroup: Object.fromEntries(
      Object.entries(byGroup).map(([k, v]) => [k, Math.round(v * 10) / 10]),
    ),
    setsByPattern: byPattern,
    pullPushRatio: push > 0 ? Math.round((pull / push) * 100) / 100 : null,
    plyoContacts: contacts,
    sprintMetres: metres,
    sessionMinutes: minutes,
    warnings,
  };
}
