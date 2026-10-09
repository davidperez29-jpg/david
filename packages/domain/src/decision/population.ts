/**
 * Population-specific parameter values (restructure phase 17). A centre can give a rule's
 * parameters other values for a population (sex, age range, experience, sport). For a client,
 * the most specific variant that matches wins; on a tie, the first one in the list. A criterion
 * whose client data is unknown never matches, and the platform ships no variants: population
 * values are the centre's own, never invented defaults.
 */
import type {
  ClientContext,
  DecisionRule,
  Experience,
  ParamVariant,
  PopulationCriteria,
} from './types';

export interface Who {
  sex: ClientContext['person']['sex'];
  age: number | null;
  experience: Experience | null;
  /** The client's main sport and the sport of the primary goal. */
  sports: string[];
}

export function whoOf(ctx: ClientContext): Who {
  return {
    sex: ctx.person.sex,
    age: ctx.person.age,
    experience: ctx.person.experience,
    sports: [
      ...new Set([ctx.person.sport, ctx.goals.primary?.sport].filter((s): s is string => !!s)),
    ],
  };
}

/** Number of stated criteria (an age range counts once): the variant's specificity. */
export function criteriaCount(w: PopulationCriteria): number {
  return (
    Number(w.sex != null) +
    Number(w.ageMin != null || w.ageMax != null) +
    Number(w.experience != null) +
    Number(w.sport != null)
  );
}

export function matchesPopulation(w: PopulationCriteria, who: Who): boolean {
  if (w.sex != null && who.sex !== w.sex) return false;
  if (w.ageMin != null && (who.age == null || who.age < w.ageMin)) return false;
  if (w.ageMax != null && (who.age == null || who.age > w.ageMax)) return false;
  if (w.experience != null && who.experience !== w.experience) return false;
  if (w.sport != null && !who.sports.includes(w.sport)) return false;
  return true;
}

/** The most specific matching variant; the first of them on a tie. */
export function pickVariant(
  variants: ParamVariant[],
  who: Who,
): { variant: ParamVariant; index: number } | null {
  let best: { variant: ParamVariant; index: number } | null = null;
  for (const [index, variant] of variants.entries()) {
    if (!criteriaCount(variant.when) || !matchesPopulation(variant.when, who)) continue;
    if (!best || criteriaCount(variant.when) > criteriaCount(best.variant.when))
      best = { variant, index };
  }
  return best;
}

/** Two variants for the same population would be ambiguous. */
export function samePopulation(a: PopulationCriteria, b: PopulationCriteria): boolean {
  return (
    (a.sex ?? null) === (b.sex ?? null) &&
    (a.ageMin ?? null) === (b.ageMin ?? null) &&
    (a.ageMax ?? null) === (b.ageMax ?? null) &&
    (a.experience ?? null) === (b.experience ?? null) &&
    (a.sport ?? null) === (b.sport ?? null)
  );
}

const EXPERIENCE: Record<Experience, string> = {
  beginner: 'principiantes',
  intermediate: 'experiencia intermedia',
  advanced: 'avanzados',
};

/** «mujeres, 16–18 años, fútbol». */
export function populationLabel(
  w: PopulationCriteria,
  sportNames: Record<string, string> = {},
): string {
  const parts: string[] = [];
  if (w.sex) parts.push(w.sex === 'female' ? 'mujeres' : 'hombres');
  if (w.ageMin != null && w.ageMax != null) parts.push(`${w.ageMin}–${w.ageMax} años`);
  else if (w.ageMin != null) parts.push(`${w.ageMin} años o más`);
  else if (w.ageMax != null) parts.push(`hasta ${w.ageMax} años`);
  if (w.experience) parts.push(EXPERIENCE[w.experience]);
  if (w.sport) {
    const name = sportNames[w.sport] ?? w.sport;
    parts.push(name.charAt(0).toLowerCase() + name.slice(1));
  }
  return parts.join(', ');
}

/** The rule with the variant's values over its defaults (unknown parameter keys are ignored). */
export function applyVariant(rule: DecisionRule, variant: ParamVariant): DecisionRule {
  return {
    ...rule,
    parameters: Object.fromEntries(
      Object.entries(rule.parameters).map(([k, p]) => [
        k,
        Object.hasOwn(variant.values, k) ? { ...p, value: variant.values[k]! } : p,
      ]),
    ),
  };
}
