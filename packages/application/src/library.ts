import {
  addVideoSchema,
  createExerciseSchema,
  exerciseLoadIncrementSchema,
  listExercisesSchema,
  progressionSchema,
  reviewSchema,
  setStatusSchema,
  substitutesQuerySchema,
  toleranceSchema,
  updateExerciseSchema,
  verifyMediaSchema,
  type Page,
} from '@tp/contracts';
import { MUSCLE_GROUP_NAMES, schema, uuidv7, type Executor } from '@tp/db';
import {
  diffFields,
  DomainError,
  findProgressionCycle,
  loadIncrementFor,
  parseVideoUrl,
  PENDING_VIDEO_TEXT,
  publishProblems,
  slugify,
  suggestSubstitutes,
  type ExerciseFacts,
  type Level,
} from '@tp/domain';
import { and, asc, count, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { IMAGE_MAX_BYTES, sniffImage } from './storage';
import { parse } from './validation';

const {
  exercises,
  exerciseLoadIncrements,
  exerciseCategoryLinks,
  exerciseTagLinks,
  exerciseMuscles,
  exerciseEquipment,
  exerciseInstructions,
  exerciseMedia,
  exerciseProgressions,
  exerciseMethodLinks,
  exerciseCategories,
  exerciseTags,
  movementPatterns,
  muscles,
  equipment,
  prescriptionProfiles,
  files,
  clientEquipment,
  clientTrainingProfiles,
  exerciseTolerances,
} = schema;

/** Global (platform) content + own organization. */
const visibleTo = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));

// ── Taxonomies ────────────────────────────────────────────────────────────────

async function listLibraryTaxonomies_(ctx: RequestContext) {
  requirePermission(ctx, 'library:read');
  const org = ctx.actor.organizationId;
  const vis = <T extends { organizationId: AnyPgColumn }>(t: T) =>
    or(isNull(t.organizationId), eq(t.organizationId, org));
  const [patterns, muscleRows, categories, tags, equipmentRows, profiles] = await Promise.all([
    ctx.db
      .select({
        id: movementPatterns.id,
        slug: movementPatterns.slug,
        name: movementPatterns.name,
        family: movementPatterns.family,
      })
      .from(movementPatterns)
      .where(vis(movementPatterns))
      .orderBy(asc(movementPatterns.sortOrder)),
    ctx.db
      .select({
        id: muscles.id,
        slug: muscles.slug,
        name: muscles.name,
        groupSlug: muscles.groupSlug,
        region: muscles.region,
      })
      .from(muscles)
      .where(vis(muscles))
      .orderBy(asc(muscles.region), asc(muscles.name)),
    ctx.db
      .select({
        id: exerciseCategories.id,
        slug: exerciseCategories.slug,
        name: exerciseCategories.name,
        parentId: exerciseCategories.parentId,
      })
      .from(exerciseCategories)
      .where(vis(exerciseCategories))
      .orderBy(asc(exerciseCategories.sortOrder)),
    ctx.db
      .select({ id: exerciseTags.id, slug: exerciseTags.slug, name: exerciseTags.name })
      .from(exerciseTags)
      .where(vis(exerciseTags))
      .orderBy(asc(exerciseTags.name)),
    ctx.db
      .select({
        id: equipment.id,
        slug: equipment.slug,
        name: equipment.name,
        category: equipment.category,
      })
      .from(equipment)
      .where(vis(equipment))
      .orderBy(asc(equipment.category), asc(equipment.name)),
    ctx.db
      .select({
        id: prescriptionProfiles.id,
        slug: prescriptionProfiles.slug,
        name: prescriptionProfiles.name,
        variableKeys: prescriptionProfiles.variableKeys,
      })
      .from(prescriptionProfiles)
      .where(vis(prescriptionProfiles)),
  ]);
  return { patterns, muscles: muscleRows, categories, tags, equipment: equipmentRows, profiles };
}
export type LibraryTaxonomies = Awaited<ReturnType<typeof listLibraryTaxonomies_>>;

// ── Listing & search ──────────────────────────────────────────────────────────

export interface ExerciseSummary {
  id: string;
  name: string;
  pattern: string | null;
  categories: string[];
  level: string | null;
  status: string;
  needsReview: boolean;
  isGlobal: boolean;
  video: 'verified' | 'pending' | 'none';
  hasSilhouette: boolean;
  primaryMuscles: string[];
}

