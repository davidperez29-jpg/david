/**
 * Global assessment catalogue seed (MASTER_SPECIFICATION §11). Tests, published reliability,
 * reference values (always with population and source) and batteries by goal.
 * Idempotent: tests and batteries by slug; reliability/reference rows of global tests are replaced.
 * Sources are imported by the evidence seed (same verified PubMed records).
 */
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_FORMULAS } from '@tp/domain';
import type { Database } from '../client';
import {
  assessmentBatteries,
  assessmentTests,
  batteryTests,
  derivedFormulas,
  evidenceSources,
  populations,
  referenceValues,
  testReliabilityData,
} from '../schema';
import type { SeedSource } from './evidence';

type Category =
  | 'strength'
  | 'power'
  | 'speed'
  | 'cod'
  | 'agility'
  | 'endurance'
  | 'mobility'
  | 'body_composition'
  | 'functional'
  | 'balance'
  | 'questionnaire';

export interface SeedTest {
  slug: string;
  name: string;
  category: Category;
  purpose?: string | null;
  targetPopulations?: string | null;
  protocol?: string | null;
  equipment?: string[];
  unit: string;
  valueType: 'number' | 'time' | 'distance' | 'angle' | 'count' | 'scale';
  betterDirection: 'higher' | 'lower' | 'target_range';
  defaultAttempts?: number;
  aggregation?: 'best' | 'mean' | 'mean_of_best_n' | 'last' | 'median' | 'min' | 'max';
  aggregationN?: number | null;
  sided?: boolean;
  isEstimate?: boolean;
  limitations?: string | null;
  /** Plausible limits: outside, the value is flagged «confirmar medición» (never dropped). */
  plausibleMin?: number | null;
  plausibleMax?: number | null;
  sources?: string[];
}
export interface SeedReliability {
  test: string;
  population?: string | null;
  measurementMethod?: string | null;
  icc?: number | null;
  iccModel?: string | null;
  cvPercent?: number | null;
  sem?: number | null;
  semUnit?: string | null;
  mdc95?: number | null;
  swc?: number | null;
  source: string;
  quote?: string;
  notes?: string | null;
}
export interface SeedReference {
  test: string;
  variable: string;
  unit: string;
  population: string;
  ageMin?: number | null;
  ageMax?: number | null;
  sex?: string | null;
  level?: string | null;
  sport?: string | null;
  sampleSize?: number | null;
  statisticType: 'mean_sd' | 'median_iqr' | 'percentiles' | 'cutoff' | 'category_bands';
  values: Record<string, unknown>;
  measurementMethod?: string | null;
  source: string;
  quote?: string;
  applicabilityNotes?: string | null;
  /** Measurement conditions (surface, timing system, moment of the season…). */
  condition?: string | null;
  limitations?: string | null;
}
export interface SeedBattery {
  slug: string;
  name: string;
  goalFamily: string;
  description: string;
  tests: { test: string; core: boolean; notes?: string }[];
}
export interface AssessmentSeed {
  sources: SeedSource[];
  tests: SeedTest[];
  reliability: SeedReliability[];
  references: SeedReference[];
  batteries: SeedBattery[];
}

export function loadAssessmentFiles(dir: string): AssessmentSeed {
  const read = <T>(f: string, fallback: T): T =>
    existsSync(join(dir, f)) ? (JSON.parse(readFileSync(join(dir, f), 'utf8')) as T) : fallback;
  const catalog = read<Partial<AssessmentSeed>>('catalog.json', {});
  const bats = read<{ batteries: SeedBattery[] }>('batteries.json', { batteries: [] });
  return {
    sources: catalog.sources ?? [],
    tests: catalog.tests ?? [],
    reliability: catalog.reliability ?? [],
    references: catalog.references ?? [],
    batteries: bats.batteries,
  };
}

const n = (v: number | null | undefined) => (v == null ? null : String(v));

export interface AssessmentSeedReport {
  tests: number;
  reliability: number;
  references: number;
  batteries: number;
  formulas: number;
}

