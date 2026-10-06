/**
 * Global injury catalogue seed (restructure phase 7, docs/INJURY_MODULE.md): conditions and
 * versioned protocols with their phases and criteria, from `seed-data/injury/protocols.json`.
 * Sources are keys of the evidence seed (imported first).
 * - Conditions are upserted by slug.
 * - A protocol version is immutable once seeded (open injuries point at its phases and criteria):
 *   a change in the JSON must bump `version`, which creates a new protocol row.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import type { Database } from '../client';
import {
  evidenceSources,
  injuryConditions,
  injuryProtocolCriteria,
  injuryProtocolPhases,
  injuryProtocols,
} from '../schema';

export interface SeedInjuryCriterion {
  role: 'entry' | 'success' | 'progression' | 'regression' | 'stop';
  text: string;
  mandatory: boolean;
  auto?: { test: string; metric: 'value' | 'lsi'; operator: '>=' | '<='; threshold: number };
  rtpItem?: string;
  evidence: 'evidence' | 'consensus' | 'practical';
  sources?: string[];
  limitations?: string;
}
export interface SeedInjuryPhase {
  name: string;
  goals: string[];
  restrictions?: string | null;
  exercises: string[];
  dosage?: string | null;
  recommendedTests: string[];
  criteria: SeedInjuryCriterion[];
}
export interface SeedInjuryProtocol {
  slug: string;
  condition: string;
  name: string;
  version?: number;
  description: string;
  painThreshold: number;
  painThresholdBasis: string;
  sources: string[];
  limitations?: string;
  phases: SeedInjuryPhase[];
}
export interface InjurySeed {
  conditions: { slug: string; region: string; name: string; description: string }[];
  protocols: SeedInjuryProtocol[];
}

export function loadInjuryFile(file: string): InjurySeed {
  if (!existsSync(file)) return { conditions: [], protocols: [] };
  return JSON.parse(readFileSync(file, 'utf8')) as InjurySeed;
}

/** Structural checks run before touching the database (also used by the unit test). */
export function validateInjurySeed(data: InjurySeed, testSlugs?: Set<string>): string[] {
  const errors: string[] = [];
  const conds = new Set(data.conditions.map((c) => c.slug));
  for (const p of data.protocols) {
    if (!conds.has(p.condition)) errors.push(`${p.slug}: unknown condition ${p.condition}`);
    if (!p.phases.length) errors.push(`${p.slug}: no phases`);
    if (p.painThreshold < 1 || p.painThreshold > 10) errors.push(`${p.slug}: pain threshold`);
    p.phases.forEach((ph, i) => {
      const where = `${p.slug} phase ${i + 1}`;
      for (const t of ph.recommendedTests)
        if (testSlugs && !testSlugs.has(t)) errors.push(`${where}: unknown test ${t}`);
      for (const c of ph.criteria) {
        if (c.auto && testSlugs && !testSlugs.has(c.auto.test))
          errors.push(`${where}: unknown criterion test ${c.auto.test}`);
        if (c.evidence !== 'practical' && !c.sources?.length)
          errors.push(`${where}: «${c.text}» is ${c.evidence} without sources`);
        if (/\bapt[oa]s?\b/iu.test(c.text)) errors.push(`${where}: «apto» in a criterion`);
      }
    });
  }
  return errors;
}

export async function seedInjuryCatalog(
  db: Database,
  data: InjurySeed,
): Promise<{ conditions: number; protocols: number }> {
  const errors = validateInjurySeed(data);
  if (errors.length) throw new Error(`Injury seed: ${errors.join('; ')}`);
  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const condId = new Map<string, string>();
    for (const c of data.conditions) {
      const values = {
        region: c.region,
        name: c.name,
        description: c.description,
        status: 'published' as const,
      };
      const [existing] = await tx
        .select({ id: injuryConditions.id })
        .from(injuryConditions)
        .where(and(isNull(injuryConditions.organizationId), eq(injuryConditions.slug, c.slug)));
      if (existing) {
        await tx.update(injuryConditions).set(values).where(eq(injuryConditions.id, existing.id));
        condId.set(c.slug, existing.id);
      } else {
        const [row] = await tx
          .insert(injuryConditions)
          .values({ ...values, organizationId: null, slug: c.slug })
          .returning({ id: injuryConditions.id });
        condId.set(c.slug, row!.id);
      }
    }
    const sourceCache = new Map<string, string>();
    const src = async (key: string) => {
      if (sourceCache.has(key)) return sourceCache.get(key)!;
      const [row] = await tx
        .select({ id: evidenceSources.id })
        .from(evidenceSources)
        .where(and(isNull(evidenceSources.organizationId), eq(evidenceSources.sourceKey, key)));
      if (!row) throw new Error(`Injury seed: source ${key} not imported (evidence seed first)`);
      sourceCache.set(key, row.id);
      return row.id;
    };
    const srcs = async (keys: string[] | undefined) => {
      const out: string[] = [];
      for (const k of keys ?? []) out.push(await src(k));
      return out;
    };
    let created = 0;
    for (const p of data.protocols) {
      const version = p.version ?? 1;
      const [existing] = await tx
        .select({ id: injuryProtocols.id })
        .from(injuryProtocols)
        .where(
          and(
            isNull(injuryProtocols.organizationId),
            eq(injuryProtocols.slug, p.slug),
            eq(injuryProtocols.protocolVersion, version),
          ),
        );
      if (existing) continue;
      const [row] = await tx
        .insert(injuryProtocols)
        .values({
          organizationId: null,
          slug: p.slug,
          conditionId: condId.get(p.condition)!,
          name: p.name,
          protocolVersion: version,
          status: 'published',
          description: p.description,
          painThreshold: p.painThreshold,
          painThresholdBasis: p.painThresholdBasis,
          sourceIds: await srcs(p.sources),
          limitations: p.limitations ?? null,
        })
        .returning({ id: injuryProtocols.id });
      created++;
      for (const [i, ph] of p.phases.entries()) {
        const [phase] = await tx
          .insert(injuryProtocolPhases)
          .values({
            protocolId: row!.id,
            position: i,
            name: ph.name,
            goals: ph.goals,
            restrictions: ph.restrictions ?? null,
            exercises: ph.exercises,
            dosage: ph.dosage ?? null,
            recommendedTests: ph.recommendedTests,
          })
          .returning({ id: injuryProtocolPhases.id });
        for (const [j, c] of ph.criteria.entries())
          await tx.insert(injuryProtocolCriteria).values({
            protocolId: row!.id,
            phaseId: phase!.id,
            position: j,
            role: c.role,
            text: c.text,
            mandatory: c.mandatory,
            testSlug: c.auto?.test ?? null,
            metric: c.auto?.metric ?? null,
            operator: c.auto?.operator ?? null,
            threshold: c.auto ? String(c.auto.threshold) : null,
            rtpItem: c.rtpItem ?? null,
            evidence: c.evidence,
            sourceIds: await srcs(c.sources),
            limitations: c.limitations ?? null,
          });
      }
    }
    return { conditions: data.conditions.length, protocols: created };
  });
}
