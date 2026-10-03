/**
 * Global plan templates (§12.3) from seed-data/templates/*.json. Starting points, not recipes:
 * each template lists the methods whose evidence supports its doses. Idempotent by slug.
 */
import { validateDefinition, type TemplateDefinition } from '@tp/domain';
import { and, eq, isNull } from 'drizzle-orm';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '../client';
import { exercises, methods, planTemplates } from '../schema';

export interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  goal: string;
  level: string;
  methods: string[];
  definition: TemplateDefinition;
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
      };
      const [existing] = await tx
        .select({ id: planTemplates.id })
        .from(planTemplates)
        .where(and(isNull(planTemplates.organizationId), eq(planTemplates.slug, t.slug)));
      if (existing)
        await tx.update(planTemplates).set(values).where(eq(planTemplates.id, existing.id));
      else await tx.insert(planTemplates).values({ ...values, organizationId: null, slug: t.slug });
    }
    return { templates: templates.length };
  });
}