async function listExercises_(ctx: RequestContext, query: unknown): Promise<Page<ExerciseSummary>> {
  const q = parse(listExercisesSchema, query ?? {});
  requirePermission(ctx, 'library:read');
  const conds: (SQL | undefined)[] = [visibleTo(ctx, exercises.organizationId)];
  if (q.scope === 'organization')
    conds.push(eq(exercises.organizationId, ctx.actor.organizationId));
  if (q.scope === 'global') conds.push(isNull(exercises.organizationId));
  conds.push(q.status ? eq(exercises.status, q.status) : ne(exercises.status, 'archived'));
  if (q.needsReview) conds.push(eq(exercises.needsReview, q.needsReview === 'true'));
  if (q.patternId) conds.push(eq(exercises.movementPatternId, q.patternId));
  if (q.level) conds.push(eq(exercises.level, q.level));
  if (q.region) conds.push(eq(exercises.bodyRegion, q.region));
  if (q.laterality) conds.push(eq(exercises.laterality, q.laterality));
  if (q.contraction) conds.push(sql`${q.contraction} = ANY(${exercises.contractionEmphasis})`);
  if (q.categoryId) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM exercise_category_links l WHERE l.exercise_id = ${exercises.id} AND l.category_id = ${q.categoryId})`,
    );
  }
  if (q.muscleGroup) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM exercise_muscles em JOIN muscles m ON m.id = em.muscle_id WHERE em.exercise_id = ${exercises.id} AND em.role = 'primary' AND m.group_slug = ${q.muscleGroup})`,
    );
  }
  if (q.equipmentIds && q.equipmentIds.length) {
    // Doable with the selected equipment: no required item outside the list.
    conds.push(
      sql`NOT EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = ${exercises.id} AND NOT ee.optional AND NOT (ee.equipment_id = ANY(ARRAY[${sql.join(
        q.equipmentIds.map((eid) => sql`${eid}::uuid`),
        sql`, `,
      )}])))`,
    );
  }
  if (q.video === 'verified')
    conds.push(
      sql`EXISTS (SELECT 1 FROM exercise_media m WHERE m.exercise_id = ${exercises.id} AND m.type = 'video' AND m.status = 'verified')`,
    );
  if (q.video === 'pending')
    conds.push(
      sql`EXISTS (SELECT 1 FROM exercise_media m WHERE m.exercise_id = ${exercises.id} AND m.type = 'video' AND m.status = 'pending_verification')`,
    );
  if (q.video === 'none')
    conds.push(
      sql`NOT EXISTS (SELECT 1 FROM exercise_media m WHERE m.exercise_id = ${exercises.id} AND m.type = 'video' AND m.status IN ('verified','pending_verification'))`,
    );
  let rank: SQL | undefined;
  if (q.q) {
    const term = q.q.toLowerCase();
    const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const nameExpr = sql`lower(immutable_unaccent(${exercises.name}))`;
    const altExpr = sql`lower(immutable_unaccent(array_to_string(${exercises.altNames}, ' ')))`;
    const termExpr = sql`lower(immutable_unaccent(${term}))`;
    conds.push(
      sql`(${nameExpr} LIKE lower(immutable_unaccent(${like})) OR ${altExpr} LIKE lower(immutable_unaccent(${like})) OR similarity(${nameExpr}, ${termExpr}) > 0.35)`,
    );
    rank = sql`similarity(${nameExpr}, ${termExpr}) DESC`;
  }
  const where = and(...conds);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(exercises)
    .where(where);
  const rows = await ctx.db
    .select({
      id: exercises.id,
      name: exercises.name,
      pattern: movementPatterns.name,
      level: exercises.level,
      status: exercises.status,
      needsReview: exercises.needsReview,
      organizationId: exercises.organizationId,
    })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(where)
    .orderBy(...(rank ? [rank, asc(exercises.name)] : [asc(exercises.name)]))
    .limit(q.limit)
    .offset(q.offset);
  const ids = rows.map((r) => r.id);
  const [cats, media, prim] = ids.length
    ? await Promise.all([
        ctx.db
          .select({ id: exerciseCategoryLinks.exerciseId, name: exerciseCategories.name })
          .from(exerciseCategoryLinks)
          .innerJoin(
            exerciseCategories,
            eq(exerciseCategories.id, exerciseCategoryLinks.categoryId),
          )
          .where(inArray(exerciseCategoryLinks.exerciseId, ids)),
        ctx.db
          .select({
            id: exerciseMedia.exerciseId,
            type: exerciseMedia.type,
            status: exerciseMedia.status,
          })
          .from(exerciseMedia)
          .where(inArray(exerciseMedia.exerciseId, ids)),
        ctx.db
          .select({ id: exerciseMuscles.exerciseId, name: muscles.name })
          .from(exerciseMuscles)
          .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
          .where(
            and(inArray(exerciseMuscles.exerciseId, ids), eq(exerciseMuscles.role, 'primary')),
          ),
      ])
    : [[], [], []];
  return {
    items: rows.map((r) => {
      const m = media.filter((x) => x.id === r.id);
      const videos = m.filter((x) => x.type === 'video');
      return {
        id: r.id,
        name: r.name,
        pattern: r.pattern,
        categories: cats.filter((c) => c.id === r.id).map((c) => c.name),
        level: r.level,
        status: r.status,
        needsReview: r.needsReview,
        isGlobal: r.organizationId === null,
        video: videos.some((v) => v.status === 'verified')
          ? 'verified'
          : videos.some((v) => v.status === 'pending_verification')
            ? 'pending'
            : 'none',
        hasSilhouette: m.some((x) => x.type === 'silhouette' && x.status !== 'replaced'),
        primaryMuscles: prim.filter((p) => p.id === r.id).map((p) => p.name),
      };
    }),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}

// ── Detail ────────────────────────────────────────────────────────────────────

async function loadVisible(ctx: RequestContext, id: string) {
  const [row] = await ctx.db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), visibleTo(ctx, exercises.organizationId)));
  if (!row) throw new DomainError('not_found', 'Ejercicio no encontrado.');
  return row;
}

async function loadOwn(ctx: RequestContext, id: string) {
  const row = await loadVisible(ctx, id);
  if (row.organizationId === null) {
    throw new DomainError(
      'forbidden',
      'Los ejercicios globales no se editan: duplícalo en tu organización.',
    );
  }
  return row;
}

/**
 * Sets (or clears, with null) the centre's own load increment for an exercise, global or its own
 * (restructure phase 13). The programming engine uses it for load progressions. Audited.
 */
async function setExerciseLoadIncrement_(ctx: RequestContext, id: string, input: unknown) {
  const { incrementKg } = parse(exerciseLoadIncrementSchema, input);
  requirePermission(ctx, 'library:write');
  await loadVisible(ctx, id);
  const key = and(
    eq(exerciseLoadIncrements.exerciseId, id),
    eq(exerciseLoadIncrements.organizationId, ctx.actor.organizationId),
  );
  const [before] = await ctx.db
    .select({ kg: exerciseLoadIncrements.incrementKg })
    .from(exerciseLoadIncrements)
    .where(key);
  if (incrementKg == null) await ctx.db.delete(exerciseLoadIncrements).where(key);
  else
    await ctx.db
      .insert(exerciseLoadIncrements)
      .values({
        organizationId: ctx.actor.organizationId,
        exerciseId: id,
        incrementKg: String(incrementKg),
        updatedBy: ctx.actor.userId,
      })
      .onConflictDoUpdate({
        target: [exerciseLoadIncrements.organizationId, exerciseLoadIncrements.exerciseId],
        set: {
          incrementKg: String(incrementKg),
          updatedBy: ctx.actor.userId,
          updatedAt: ctx.now(),
        },
      });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'exercise_load_increment',
    entityId: id,
    changes: [
      { field: 'incrementKg', before: before ? Number(before.kg) : null, after: incrementKg },
    ],
  });
  return { incrementKg };
}

