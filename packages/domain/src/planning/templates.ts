/**
 * Template library (restructure phase 3, docs/PLANNING.md §6 ter): filters, the order in which
 * templates are suggested for a client and how edits become versions. Pure.
 */
import { normalizeName } from '../library/text';

export const TEMPLATE_KINDS = ['training', 'risk_reduction', 'readaptation'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** Populations a template suits (filter). Labels live in the interface. */
export const TEMPLATE_POPULATIONS = [
  'adultos',
  'adulto_mayor',
  'deportistas',
  'jovenes',
  'pc_leve',
] as const;
export type TemplatePopulation = (typeof TEMPLATE_POPULATIONS)[number];

/** What the library knows about a template without reading its content. */
export interface TemplateFacts {
  name: string;
  description?: string | null;
  profileSlug: string | null;
  levelN: number | null;
  sessionsPerWeek: number;
  population: string[];
  /** Equipment its exercises need (slugs). */
  equipmentSlugs: string[];
  kind: TemplateKind;
  isGlobal: boolean;
  archived: boolean;
}

export interface TemplateFilter {
  q?: string;
  profile?: string;
  level?: number;
  days?: number;
  population?: string;
  /** Equipment available: only templates whose equipment is all available. */
  equipment?: string[];
  kind?: TemplateKind;
  scope?: 'all' | 'global' | 'mine';
  /** true: only archived templates; otherwise archived ones are hidden. */
  archived?: boolean;
}

/** Equipment the template needs that is not in `available` (empty: it can be done). */
export function missingEquipment(needed: string[], available: string[]): string[] {
  const has = new Set(available);
  return needed.filter((e) => !has.has(e));
}

export function matchesTemplate(t: TemplateFacts, f: TemplateFilter): boolean {
  if (!!f.archived !== t.archived) return false;
  if (f.scope === 'global' && !t.isGlobal) return false;
  if (f.scope === 'mine' && t.isGlobal) return false;
  if (f.kind && t.kind !== f.kind) return false;
  if (f.profile && t.profileSlug !== f.profile) return false;
  if (f.level && t.levelN != null && t.levelN !== f.level) return false;
  if (f.days && t.sessionsPerWeek !== f.days) return false;
  if (f.population && t.population.length && !t.population.includes(f.population)) return false;
  if (f.equipment && missingEquipment(t.equipmentSlugs, f.equipment).length) return false;
  if (f.q) {
    const words = normalizeName(f.q).split(' ').filter(Boolean);
    const text = normalizeName(`${t.name} ${t.description ?? ''}`);
    if (!words.every((w) => text.includes(w))) return false;
  }
  return true;
}

export interface ClientFit {
  profileSlug?: string | null;
  levelN?: number | null;
  sessionsPerWeek?: number | null;
  equipment?: string[] | null;
}

/**
 * How well a template suits a client (higher first): same profile, same level (an adjacent one
 * counts less), same days, and equipment the client has. Own templates win ties: the centre made
 * them for its people.
 */
export function templateFitScore(t: TemplateFacts, c: ClientFit): number {
  let s = 0;
  if (c.profileSlug && t.profileSlug === c.profileSlug) s += 8;
  if (c.levelN && t.levelN != null)
    s += t.levelN === c.levelN ? 4 : Math.abs(t.levelN - c.levelN) === 1 ? 1 : 0;
  if (c.sessionsPerWeek && t.sessionsPerWeek === c.sessionsPerWeek) s += 3;
  if (c.equipment?.length && !missingEquipment(t.equipmentSlugs, c.equipment).length) s += 2;
  if (!t.isGlobal) s += 0.5;
  return s;
}

/** Consecutive edits by the same person within this time are one version (like a document). */
export const VERSION_GROUP_MINUTES = 30;

/**
 * Whether a saved edit updates the latest version instead of creating a new one: same author,
 * recent, and no plan has been created from that version yet (a plan always points to exactly
 * what it was made from).
 */
export function groupsIntoLatestVersion(
  latest: { createdBy: string | null; updatedAt: Date; usedByPlans: number },
  actorUserId: string,
  now: Date,
): boolean {
  return (
    latest.createdBy === actorUserId &&
    latest.usedByPlans === 0 &&
    now.getTime() - latest.updatedAt.getTime() < VERSION_GROUP_MINUTES * 60_000
  );
}
