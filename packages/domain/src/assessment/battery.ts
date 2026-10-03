/**
 * Battery proposal (§11.1.1, §11.4): evaluation depends on the goal and the context. The engine
 * proposes; the trainer edits. Every exclusion carries its reason.
 */
export interface BatteryTemplate {
  slug: string;
  name: string;
  goalFamily: string;
  tests: { slug: string; name: string; isCore: boolean }[];
}

export interface BatteryContext {
  goals: string[];
  age: number | null;
  experience: 'none' | 'beginner' | 'intermediate' | 'advanced' | null;
  /** Pre-participation screening: clear, refer, or unknown (none recorded / no consent to read it). */
  screening: 'clear' | 'refer' | 'unknown';
}

export interface BatteryProposal {
  battery: BatteryTemplate | null;
  tests: {
    slug: string;
    name: string;
    isCore: boolean;
    included: boolean;
    reason: string | null;
  }[];
  explanation: string[];
}

/** Goal → template slug. The first goal decides; the order of the client's goals is their priority. */
export const GOAL_BATTERY: Record<string, string> = {
  hypertrophy: 'hypertrophy_strength',
  max_strength: 'hypertrophy_strength',
  functional_strength: 'health',
  general_health: 'health',
  reconditioning: 'health',
  mobility: 'health',
  strength_initiation: 'initiation',
  general_physical_preparation: 'initiation',
  team_sport_performance: 'team_sport',
  change_of_direction: 'team_sport',
  agility: 'team_sport',
  endurance_sport_performance: 'endurance',
  sprint: 'sprint_power',
  acceleration: 'sprint_power',
  power: 'sprint_power',
  neuromuscular_capacity: 'sprint_power',
  body_composition: 'body_composition',
};

/** Maximal or high-intensity tests: never before a clear screening (§11.1.2). */
export const MAXIMAL_TESTS = new Set([
  'one_rm_back_squat',
  'one_rm_bench_press',
  'one_rm_deadlift',
  'imtp_peak_force',
  'sprint_5m',
  'sprint_10m',
  'sprint_20m',
  'sprint_30m',
  'max_sprint_speed',
  'drop_jump_rsi',
  'yo_yo_ir1',
  'ift_30_15',
  'cooper_test',
  'test_505',
  't_test',
  'modified_agility_t_test',
  'illinois_agility_test',
]);

export function proposeBattery(ctx: BatteryContext, templates: BatteryTemplate[]): BatteryProposal {
  const explanation: string[] = [];
  const goal = ctx.goals.find((g) => GOAL_BATTERY[g]);
  let slug = goal ? GOAL_BATTERY[goal]! : 'initiation';
  if (goal) explanation.push(`Batería elegida por el objetivo principal («${goal}»).`);
  else explanation.push('Sin objetivo con batería asociada: se propone la batería de iniciación.');
  if (ctx.age != null && ctx.age >= 65 && slug !== 'health') {
    slug = 'health';
    explanation.push('Persona de 65 años o más: se prioriza la batería de salud y función.');
  }
  const battery = templates.find((t) => t.slug === slug) ?? null;
  if (!battery)
    return {
      battery: null,
      tests: [],
      explanation: [...explanation, `Plantilla «${slug}» no disponible.`],
    };
  const novice = ctx.experience === 'none' || ctx.experience === 'beginner';
  const tests = battery.tests.map((t) => {
    let reason: string | null = null;
    if (MAXIMAL_TESTS.has(t.slug) && ctx.screening !== 'clear') {
      reason =
        ctx.screening === 'refer'
          ? 'Cribado con derivación: no realizar tests máximos. Requiere valoración por profesional sanitario.'
          : 'Sin cribado previo registrado: los tests máximos esperan a un cribado sin incidencias.';
    } else if (
      t.slug.startsWith('one_rm_') &&
      t.slug !== 'one_rm_lv_estimate' &&
      (novice || (ctx.age != null && ctx.age >= 65))
    ) {
      reason = 'No se propone un 1RM directo en principiantes ni en mayores sin familiarización.';
    }
    return { ...t, included: reason === null, reason };
  });
  if (tests.some((t) => !t.included))
    explanation.push('Algunos tests se excluyen por seguridad; el motivo figura en cada uno.');
  explanation.push('Es una propuesta: el entrenador puede añadir o quitar tests.');
  return { battery, tests, explanation };
}