async function getExercise_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'library:read');
  const e = await loadVisible(ctx, id);
  const [pattern] = e.movementPatternId
    ? await ctx.db
        .select()
        .from(movementPatterns)
        .where(eq(movementPatterns.id, e.movementPatternId))
    : [];
  const [cats, tags, mus, eq_, instr, media, outgoing, incoming, methods] = await Promise.all([
    ctx.db
      .select({
        id: exerciseCategories.id,
        name: exerciseCategories.name,
        isPrimary: exerciseCategoryLinks.isPrimary,
      })
      .from(exerciseCategoryLinks)
      .innerJoin(exerciseCategories, eq(exerciseCategories.id, exerciseCategoryLinks.categoryId))
      .where(eq(exerciseCategoryLinks.exerciseId, id)),
    ctx.db
      .select({ id: exerciseTags.id, name: exerciseTags.name })
      .from(exerciseTagLinks)
      .innerJoin(exerciseTags, eq(exerciseTags.id, exerciseTagLinks.tagId))
      .where(eq(exerciseTagLinks.exerciseId, id)),
    ctx.db
      .select({
        muscleId: muscles.id,
        name: muscles.name,
        groupSlug: muscles.groupSlug,
        role: exerciseMuscles.role,
      })
      .from(exerciseMuscles)
      .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
      .where(eq(exerciseMuscles.exerciseId, id)),
    ctx.db
      .select({
        equipmentId: equipment.id,
        name: equipment.name,
        slug: equipment.slug,
        optional: exerciseEquipment.optional,
      })
      .from(exerciseEquipment)
      .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
      .where(eq(exerciseEquipment.exerciseId, id)),
    ctx.db
      .select()
      .from(exerciseInstructions)
      .where(eq(exerciseInstructions.exerciseId, id))
      .orderBy(asc(exerciseInstructions.kind), asc(exerciseInstructions.position)),
    ctx.db
      .select()
      .from(exerciseMedia)
      .where(eq(exerciseMedia.exerciseId, id))
      .orderBy(asc(exerciseMedia.createdAt)),
    ctx.db
      .select({
        id: exerciseProgressions.id,
        otherId: exerciseProgressions.toExerciseId,
        name: exercises.name,
        relation: exerciseProgressions.relation,
        axes: exerciseProgressions.axes,
        notes: exerciseProgressions.notes,
        organizationId: exerciseProgressions.organizationId,
      })
      .from(exerciseProgressions)
      .innerJoin(exercises, eq(exercises.id, exerciseProgressions.toExerciseId))
      .where(
        and(
          eq(exerciseProgressions.fromExerciseId, id),
          visibleTo(ctx, exerciseProgressions.organizationId),
        ),
      ),
    ctx.db
      .select({
        id: exerciseProgressions.id,
        otherId: exerciseProgressions.fromExerciseId,
        name: exercises.name,
        relation: exerciseProgressions.relation,
        axes: exerciseProgressions.axes,
        notes: exerciseProgressions.notes,
        organizationId: exerciseProgressions.organizationId,
      })
      .from(exerciseProgressions)
      .innerJoin(exercises, eq(exercises.id, exerciseProgressions.fromExerciseId))
      .where(
        and(
          eq(exerciseProgressions.toExerciseId, id),
          visibleTo(ctx, exerciseProgressions.organizationId),
        ),
      ),
    ctx.db
      .select({ methodId: exerciseMethodLinks.methodId })
      .from(exerciseMethodLinks)
      .where(eq(exerciseMethodLinks.exerciseId, id)),
  ]);
  // Relations from the point of view of this exercise (incoming edges are inverted).
  const invert = {
    progression: 'regression',
    regression: 'progression',
    variant: 'variant',
  } as const;
  const related = [
    ...outgoing.map((o) => ({ ...o, relation: o.relation, direction: 'out' as const })),
    ...incoming.map((i) => ({ ...i, relation: invert[i.relation], direction: 'in' as const })),
  ];
  const profileKeys = e.prescriptionProfileId
    ? ((
        await ctx.db
          .select({ keys: prescriptionProfiles.variableKeys, name: prescriptionProfiles.name })
          .from(prescriptionProfiles)
          .where(eq(prescriptionProfiles.id, e.prescriptionProfileId))
      )[0] ?? null)
    : null;
  const [own] = await ctx.db
    .select({ kg: exerciseLoadIncrements.incrementKg })
    .from(exerciseLoadIncrements)
    .where(
      and(
        eq(exerciseLoadIncrements.exerciseId, id),
        eq(exerciseLoadIncrements.organizationId, ctx.actor.organizationId),
      ),
    );
  const defaultKg = loadIncrementFor(eq_.map((x) => x.slug));
  return {
    ...e,
    isGlobal: e.organizationId === null,
    /** Smallest load jump the programming engine proposes for this exercise (phase 13). */
    loadIncrement: {
      kg: own ? Number(own.kg) : defaultKg,
      custom: !!own,
      defaultKg,
    },
    pattern: pattern ? { id: pattern.id, name: pattern.name, family: pattern.family } : null,
    profile: profileKeys,
    categories: cats,
    tags,
    muscles: mus,
    equipment: eq_,
    instructions: instr,
    media: media.map((m) => ({
      ...m,
      embedUrl: m.type === 'video' ? (parseVideoUrl(m.urlOrKey)?.embedUrl ?? null) : null,
      fileUrl: m.provider === 'upload' ? `/api/v1/files/${m.urlOrKey}` : null,
      notice: m.type === 'video' && m.status === 'pending_verification' ? PENDING_VIDEO_TEXT : null,
    })),
    related,
    methodIds: methods.map((m) => m.methodId),
    publishProblems: publishProblems({
      name: e.name,
      movementPatternId: e.movementPatternId,
      patternFamily: pattern?.family ?? null,
      categoryCount: cats.length,
      primaryMuscleCount: mus.filter((m) => m.role === 'primary').length,
      level: e.level,
      clientDescription: e.clientDescription,
      prescriptionProfileId: e.prescriptionProfileId,
      needsReview: e.needsReview,
    }),
  };
}
export type ExerciseDetail = Awaited<ReturnType<typeof getExercise_>>;

