/**
 * Global plan templates (§12.3) from seed-data/templates/*.json. Starting points, not recipes:
 * each template lists the methods whose evidence supports its doses. Idempotent by slug.
 */
import {
  sameJson,
  templateExerciseRefs,
  validateDefinition,
  type TemplateDefinition,
} from '@tp/domain';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '../client';
import {
  equipment,
  exerciseEquipment,
  exercises,
  methods,
  planTemplates,
  planTemplateVersions,
} from '../schema';

export interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  goal: string;
  level: string;
  methods: string[];
  definition: TemplateDefinition;
  /** Library filters (restructure phase 3). Defaults come from the goal and level. */
  profile?: string;
  levelN?: 1 | 2 | 3;
  population?: string[];
  kind?: 'training' | 'risk_reduction' | 'readaptation';
}

/** Programming profile of the first templates, by their goal. */
const PROFILE_OF_GOAL: Record<string, string> = {
  hypertrophy: 'hipertrofia',
  max_strength: 'fuerza',
  general_health: 'salud',
  team_sport_performance: 'deportes-equipo',
  endurance_sport_performance: 'deportes-resistencia',
  strength_initiation: 'iniciacion-fuerza',
};
const LEVEL_N: Record<string, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 };
const POPULATION_OF_PROFILE: Record<string, string[]> = {
  'deportes-equipo': ['deportistas', 'jovenes'],
  'deportes-resistencia': ['deportistas'],
  'deportes-individuales': ['deportistas'],
  'rendimiento-deportivo': ['deportistas'],
  'adulto-mayor': ['adulto_mayor'],
  'paralisis-cerebral-leve': ['pc_leve'],
};

/** Library facets of a seed template: explicit values or the defaults from its goal and level. */
export function templateFacets(t: SeedTemplate): {
  profile: string | null;
  levelN: 1 | 2 | 3 | null;
  population: string[];
  kind: NonNullable<SeedTemplate['kind']>;
} {
  const profile = t.profile ?? PROFILE_OF_GOAL[t.goal] ?? null;
  return {
    profile,
    levelN: t.levelN ?? LEVEL_N[t.level] ?? null,
    population: t.population ?? (profile ? (POPULATION_OF_PROFILE[profile] ?? ['adultos']) : []),
    kind: t.kind ?? 'training',
  };
}

export function loadTemplateFiles(dir: string): SeedTemplate[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap(
      (f) =>
        (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { templates: SeedTemplate[] }).templates,
    );
}

export async function seedTemplates(
  db: Database,
  templates: SeedTemplate[],
): Promise<{ templates: number }> {
  if (!templates.length) return { templates: 0 };
  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const ex = new Set(
      (
        await tx
          .select({ slug: exercises.slug })
          .from(exercises)
          .where(and(isNull(exercises.organizationId), eq(exercises.status, 'published')))
      ).map((r) => r.slug),
    );
    const ms = new Set(
      (
        await tx.select({ slug: methods.slug }).from(methods).where(isNull(methods.organizationId))
      ).map((r) => r.slug),
    );
    // Equipment each global exercise cannot be done without (for the «material» filter).
    const eqRows = await tx
      .select({ exercise: exercises.slug, equipment: equipment.slug })
      .from(exerciseEquipment)
      .innerJoin(exercises, eq(exercises.id, exerciseEquipment.exerciseId))
      .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
      .where(and(isNull(exercises.organizationId), eq(exerciseEquipment.optional, false)));
    const needs = (def: TemplateDefinition) => {
      const refs = new Set(templateExerciseRefs(def));
      return [
        ...new Set(eqRows.filter((r) => refs.has(r.exercise)).map((r) => r.equipment)),
      ].sort();
    };
    for (const t of templates) {
      const issues = validateDefinition(t.definition);
      if (issues.length)
        throw new Error(
          `Template ${t.slug}: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`,
        );
      const sessions = [
        ...t.definition.sessions,
        ...(t.definition.weeks ?? []).flatMap((w) => w.sessions),
      ];
      for (const s of sessions)
        for (const b of s.blocks)
          for (const e of b.exercises) {
            if (!ex.has(e.exercise))
              throw new Error(`Template ${t.slug}: unknown global exercise «${e.exercise}»`);
            for (const m of e.methods ?? [])
              if (!ms.has(m)) throw new Error(`Template ${t.slug}: unknown method «${m}»`);
          }
      for (const m of t.methods)
        if (!ms.has(m)) throw new Error(`Template ${t.slug}: unknown method «${m}»`);
      const facets = templateFacets(t);
      const values = {
        name: t.name,
        description: t.description,
        goalSlug: t.goal,
        level: t.level,
        sessionsPerWeek: t.definition.sessionsPerWeek,
        durationMonths: t.definition.durationMonths,
        definition: t.definition,
        methodSlugs: t.methods,
        status: 'published' as const,
        profileSlug: facets.profile,
        levelN: facets.levelN,
        population: facets.population,
        equipmentSlugs: needs(t.definition),
        kind: facets.kind,
      };
      const [existing] = await tx
        .select({
          id: planTemplates.id,
          definition: planTemplates.definition,
          templateVersion: planTemplates.templateVersion,
        })
        .from(planTemplates)
        .where(and(isNull(planTemplates.organizationId), eq(planTemplates.slug, t.slug)));
      if (existing) {
        // A change of content made by the platform is a new version: plans keep theirs.
        // jsonb reorders keys: compare content, or every start would make a new version.
        const changed = !sameJson(existing.definition, t.definition);
        const templateVersion = existing.templateVersion + (changed ? 1 : 0);
        await tx
          .update(planTemplates)
          .set({ ...values, templateVersion })
          .where(eq(planTemplates.id, existing.id));
        await ensureVersion(tx, existing.id, templateVersion, t, changed);
      } else {
        const [row] = await tx
          .insert(planTemplates)
          .values({ ...values, organizationId: null, slug: t.slug })
          .returning({ id: planTemplates.id });
        await ensureVersion(tx, row!.id, 1, t, false);
      }
    }
    return { templates: templates.length };
  });
}

/** Every global template has its current version recorded (history and plan provenance). */
async function ensureVersion(
  tx: Database,
  templateId: string,
  version: number,
  t: SeedTemplate,
  changed: boolean,
) {
  const [latest] = await tx
    .select({ version: planTemplateVersions.version })
    .from(planTemplateVersions)
    .where(eq(planTemplateVersions.templateId, templateId))
    .orderBy(desc(planTemplateVersions.version))
    .limit(1);
  if (latest && latest.version >= version) return;
  await tx.insert(planTemplateVersions).values({
    organizationId: null,
    templateId,
    version,
    name: t.name,
    definition: t.definition,
    note: changed ? 'Actualizada por la plataforma' : 'Versión inicial',
  });
}
