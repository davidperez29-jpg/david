/**
 * Shared template helpers (restructure phase 3): versions, the equipment a template needs and the
 * blank definition of a new template. Used by the template library (templates.ts) and by planning
 * (save a plan as a template, create a plan from a template).
 */
import { schema, type Executor } from '@tp/db';
import {
  defaultWeekTypes,
  groupsIntoLatestVersion,
  templateExerciseRefs,
  weeksFor,
  type PlanDuration,
  type TemplateDefinition,
} from '@tp/domain';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { RequestContext } from './context';

const { planTemplateVersions, exercises, exerciseEquipment, equipment } = schema;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Equipment (slugs) the template's exercises cannot be done without, sorted. */
export async function templateEquipment(
  db: Executor,
  ctx: RequestContext,
  def: TemplateDefinition,
): Promise<string[]> {
  const refs = templateExerciseRefs(def);
  const ids = refs.filter((r) => UUID_RE.test(r));
  const slugs = refs.filter((r) => !UUID_RE.test(r));
  const conds = [];
  if (ids.length) conds.push(inArray(exercises.id, ids));
  if (slugs.length)
    conds.push(and(isNull(exercises.organizationId), inArray(exercises.slug, slugs)));
  if (!conds.length) return [];
  const rows = await db
    .selectDistinct({ slug: equipment.slug })
    .from(exerciseEquipment)
    .innerJoin(exercises, eq(exercises.id, exerciseEquipment.exerciseId))
    .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
    .where(
      and(
        eq(exerciseEquipment.optional, false),
        or(
          isNull(exercises.organizationId),
          eq(exercises.organizationId, ctx.actor.organizationId),
        ),
        or(...conds),
      ),
    );
  return rows.map((r) => r.slug).sort();
}

/**
 * Records a saved edit of a template's content as a version (decision A18): a new version, or the
 * latest one updated while the same person keeps editing and no plan has been made from it.
 * Returns the version number that is now current.
 */
export async function recordTemplateVersion(
  tx: Executor,
  ctx: RequestContext,
  template: { id: string; organizationId: string | null },
  content: { name: string; definition: TemplateDefinition },
  opts: { note?: string | null; forceNew?: boolean } = {},
): Promise<number> {
  const [latest] = await tx
    .select()
    .from(planTemplateVersions)
    .where(eq(planTemplateVersions.templateId, template.id))
    .orderBy(desc(planTemplateVersions.version))
    .limit(1);
  if (
    latest &&
    !opts.forceNew &&
    groupsIntoLatestVersion(
      {
        createdBy: latest.createdBy,
        updatedAt: latest.updatedAt,
        usedByPlans: latest.usedAt ? 1 : 0,
      },
      ctx.actor.userId,
      ctx.now(),
    )
  ) {
    await tx
      .update(planTemplateVersions)
      .set({
        name: content.name,
        definition: content.definition,
        note: opts.note ?? latest.note,
        updatedBy: ctx.actor.userId,
        updatedAt: ctx.now(),
      })
      .where(eq(planTemplateVersions.id, latest.id));
    return latest.version;
  }
  const version = (latest?.version ?? 0) + 1;
  await tx.insert(planTemplateVersions).values({
    organizationId: template.organizationId,
    templateId: template.id,
    version,
    name: content.name,
    definition: content.definition,
    note: opts.note ?? null,
    createdBy: ctx.actor.userId,
    createdAt: ctx.now(),
    updatedAt: ctx.now(),
  });
  return version;
}

/** Marks the version a plan was made from as used: from then on it never changes. */
export async function markTemplateVersionUsed(
  tx: Executor,
  ctx: RequestContext,
  templateId: string,
  version: number,
): Promise<void> {
  await tx
    .update(planTemplateVersions)
    .set({ usedAt: ctx.now() })
    .where(
      and(
        eq(planTemplateVersions.templateId, templateId),
        eq(planTemplateVersions.version, version),
        isNull(planTemplateVersions.usedAt),
      ),
    );
}

const LETTERS = 'ABCDEFG';

/**
 * «Crear desde cero»: one phase with 4-week mesocycles filling the duration and the sessions of a
 * week (A, B, C…) with an empty main block, ready to be filled in the table.
 */
export function blankDefinition(sessionsPerWeek: number, months: PlanDuration): TemplateDefinition {
  const total = weeksFor(months);
  const lengths: number[] = [];
  for (let left = total; left > 0;) {
    const w = left <= 6 ? left : 4;
    lengths.push(w);
    left -= w;
  }
  return {
    durationMonths: months,
    sessionsPerWeek,
    phases: [
      {
        name: 'Plan',
        mesocycles: lengths.map((weeks, i) => ({
          name: `Mesociclo ${i + 1}`,
          weeks,
          weekTypes: defaultWeekTypes(weeks),
          assessmentPlanned: i === lengths.length - 1,
        })),
      },
    ],
    sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
      dayLabel: LETTERS[i] ?? String(i + 1),
      title: `Sesión ${LETTERS[i] ?? i + 1}`,
      blocks: [{ type: 'main_strength', organization: 'straight_sets', exercises: [] }],
    })),
  };
}