// ── Create / update ───────────────────────────────────────────────────────────

const SCALAR_FIELDS = [
  'name',
  'altNames',
  'movementPatternId',
  'bodyRegion',
  'laterality',
  'planes',
  'contractionEmphasis',
  'intendedVelocity',
  'level',
  'spaceRequired',
  'technicalComplexity',
  'axialLoad',
  'impactLevel',
  'clientDescription',
  'trainerDescription',
  'prescriptionProfileId',
  'supportsVbt',
  'contactsPerRep',
] as const;

type ExerciseInput = z.output<typeof createExerciseSchema>;

async function uniqueSlug(
  tx: Executor,
  orgId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name);
  const rows = await tx
    .select({ slug: exercises.slug, id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.organizationId, orgId), sql`${exercises.slug} LIKE ${`${base}%`}`));
  const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Ensures every referenced taxonomy id is global or belongs to the organization. */
async function assertVisibleIds(
  ctx: RequestContext,
  tx: Executor,
  data: Partial<ExerciseInput>,
): Promise<void> {
  const check = async (
    table: { id: AnyPgColumn; organizationId: AnyPgColumn },
    ids: (string | null | undefined)[],
    field: string,
  ) => {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return;
    const rows = await tx
      .select({ id: table.id })
      .from(table as never)
      .where(and(inArray(table.id, list), visibleTo(ctx, table.organizationId)));
    if (rows.length !== list.length)
      throw new DomainError('validation', 'Referencia desconocida.', { [field]: ['unknown'] });
  };
  await check(movementPatterns, [data.movementPatternId], 'movementPatternId');
  await check(prescriptionProfiles, [data.prescriptionProfileId], 'prescriptionProfileId');
  await check(exerciseCategories, data.categoryIds ?? [], 'categoryIds');
  await check(exerciseTags, data.tagIds ?? [], 'tagIds');
  await check(
    muscles,
    (data.muscles ?? []).map((m) => m.muscleId),
    'muscles',
  );
  await check(
    equipment,
    (data.equipment ?? []).map((m) => m.equipmentId),
    'equipment',
  );
}

async function writeRelations(
  tx: Executor,
  exerciseId: string,
  data: Partial<ExerciseInput>,
): Promise<void> {
  if (data.categoryIds) {
    await tx.delete(exerciseCategoryLinks).where(eq(exerciseCategoryLinks.exerciseId, exerciseId));
    if (data.categoryIds.length) {
      await tx.insert(exerciseCategoryLinks).values(
        [...new Set(data.categoryIds)].map((categoryId, i) => ({
          exerciseId,
          categoryId,
          isPrimary: i === 0,
        })),
      );
    }
  }
  if (data.tagIds) {
    await tx.delete(exerciseTagLinks).where(eq(exerciseTagLinks.exerciseId, exerciseId));
    if (data.tagIds.length)
      await tx
        .insert(exerciseTagLinks)
        .values([...new Set(data.tagIds)].map((tagId) => ({ exerciseId, tagId })));
  }
  if (data.muscles) {
    await tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, exerciseId));
    const uniq = new Map(data.muscles.map((m) => [m.muscleId, m.role]));
    if (uniq.size)
      await tx
        .insert(exerciseMuscles)
        .values([...uniq].map(([muscleId, role]) => ({ exerciseId, muscleId, role })));
  }
  if (data.equipment) {
    await tx.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, exerciseId));
    const uniq = new Map(data.equipment.map((m) => [m.equipmentId, m.optional]));
    if (uniq.size)
      await tx
        .insert(exerciseEquipment)
        .values(
          [...uniq].map(([equipmentId, optional]) => ({ exerciseId, equipmentId, optional })),
        );
  }
  if (data.instructions) {
    await tx.delete(exerciseInstructions).where(eq(exerciseInstructions.exerciseId, exerciseId));
    const pos: Record<string, number> = {};
    if (data.instructions.length) {
      await tx.insert(exerciseInstructions).values(
        data.instructions.map((i) => ({
          exerciseId,
          kind: i.kind,
          text: i.text,
          audience: i.audience,
          position: (pos[i.kind] = (pos[i.kind] ?? 0) + 1),
        })),
      );
    }
  }
}

function scalarValues(data: Partial<ExerciseInput>) {
  const v: Record<string, unknown> = {};
  for (const k of SCALAR_FIELDS) if (data[k] !== undefined) v[k] = data[k] ?? null;
  if (v.altNames === null) v.altNames = [];
  if (v.planes === null) v.planes = [];
  if (v.contractionEmphasis === null) v.contractionEmphasis = [];
  if (v.supportsVbt === null) v.supportsVbt = false;
  return v;
}