export async function seedAssessment(
  db: Database,
  data: AssessmentSeed,
): Promise<AssessmentSeedReport> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const pops = new Map(
      (
        await tx
          .select({ id: populations.id, slug: populations.slug })
          .from(populations)
          .where(isNull(populations.organizationId))
      ).map((r) => [r.slug, r.id]),
    );
    const pop = (slug: string) => {
      const id = pops.get(slug);
      if (!id) throw new Error(`Assessment seed: unknown population «${slug}»`);
      return id;
    };
    // Resolve source keys to the (deduplicated) evidence rows by key, PMID or DOI.
    const sourceId = new Map<string, string>();
    for (const s of data.sources) {
      const ids = [eq(evidenceSources.sourceKey, s.key)];
      if (s.pmid) ids.push(eq(evidenceSources.pmid, s.pmid));
      if (s.doi) ids.push(eq(evidenceSources.doi, s.doi));
      const [row] = await tx
        .select({ id: evidenceSources.id })
        .from(evidenceSources)
        .where(and(isNull(evidenceSources.organizationId), or(...ids)));
      if (!row)
        throw new Error(
          `Assessment seed: source ${s.key} not imported (run the evidence seed first)`,
        );
      sourceId.set(s.key, row.id);
    }
    const src = (key: string) => {
      const id = sourceId.get(key);
      if (!id) throw new Error(`Assessment seed: unknown source «${key}»`);
      return id;
    };

    const testId = new Map<string, string>();
    for (const t of data.tests) {
      const values = {
        name: t.name,
        category: t.category,
        purpose: t.purpose ?? null,
        targetPopulations: t.targetPopulations ?? null,
        protocol: t.protocol ?? null,
        equipment: t.equipment ?? [],
        unit: t.unit,
        valueType: t.valueType,
        betterDirection: t.betterDirection,
        defaultAttempts: t.defaultAttempts ?? 1,
        aggregation: t.aggregation ?? 'best',
        aggregationN: t.aggregationN ?? null,
        sided: t.sided ?? false,
        isEstimate: t.isEstimate ?? false,
        limitations: t.limitations ?? null,
        plausibleMin: n(t.plausibleMin),
        plausibleMax: n(t.plausibleMax),
        sourceIds: (t.sources ?? []).map(src),
        status: 'published' as const,
      };
      const [existing] = await tx
        .select({ id: assessmentTests.id })
        .from(assessmentTests)
        .where(and(isNull(assessmentTests.organizationId), eq(assessmentTests.slug, t.slug)));
      let id: string;
      if (existing) {
        id = existing.id;
        await tx.update(assessmentTests).set(values).where(eq(assessmentTests.id, id));
      } else {
        const [row] = await tx
          .insert(assessmentTests)
          .values({ ...values, organizationId: null, slug: t.slug })
          .returning({ id: assessmentTests.id });
        id = row!.id;
      }
      testId.set(t.slug, id);
    }
    const test = (slug: string) => {
      const id = testId.get(slug);
      if (!id) throw new Error(`Assessment seed: unknown test «${slug}»`);
      return id;
    };

    const globalTestIds = [...testId.values()];
    if (globalTestIds.length) {
      await tx
        .delete(testReliabilityData)
        .where(
          and(
            isNull(testReliabilityData.organizationId),
            inArray(testReliabilityData.testId, globalTestIds),
          ),
        );
      await tx
        .delete(referenceValues)
        .where(
          and(
            isNull(referenceValues.organizationId),
            inArray(referenceValues.testId, globalTestIds),
          ),
        );
    }
    if (data.reliability.length) {
      await tx.insert(testReliabilityData).values(
        data.reliability.map((r) => ({
          organizationId: null,
          testId: test(r.test),
          populationId: r.population ? pop(r.population) : null,
          measurementMethod: r.measurementMethod ?? null,
          icc: n(r.icc),
          iccModel: r.iccModel ?? null,
          cvPercent: n(r.cvPercent),
          sem: n(r.sem),
          semUnit: r.semUnit ?? null,
          mdc95: n(r.mdc95),
          swc: n(r.swc),
          sourceId: src(r.source),
          isLocal: false,
          notes: [r.notes, r.quote ? `Cita: «${r.quote}»` : null].filter(Boolean).join(' ') || null,
        })),
      );
    }
    if (data.references.length) {
      await tx.insert(referenceValues).values(
        data.references.map((r) => ({
          organizationId: null,
          testId: test(r.test),
          variable: r.variable,
          unit: r.unit,
          populationId: pop(r.population),
          ageMin: r.ageMin ?? null,
          ageMax: r.ageMax ?? null,
          sex: r.sex ?? null,
          level: r.level ?? null,
          sport: r.sport ?? null,
          sampleSize: r.sampleSize ?? null,
          statisticType: r.statisticType,
          values: r.values,
          measurementMethod: r.measurementMethod ?? null,
          sourceId: src(r.source),
          applicabilityNotes:
            [r.applicabilityNotes, r.quote ? `Cita: «${r.quote}»` : null]
              .filter(Boolean)
              .join(' ') || null,
          condition: r.condition ?? null,
          limitations: r.limitations ?? null,
        })),
      );
    }

    // Derived formulas: the domain defaults are the platform's catalogue (one source of truth).
    // Global rows only; a centre's own copies are never touched.
    for (const f of DEFAULT_FORMULAS) {
      const values = {
        name: f.name,
        unit: f.unit,
        expression: f.expression,
        constants: f.constants,
        betterDirection: f.better,
        isEstimate: f.isEstimate,
        errorModel: f.errorModel,
        sex: f.sex ?? null,
        definition: f.definition,
        status: 'published' as const,
      };
      await tx
        .insert(derivedFormulas)
        .values({ ...values, organizationId: null, slug: f.slug })
        .onConflictDoUpdate({
          target: [derivedFormulas.organizationId, derivedFormulas.slug],
          set: values,
        });
    }

    for (const b of data.batteries) {
      const values = {
        name: b.name,
        goalFamily: b.goalFamily,
        description: b.description,
        status: 'published' as const,
      };
      const [existing] = await tx
        .select({ id: assessmentBatteries.id })
        .from(assessmentBatteries)
        .where(
          and(isNull(assessmentBatteries.organizationId), eq(assessmentBatteries.slug, b.slug)),
        );
      let id: string;
      if (existing) {
        id = existing.id;
        await tx.update(assessmentBatteries).set(values).where(eq(assessmentBatteries.id, id));
        await tx.delete(batteryTests).where(eq(batteryTests.batteryId, id));
      } else {
        const [row] = await tx
          .insert(assessmentBatteries)
          .values({ ...values, organizationId: null, slug: b.slug })
          .returning({ id: assessmentBatteries.id });
        id = row!.id;
      }
      await tx.insert(batteryTests).values(
        b.tests.map((t, i) => ({
          batteryId: id,
          testId: test(t.test),
          position: i + 1,
          isCore: t.core,
          notes: t.notes ?? null,
        })),
      );
    }
    return {
      tests: testId.size,
      reliability: data.reliability.length,
      references: data.references.length,
      batteries: data.batteries.length,
      formulas: DEFAULT_FORMULAS.length,
    };
  });
}