async function createExercise_(
  ctx: RequestContext,
  input: unknown,
  meta: {
    source?: string;
    sourceRef?: string;
    needsReview?: boolean;
    reviewNotes?: string;
    derivedFromId?: string;
  } = {},
): Promise<{ id: string }> {
  const data = parse(createExerciseSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  return ctx.db.transaction(async (tx) => {
    await assertVisibleIds(ctx, tx, data);
    const id = uuidv7();
    await tx.insert(exercises).values({
      id,
      organizationId: ctx.actor.organizationId,
      slug: await uniqueSlug(tx, ctx.actor.organizationId, data.name),
      ...(scalarValues(data) as { name: string }),
      status: 'draft',
      source: meta.source ?? 'manual',
      sourceRef: meta.sourceRef ?? null,
      needsReview: meta.needsReview ?? false,
      reviewNotes: meta.reviewNotes ?? null,
      derivedFromId: meta.derivedFromId ?? null,
      createdBy: ctx.actor.userId,
      updatedBy: ctx.actor.userId,
    });
    await writeRelations(tx, id, data);
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'exercise',
      entityId: id,
      changes: { name: data.name, source: meta.source ?? 'manual' },
    });
    return { id };
  });
}

async function updateExercise_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<{ version: number }> {
  const { expectedVersion, ...data } = parse(updateExerciseSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  const before = await loadOwn(ctx, id);
  if (before.version !== expectedVersion)
    throw new DomainError(
      'conflict',
      'Otra persona ha modificado este ejercicio. Recarga los datos.',
    );
  return ctx.db.transaction(async (tx) => {
    await assertVisibleIds(ctx, tx, data);
    const values = scalarValues(data);
    if (data.name && data.name !== before.name)
      values.slug = await uniqueSlug(tx, before.organizationId!, data.name, id);
    const updated = await tx
      .update(exercises)
      .set({ ...values, version: before.version + 1, updatedBy: ctx.actor.userId })
      .where(and(eq(exercises.id, id), eq(exercises.version, expectedVersion)))
      .returning({ id: exercises.id });
    if (!updated.length)
      throw new DomainError(
        'conflict',
        'Otra persona ha modificado este ejercicio. Recarga los datos.',
      );
    await writeRelations(tx, id, data);
    const changes = diffFields(
      before as unknown as Record<string, unknown>,
      { ...before, ...values } as Record<string, unknown>,
      SCALAR_FIELDS as unknown as string[],
    );
    const relationKeys = (
      ['categoryIds', 'tagIds', 'muscles', 'equipment', 'instructions'] as const
    ).filter((k) => data[k] !== undefined);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'exercise',
      entityId: id,
      changes: [
        ...changes,
        ...relationKeys.map((k) => ({ field: k, before: '…', after: 'actualizado' })),
      ],
    });
    // Content changed: a published exercise keeps its status; the trainer re-publishes nothing.
    return { version: before.version + 1 };
  });
}

/** Copies a global exercise into the organization so it can be edited (§6.1.2). */
async function forkExercise_(ctx: RequestContext, id: string): Promise<{ id: string }> {
  const src = await getExercise_(ctx, id);
  if (!src.isGlobal)
    throw new DomainError(
      'validation',
      'Solo se duplican ejercicios globales; usa «duplicar» en los propios.',
    );
  return createExercise_(ctx, toInput(src), {
    source: 'fork',
    sourceRef: src.id,
    derivedFromId: src.id,
  });
}

/** Duplicates any visible exercise as a new draft in the organization. */
async function duplicateExercise_(ctx: RequestContext, id: string): Promise<{ id: string }> {
  const src = await getExercise_(ctx, id);
  return createExercise_(
    ctx,
    { ...toInput(src), name: `${src.name} (copia)`.slice(0, 120) },
    {
      source: 'duplicate',
      sourceRef: src.id,
      derivedFromId: src.isGlobal ? src.id : (src.derivedFromId ?? undefined),
    },
  );
}

function toInput(src: ExerciseDetail): ExerciseInput {
  return {
    name: src.name,
    altNames: src.altNames,
    movementPatternId: src.movementPatternId,
    bodyRegion: src.bodyRegion,
    laterality: src.laterality,
    planes: src.planes,
    contractionEmphasis: src.contractionEmphasis,
    intendedVelocity: src.intendedVelocity,
    level: src.level,
    spaceRequired: src.spaceRequired,
    technicalComplexity: src.technicalComplexity,
    axialLoad: src.axialLoad,
    impactLevel: src.impactLevel,
    clientDescription: src.clientDescription,
    trainerDescription: src.trainerDescription,
    prescriptionProfileId: src.prescriptionProfileId,
    supportsVbt: src.supportsVbt,
    contactsPerRep: src.contactsPerRep,
    categoryIds: src.categories.map((c) => c.id),
    tagIds: src.tags.map((t) => t.id),
    muscles: src.muscles.map((m) => ({ muscleId: m.muscleId, role: m.role })),
    equipment: src.equipment.map((e) => ({ equipmentId: e.equipmentId, optional: e.optional })),
    instructions: src.instructions.map((i) => ({
      kind: i.kind,
      text: i.text,
      audience: i.audience as 'client' | 'trainer' | 'both',
    })),
  };
}

async function setExerciseStatus_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { status } = parse(setStatusSchema, input);
  requirePermission(ctx, status === 'published' ? 'library:publish' : 'library:write', {
    organizationId: ctx.actor.organizationId,
  });
  const before = await loadOwn(ctx, id);
  if (status === 'published') {
    const detail = await getExercise_(ctx, id);
    if (detail.publishProblems.length) {
      throw new DomainError('validation', 'Faltan datos para publicar el ejercicio.', {
        publish: detail.publishProblems,
      });
    }
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(exercises)
      .set({ status, version: before.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(exercises.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'exercise',
      entityId: id,
      changes: [{ field: 'status', before: before.status, after: status }],
    });
  });
}

async function markExerciseReviewed_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { notes } = parse(reviewSchema, input ?? {});
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  const before = await loadOwn(ctx, id);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(exercises)
      .set({
        needsReview: false,
        reviewNotes: notes ?? before.reviewNotes,
        version: before.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(exercises.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'exercise',
      entityId: id,
      changes: [{ field: 'needsReview', before: before.needsReview, after: false }],
      reason: notes ?? null,
    });
  });
}

// ── Media ─────────────────────────────────────────────────────────────────────

async function addExerciseVideo_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<{ mediaId: string }> {
  const data = parse(addVideoSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await loadOwn(ctx, id);
  const parsed = parseVideoUrl(data.url);
  if (!parsed)
    throw new DomainError('validation', 'URL de vídeo no válida (YouTube o Vimeo).', {
      url: ['invalid_video_url'],
    });
  return ctx.db.transaction(async (tx) => {
    const dup = await tx
      .select({ id: exerciseMedia.id })
      .from(exerciseMedia)
      .where(
        and(eq(exerciseMedia.exerciseId, id), eq(exerciseMedia.urlOrKey, parsed.canonicalUrl)),
      );
    if (dup.length) throw new DomainError('conflict', 'Ese vídeo ya está asociado.');
    const hasPrimary =
      (
        await tx
          .select({ id: exerciseMedia.id })
          .from(exerciseMedia)
          .where(
            and(
              eq(exerciseMedia.exerciseId, id),
              eq(exerciseMedia.type, 'video'),
              eq(exerciseMedia.isPrimary, true),
            ),
          )
      ).length > 0;
    const [m] = await tx
      .insert(exerciseMedia)
      .values({
        exerciseId: id,
        type: 'video',
        provider: parsed.provider,
        urlOrKey: parsed.canonicalUrl,
        title: data.title ?? null,
        channel: data.channel ?? null,
        language: data.language ?? null,
        status: 'pending_verification',
        isPrimary: !hasPrimary,
      })
      .returning({ id: exerciseMedia.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'exercise_media',
      entityId: m!.id,
      changes: { exerciseId: id, url: parsed.canonicalUrl, status: 'pending_verification' },
    });
    return { mediaId: m!.id };
  });
}

/** A person confirms they watched the video and it shows the exercise correctly (§28). */
async function verifyExerciseMedia_(
  ctx: RequestContext,
  id: string,
  mediaId: string,
  input: unknown,
): Promise<void> {
  const { status } = parse(verifyMediaSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await loadOwn(ctx, id);
  await ctx.db.transaction(async (tx) => {
    const updated = await tx
      .update(exerciseMedia)
      .set({
        status,
        verifiedAt: status === 'verified' ? ctx.now() : null,
        verifiedBy: status === 'verified' ? ctx.actor.userId : null,
      })
      .where(and(eq(exerciseMedia.id, mediaId), eq(exerciseMedia.exerciseId, id)))
      .returning({ id: exerciseMedia.id });
    if (!updated.length) throw new DomainError('not_found', 'Medio no encontrado.');
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'exercise_media',
      entityId: mediaId,
      changes: [{ field: 'status', before: null, after: status }],
    });
  });
}

async function removeExerciseMedia_(
  ctx: RequestContext,
  id: string,
  mediaId: string,
): Promise<void> {
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await loadOwn(ctx, id);
  await ctx.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(exerciseMedia)
      .where(and(eq(exerciseMedia.id, mediaId), eq(exerciseMedia.exerciseId, id)))
      .returning();
    if (!deleted.length) throw new DomainError('not_found', 'Medio no encontrado.');
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'exercise_media',
      entityId: mediaId,
      changes: [{ field: 'urlOrKey', before: deleted[0]!.urlOrKey, after: null }],
    });
  });
}

/** Silhouette upload (§27): PNG/JPEG/WebP only, ≤ 2 MB, type sniffed from content. */
async function uploadExerciseSilhouette_(
  ctx: RequestContext,
  id: string,
  bytes: Uint8Array,
): Promise<{ mediaId: string; fileId: string }> {
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await loadOwn(ctx, id);
  if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) {
    throw new DomainError('validation', 'La imagen debe ocupar como máximo 2 MB.', {
      file: ['too_large'],
    });
  }
  const kind = sniffImage(bytes);
  if (!kind)
    throw new DomainError('validation', 'Formato no admitido. Usa PNG, JPEG o WebP.', {
      file: ['unsupported_type'],
    });
  const fileId = uuidv7();
  const key = `${ctx.actor.organizationId}/silhouettes/${fileId}.${kind.ext}`;
  await ctx.storage.put(key, bytes, kind.contentType);
  const { createHash } = await import('node:crypto');
  return ctx.db.transaction(async (tx) => {
    await tx.insert(files).values({
      id: fileId,
      organizationId: ctx.actor.organizationId,
      storageKey: key,
      contentType: kind.contentType,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      purpose: 'exercise_silhouette',
      createdBy: ctx.actor.userId,
    });
    await tx
      .update(exerciseMedia)
      .set({ status: 'replaced', isPrimary: false })
      .where(
        and(
          eq(exerciseMedia.exerciseId, id),
          eq(exerciseMedia.type, 'silhouette'),
          ne(exerciseMedia.status, 'replaced'),
        ),
      );
    const [m] = await tx
      .insert(exerciseMedia)
      .values({
        exerciseId: id,
        type: 'silhouette',
        provider: 'upload',
        urlOrKey: fileId,
        status: 'verified',
        verifiedAt: ctx.now(),
        verifiedBy: ctx.actor.userId,
        isPrimary: true,
      })
      .returning({ id: exerciseMedia.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'exercise_media',
      entityId: m!.id,
      changes: { exerciseId: id, type: 'silhouette', fileId },
    });
    return { mediaId: m!.id, fileId };
  });
}

/** Streams a stored file the actor may see (RLS on `files` + staff check). */
async function getFile_(
  ctx: RequestContext,
  fileId: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  requirePermission(ctx, 'library:read');
  const [f] = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.organizationId, ctx.actor.organizationId)));
  if (!f) throw new DomainError('not_found', 'Archivo no encontrado.');
  const bytes = await ctx.storage.get(f.storageKey);
  if (!bytes) throw new DomainError('not_found', 'Archivo no encontrado.');
  return { bytes, contentType: f.contentType };
}

// ── Progressions ──────────────────────────────────────────────────────────────

async function addProgression_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const data = parse(progressionSchema, input);
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await loadVisible(ctx, data.fromExerciseId);
  await loadVisible(ctx, data.toExerciseId);
  return ctx.db.transaction(async (tx) => {
    const edges = await tx
      .select({
        from: exerciseProgressions.fromExerciseId,
        to: exerciseProgressions.toExerciseId,
        relation: exerciseProgressions.relation,
      })
      .from(exerciseProgressions)
      .where(visibleTo(ctx, exerciseProgressions.organizationId));
    const cycle = findProgressionCycle(edges, {
      from: data.fromExerciseId,
      to: data.toExerciseId,
      relation: data.relation,
    });
    if (cycle) {
      throw new DomainError(
        'validation',
        'Esta relación contradice otras progresiones existentes (ciclo).',
        { relation: ['cycle'], cycle },
      );
    }
    const [row] = await tx
      .insert(exerciseProgressions)
      .values({
        organizationId: ctx.actor.organizationId,
        fromExerciseId: data.fromExerciseId,
        toExerciseId: data.toExerciseId,
        relation: data.relation,
        axes: data.axes,
        notes: data.notes ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: exerciseProgressions.id });
    if (!row) throw new DomainError('conflict', 'Esa relación ya existe.');
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'exercise_progression',
      entityId: row.id,
      changes: data,
    });
    return { id: row.id };
  });
}

async function removeProgression_(ctx: RequestContext, progressionId: string): Promise<void> {
  requirePermission(ctx, 'library:write', { organizationId: ctx.actor.organizationId });
  await ctx.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(exerciseProgressions)
      .where(
        and(
          eq(exerciseProgressions.id, progressionId),
          eq(exerciseProgressions.organizationId, ctx.actor.organizationId),
        ),
      )
      .returning();
    if (!deleted.length) throw new DomainError('not_found', 'Relación no encontrada.');
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'exercise_progression',
      entityId: progressionId,
      changes: { from: deleted[0]!.fromExerciseId, to: deleted[0]!.toExerciseId },
    });
  });
}

// ── Substitution (§29) ────────────────────────────────────────────────────────

async function loadFacts(ctx: RequestContext, ids: string[] | null): Promise<ExerciseFacts[]> {
  const base = and(
    visibleTo(ctx, exercises.organizationId),
    ne(exercises.status, 'archived'),
    ids ? inArray(exercises.id, ids) : undefined,
  );
  const rows = await ctx.db.select().from(exercises).where(base);
  if (!rows.length) return [];
  const rid = rows.map((r) => r.id);
  const [cats, mus, eqs, meths] = await Promise.all([
    ctx.db
      .select({ id: exerciseCategoryLinks.exerciseId, c: exerciseCategoryLinks.categoryId })
      .from(exerciseCategoryLinks)
      .where(inArray(exerciseCategoryLinks.exerciseId, rid)),
    ctx.db
      .select({ id: exerciseMuscles.exerciseId, g: muscles.groupSlug, role: exerciseMuscles.role })
      .from(exerciseMuscles)
      .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
      .where(inArray(exerciseMuscles.exerciseId, rid)),
    ctx.db
      .select({
        id: exerciseEquipment.exerciseId,
        e: exerciseEquipment.equipmentId,
        optional: exerciseEquipment.optional,
      })
      .from(exerciseEquipment)
      .where(inArray(exerciseEquipment.exerciseId, rid)),
    ctx.db
      .select({ id: exerciseMethodLinks.exerciseId, m: exerciseMethodLinks.methodId })
      .from(exerciseMethodLinks)
      .where(inArray(exerciseMethodLinks.exerciseId, rid)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    movementPatternId: r.movementPatternId,
    categoryIds: cats.filter((c) => c.id === r.id).map((c) => c.c),
    methodIds: meths.filter((m) => m.id === r.id).map((m) => m.m),
    primaryMuscleGroups: [
      ...new Set(mus.filter((m) => m.id === r.id && m.role === 'primary').map((m) => m.g)),
    ],
    secondaryMuscleGroups: [
      ...new Set(mus.filter((m) => m.id === r.id && m.role !== 'primary').map((m) => m.g)),
    ],
    equipmentIds: eqs.filter((e) => e.id === r.id && !e.optional).map((e) => e.e),
    level: r.level,
    technicalComplexity: r.technicalComplexity,
    axialLoad: r.axialLoad,
    impactLevel: r.impactLevel,
    spaceRequired: r.spaceRequired,
    laterality: r.laterality,
  }));
}

const EXPERIENCE_TO_LEVEL: Record<string, Level | null> = {
  none: 'beginner',
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

async function suggestExerciseSubstitutes_(
  ctx: RequestContext,
  exerciseId: string,
  query: unknown,
) {
  const q = parse(substitutesQuerySchema, query ?? {});
  requirePermission(ctx, 'library:read');
  const [original] = await loadFacts(ctx, [exerciseId]);
  if (!original) throw new DomainError('not_found', 'Ejercicio no encontrado.');
  let available: string[] | null = null;
  let notTolerated: string[] = [];
  let restricted: string[] = [];
  let clientLevel: Level | null = null;
  if (q.clientId) {
    await authorizeClient(ctx, 'clients:read', q.clientId);
    const eqRows = await ctx.db
      .select()
      .from(clientEquipment)
      .where(eq(clientEquipment.clientId, q.clientId));
    if (eqRows.length) {
      available = eqRows
        .filter((e) => !q.location || e.location === q.location || e.location === 'both')
        .map((e) => e.equipmentId);
    }
    const tol = await ctx.db
      .select()
      .from(exerciseTolerances)
      .where(eq(exerciseTolerances.clientId, q.clientId));
    notTolerated = tol
      .filter((t) => t.kind === 'not_tolerated' && t.exerciseId)
      .map((t) => t.exerciseId!);
    restricted = tol
      .filter((t) => t.kind !== 'tolerated' && t.movementPatternId)
      .map((t) => t.movementPatternId!);
    const [p] = await ctx.db
      .select({ e: clientTrainingProfiles.experienceLevel })
      .from(clientTrainingProfiles)
      .where(eq(clientTrainingProfiles.clientId, q.clientId));
    clientLevel = p ? (EXPERIENCE_TO_LEVEL[p.e] ?? null) : null;
  }
  const edges = await ctx.db
    .select({
      from: exerciseProgressions.fromExerciseId,
      to: exerciseProgressions.toExerciseId,
      relation: exerciseProgressions.relation,
    })
    .from(exerciseProgressions)
    .where(
      and(
        visibleTo(ctx, exerciseProgressions.organizationId),
        or(
          eq(exerciseProgressions.fromExerciseId, exerciseId),
          eq(exerciseProgressions.toExerciseId, exerciseId),
        ),
      ),
    );
  const easier: string[] = [];
  const harder: string[] = [];
  const variants: string[] = [];
  for (const e of edges) {
    const other = e.from === exerciseId ? e.to : e.from;
    if (e.relation === 'variant') variants.push(other);
    else if ((e.relation === 'progression') === (e.from === exerciseId)) harder.push(other);
    else easier.push(other);
  }
  const candidates = await loadFacts(ctx, null);
  const result = suggestSubstitutes(
    original,
    candidates,
    {
      reason: q.reason,
      availableEquipmentIds: available,
      notToleratedExerciseIds: notTolerated,
      restrictedPatternIds: restricted,
      regressionIds: easier,
      progressionIds: harder,
      variantIds: variants,
      recentlyUsedIds: [],
      clientLevel,
    },
    { limit: q.limit, groupLabel: (g) => MUSCLE_GROUP_NAMES[g] ?? g },
  );
  return {
    ...result,
    excludedCount: result.excluded.length,
    usedClientContext: !!q.clientId,
    note: 'Sugerencias orientativas: el entrenador decide.',
  };
}

// ── Client tolerances [SALUD] ────────────────────────────────────────────────

async function listExerciseTolerances_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'health:read', clientId);
  return ctx.db
    .select({
      id: exerciseTolerances.id,
      kind: exerciseTolerances.kind,
      reason: exerciseTolerances.reason,
      exerciseId: exerciseTolerances.exerciseId,
      exerciseName: exercises.name,
      movementPatternId: exerciseTolerances.movementPatternId,
      patternName: movementPatterns.name,
    })
    .from(exerciseTolerances)
    .leftJoin(exercises, eq(exercises.id, exerciseTolerances.exerciseId))
    .leftJoin(movementPatterns, eq(movementPatterns.id, exerciseTolerances.movementPatternId))
    .where(eq(exerciseTolerances.clientId, clientId));
}

async function setExerciseTolerance_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const data = parse(toleranceSchema, input);
  const resource = await authorizeClient(ctx, 'health:write', clientId);
  if (requirePermission(ctx, 'health:write', resource) === 'own')
    throw new DomainError('forbidden', 'Solo tu entrenador puede registrar esta información.');
  if (data.exerciseId) await loadVisible(ctx, data.exerciseId);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(exerciseTolerances)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        exerciseId: data.exerciseId ?? null,
        movementPatternId: data.movementPatternId ?? null,
        kind: data.kind,
        reason: data.reason ?? null,
      })
      .returning({ id: exerciseTolerances.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'exercise_tolerance',
      entityId: row!.id,
      clientId,
      changes: {
        kind: data.kind,
        exerciseId: data.exerciseId ?? null,
        movementPatternId: data.movementPatternId ?? null,
      },
    });
    return { id: row!.id };
  });
}

async function removeExerciseTolerance_(
  ctx: RequestContext,
  clientId: string,
  toleranceId: string,
): Promise<void> {
  const resource = await authorizeClient(ctx, 'health:write', clientId);
  if (requirePermission(ctx, 'health:write', resource) === 'own')
    throw new DomainError('forbidden', 'Solo tu entrenador puede modificar esta información.');
  await ctx.db.transaction(async (tx) => {
    const del = await tx
      .delete(exerciseTolerances)
      .where(and(eq(exerciseTolerances.id, toleranceId), eq(exerciseTolerances.clientId, clientId)))
      .returning();
    if (!del.length) throw new DomainError('not_found', 'Registro no encontrado.');
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'exercise_tolerance',
      entityId: toleranceId,
      clientId,
    });
  });
}

// Use cases run under Row Level Security (see rls.ts).
export const listLibraryTaxonomies = secured(listLibraryTaxonomies_);
export const listExercises = secured(listExercises_);
export const getExercise = secured(getExercise_);
export const setExerciseLoadIncrement = secured(setExerciseLoadIncrement_);
export const createExercise = secured(createExercise_);
export const updateExercise = secured(updateExercise_);
export const forkExercise = secured(forkExercise_);
export const duplicateExercise = secured(duplicateExercise_);
export const setExerciseStatus = secured(setExerciseStatus_);
export const markExerciseReviewed = secured(markExerciseReviewed_);
export const addExerciseVideo = secured(addExerciseVideo_);
export const verifyExerciseMedia = secured(verifyExerciseMedia_);
export const removeExerciseMedia = secured(removeExerciseMedia_);
export const uploadExerciseSilhouette = secured(uploadExerciseSilhouette_);
export const getFile = secured(getFile_);
export const addProgression = secured(addProgression_);
export const removeProgression = secured(removeProgression_);
export const suggestExerciseSubstitutes = secured(suggestExerciseSubstitutes_);
export const listExerciseTolerances = secured(listExerciseTolerances_);
export const setExerciseTolerance = secured(setExerciseTolerance_);
export const removeExerciseTolerance = secured(removeExerciseTolerance_);
