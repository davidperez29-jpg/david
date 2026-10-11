/**
 * Review of the exercise bank (restructure phase 19): the centre's own exercises with what each
 * still lacks, a «next pending» for reviewing one by one, changes applied to many at once and the
 * queue of videos waiting for a person to watch them. Nothing is decided automatically: every
 * change is made by a person, versioned and audited (A67, A68).
 */
import {
  bulkExerciseEditSchema,
  exerciseReviewQuerySchema,
  nextReviewQuerySchema,
  pendingVideosQuerySchema,
  type Page,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  bulkSkipReason,
  DomainError,
  MUSCLE_REQUIRED_FAMILIES,
  parseVideoUrl,
  publishProblems,
  reviewGaps,
  type BulkEdit,
  type BulkSkip,
  type ReviewFacts,
  type ReviewGap,
} from '@tp/domain';
import { and, asc, count, eq, gt, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const {
  exercises,
  exerciseCategoryLinks,
  exerciseCategories,
  exerciseMuscles,
  exerciseMedia,
  movementPatterns,
  muscles,
  prescriptionProfiles,
} = schema;

const visibleTo = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));

/** Audit reason of every change made from the queue. */
const BULK_REASON = 'Revisión del banco (en bloque)';

// ── Gaps in SQL (the same rules as `reviewGaps`; a test keeps them in step) ──────────────────

const families = sql.join(
  MUSCLE_REQUIRED_FAMILIES.map((f) => sql`${f}`),
  sql`, `,
);
const hasVideo = (status: string) =>
  sql`EXISTS (SELECT 1 FROM exercise_media m WHERE m.exercise_id = ${exercises.id} AND m.type = 'video' AND m.status = ${status})`;

const GAP_SQL: Record<ReviewGap, SQL> = {
  pending_review: sql`${exercises.needsReview}`,
  missing_pattern: sql`${exercises.movementPatternId} IS NULL`,
  missing_category: sql`NOT EXISTS (SELECT 1 FROM exercise_category_links l WHERE l.exercise_id = ${exercises.id})`,
  missing_primary_muscle: sql`(${movementPatterns.family} IN (${families}) AND NOT EXISTS (SELECT 1 FROM exercise_muscles em WHERE em.exercise_id = ${exercises.id} AND em.role = 'primary'))`,
  missing_level: sql`${exercises.level} IS NULL`,
  missing_client_description: sql`coalesce(btrim(${exercises.clientDescription}), '') = ''`,
  missing_prescription_profile: sql`${exercises.prescriptionProfileId} IS NULL`,
  pending_video: hasVideo('pending_verification'),
  broken_video: hasVideo('broken'),
};
const PUBLISH_GAPS: ReviewGap[] = [
  'pending_review',
  'missing_pattern',
  'missing_category',
  'missing_primary_muscle',
  'missing_level',
  'missing_client_description',
  'missing_prescription_profile',
];
/** A complete draft: nothing stops it from being published. */
const READY_SQL = sql`(${exercises.status} = 'draft' AND NOT (${sql.join(
  PUBLISH_GAPS.map((g) => sql`(${GAP_SQL[g]})`),
  sql` OR `,
)}))`;

/** The queue: the centre's own exercises, not archived (global ones are curated by the platform). */
function queueWhere(ctx: RequestContext, q: z.infer<typeof exerciseReviewQuerySchema> | object) {
  const f = q as Partial<z.infer<typeof exerciseReviewQuerySchema>>;
  const conds: (SQL | undefined)[] = [
    eq(exercises.organizationId, ctx.actor.organizationId),
    ne(exercises.status, 'archived'),
  ];
  if (f.status) conds.push(eq(exercises.status, f.status));
  if (f.gap) conds.push(f.gap === 'ready' ? READY_SQL : GAP_SQL[f.gap]);
  if (f.patternId) conds.push(eq(exercises.movementPatternId, f.patternId));
  if (f.categoryId)
    conds.push(
      sql`EXISTS (SELECT 1 FROM exercise_category_links l WHERE l.exercise_id = ${exercises.id} AND l.category_id = ${f.categoryId})`,
    );
  if (f.q) {
    const like = `%${f.q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      sql`lower(immutable_unaccent(${exercises.name})) LIKE lower(immutable_unaccent(${like}))`,
    );
  }
  return and(...conds);
}

/** Counts, categories, muscles and videos of some exercises, to compute their gaps. */
async function factsOf(db: Executor, ids: string[]): Promise<Map<string, ReviewFacts>> {
  if (!ids.length) return new Map();
  const [rows, cats, prim, vids] = await Promise.all([
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        movementPatternId: exercises.movementPatternId,
        patternFamily: movementPatterns.family,
        level: exercises.level,
        clientDescription: exercises.clientDescription,
        prescriptionProfileId: exercises.prescriptionProfileId,
        needsReview: exercises.needsReview,
      })
      .from(exercises)
      .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
      .where(inArray(exercises.id, ids)),
    db
      .select({ id: exerciseCategoryLinks.exerciseId, n: count() })
      .from(exerciseCategoryLinks)
      .where(inArray(exerciseCategoryLinks.exerciseId, ids))
      .groupBy(exerciseCategoryLinks.exerciseId),
    db
      .select({ id: exerciseMuscles.exerciseId, n: count() })
      .from(exerciseMuscles)
      .where(and(inArray(exerciseMuscles.exerciseId, ids), eq(exerciseMuscles.role, 'primary')))
      .groupBy(exerciseMuscles.exerciseId),
    db
      .select({ id: exerciseMedia.exerciseId, status: exerciseMedia.status, n: count() })
      .from(exerciseMedia)
      .where(and(inArray(exerciseMedia.exerciseId, ids), eq(exerciseMedia.type, 'video')))
      .groupBy(exerciseMedia.exerciseId, exerciseMedia.status),
  ]);
  const n = (list: { id: string; n: number }[], id: string) =>
    Number(list.find((x) => x.id === id)?.n ?? 0);
  return new Map(
    rows.map((r) => [
      r.id,
      {
        ...r,
        categoryCount: n(cats, r.id),
        primaryMuscleCount: n(prim, r.id),
        pendingVideos: Number(
          vids.find((v) => v.id === r.id && v.status === 'pending_verification')?.n ?? 0,
        ),
        brokenVideos: Number(vids.find((v) => v.id === r.id && v.status === 'broken')?.n ?? 0),
      },
    ]),
  );
}

// ── Overview and queue ────────────────────────────────────────────────────────

async function exerciseReviewOverview_(ctx: RequestContext) {
  requirePermission(ctx, 'library:read');
  const gapCounts = Object.fromEntries(
    (Object.keys(GAP_SQL) as ReviewGap[]).map((g) => [
      g,
      sql<number>`count(*) FILTER (WHERE ${GAP_SQL[g]})::int`,
    ]),
  ) as Record<ReviewGap, SQL<number>>;
  const [row] = await ctx.db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) FILTER (WHERE ${exercises.status} = 'published')::int`,
      ready: sql<number>`count(*) FILTER (WHERE ${READY_SQL})::int`,
      ...gapCounts,
    })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(queueWhere(ctx, {}));
  const videos = await ctx.db
    .select({ status: exerciseMedia.status, n: sql<number>`count(*)::int` })
    .from(exerciseMedia)
    .innerJoin(exercises, eq(exercises.id, exerciseMedia.exerciseId))
    .where(and(eq(exerciseMedia.type, 'video'), queueWhere(ctx, {})))
    .groupBy(exerciseMedia.status);
  const v = (s: string) => videos.find((x) => x.status === s)?.n ?? 0;
  const r = row!;
  return {
    total: r.total,
    published: r.published,
    /** Complete drafts: nothing stops them from being published. */
    ready: r.ready,
    gaps: Object.fromEntries(
      (Object.keys(GAP_SQL) as ReviewGap[]).map((g) => [g, Number(r[g])]),
    ) as Record<ReviewGap, number>,
    videos: {
      pending: v('pending_verification'),
      verified: v('verified'),
      broken: v('broken'),
    },
  };
}
export type ExerciseReviewOverview = Awaited<ReturnType<typeof exerciseReviewOverview_>>;

export interface ExerciseReviewItem {
  id: string;
  name: string;
  version: number;
  status: string;
  pattern: string | null;
  level: string | null;
  categories: string[];
  gaps: ReviewGap[];
  reviewNotes: string | null;
  source: string;
}

async function listExerciseReview_(
  ctx: RequestContext,
  query: unknown,
): Promise<Page<ExerciseReviewItem>> {
  const q = parse(exerciseReviewQuerySchema, query ?? {});
  requirePermission(ctx, 'library:read');
  const where = queueWhere(ctx, q);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(where);
  const rows = await ctx.db
    .select({
      id: exercises.id,
      name: exercises.name,
      version: exercises.version,
      status: exercises.status,
      pattern: movementPatterns.name,
      level: exercises.level,
      reviewNotes: exercises.reviewNotes,
      source: exercises.source,
    })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(where)
    .orderBy(asc(exercises.name), asc(exercises.id))
    .limit(q.limit)
    .offset(q.offset);
  const ids = rows.map((r) => r.id);
  const [facts, cats] = await Promise.all([
    factsOf(ctx.db, ids),
    ids.length
      ? ctx.db
          .select({ id: exerciseCategoryLinks.exerciseId, name: exerciseCategories.name })
          .from(exerciseCategoryLinks)
          .innerJoin(
            exerciseCategories,
            eq(exerciseCategories.id, exerciseCategoryLinks.categoryId),
          )
          .where(inArray(exerciseCategoryLinks.exerciseId, ids))
      : [],
  ]);
  return {
    items: rows.map((r) => ({
      ...r,
      categories: cats.filter((c) => c.id === r.id).map((c) => c.name),
      gaps: reviewGaps(facts.get(r.id)!),
      reviewNotes: r.reviewNotes ? r.reviewNotes.slice(0, 300) : null,
    })),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}

/**
 * The exercise that follows `after` (by name) in the same queue, with its position: reviewing
 * one by one from the exercise page. Null at the end of the queue.
 */
async function nextExerciseToReview_(ctx: RequestContext, query: unknown) {
  const q = parse(nextReviewQuerySchema, query ?? {});
  requirePermission(ctx, 'library:read');
  const [current] = await ctx.db
    .select({ name: exercises.name })
    .from(exercises)
    .where(and(eq(exercises.id, q.after), visibleTo(ctx, exercises.organizationId)));
  if (!current) throw new DomainError('not_found', 'Ejercicio no encontrado.');
  const where = queueWhere(ctx, q);
  const after = or(
    gt(exercises.name, current.name),
    and(eq(exercises.name, current.name), gt(exercises.id, q.after)),
  );
  const [next] = await ctx.db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(and(where, after))
    .orderBy(asc(exercises.name), asc(exercises.id))
    .limit(1);
  const [{ left } = { left: 0 }] = await ctx.db
    .select({ left: count() })
    .from(exercises)
    .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
    .where(and(where, after));
  return { next: next ?? null, remaining: Number(left) };
}

// ── Changes to many exercises at once ─────────────────────────────────────────

const SKIP_TEXT: Record<BulkSkip | 'not_found', string> = {
  global: 'Es un ejercicio global: duplícalo para editarlo.',
  archived: 'Está archivado.',
  changed: 'Alguien lo ha cambiado mientras tanto: recarga la lista.',
  not_ready: 'Le faltan datos para publicarse.',
  not_found: 'No existe o no es de tu centro.',
};

/** The taxonomy value of the change must exist and be visible (platform's or the centre's). */
async function assertReference(ctx: RequestContext, edit: BulkEdit) {
  const check = async (
    table:
      | typeof movementPatterns
      | typeof prescriptionProfiles
      | typeof exerciseCategories
      | typeof muscles,
    id: string,
    field: string,
  ) => {
    const [row] = await ctx.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), visibleTo(ctx, table.organizationId)));
    if (!row)
      throw new DomainError('validation', 'Referencia desconocida.', { [field]: ['unknown'] });
  };
  if (edit.kind === 'set_pattern') await check(movementPatterns, edit.patternId, 'patternId');
  if (edit.kind === 'set_profile') await check(prescriptionProfiles, edit.profileId, 'profileId');
  if (edit.kind === 'add_category') await check(exerciseCategories, edit.categoryId, 'categoryId');
  if (edit.kind === 'add_primary_muscle') await check(muscles, edit.muscleId, 'muscleId');
}

async function bulkEditExercises_(ctx: RequestContext, input: unknown) {
  const d = parse(bulkExerciseEditSchema, input);
  const edit = d.edit as BulkEdit;
  requirePermission(ctx, edit.kind === 'publish' ? 'library:publish' : 'library:write', {
    organizationId: ctx.actor.organizationId,
  });
  await assertReference(ctx, edit);
  const ids = [...new Set(d.ids)];
  return ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: exercises.id,
        name: exercises.name,
        organizationId: exercises.organizationId,
        status: exercises.status,
        version: exercises.version,
        movementPatternId: exercises.movementPatternId,
        level: exercises.level,
        prescriptionProfileId: exercises.prescriptionProfileId,
        needsReview: exercises.needsReview,
      })
      .from(exercises)
      .where(and(inArray(exercises.id, ids), visibleTo(ctx, exercises.organizationId)));
    const facts =
      edit.kind === 'publish'
        ? await factsOf(
            tx,
            rows.map((r) => r.id),
          )
        : null;
    const byId = new Map(rows.map((r) => [r.id, r]));
    let applied = 0;
    let unchanged = 0;
    const skipped: { id: string; name: string | null; reason: string }[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) {
        skipped.push({ id, name: null, reason: SKIP_TEXT.not_found });
        continue;
      }
      const skip = bulkSkipReason(
        {
          isGlobal: row.organizationId === null,
          status: row.status,
          version: row.version,
          expectedVersion: d.expectedVersions?.[id],
          publishProblems: facts ? publishProblems(facts.get(id)!) : [],
        },
        edit,
      );
      if (skip) {
        skipped.push({ id, name: row.name, reason: SKIP_TEXT[skip] });
        continue;
      }
      const change = await applyEdit(tx, row, edit);
      if (!change) {
        unchanged++;
        continue;
      }
      const updated = await tx
        .update(exercises)
        .set({ ...change.set, version: row.version + 1, updatedBy: ctx.actor.userId })
        .where(and(eq(exercises.id, id), eq(exercises.version, row.version)))
        .returning({ id: exercises.id });
      if (!updated.length) {
        skipped.push({ id, name: row.name, reason: SKIP_TEXT.changed });
        continue;
      }
      await writeAudit(tx, ctx, {
        action: 'update',
        entityType: 'exercise',
        entityId: id,
        changes: [change.audit],
        reason: BULK_REASON,
      });
      applied++;
    }
    return { applied, unchanged, skipped };
  });
}

type Row = {
  id: string;
  status: string;
  movementPatternId: string | null;
  level: string | null;
  prescriptionProfileId: string | null;
  needsReview: boolean;
};

/** Writes one change (relations here, columns returned in `set`); null when already so. */
async function applyEdit(
  tx: Executor,
  row: Row,
  edit: BulkEdit,
): Promise<{
  set: Partial<typeof exercises.$inferInsert>;
  audit: { field: string; before: unknown; after: unknown };
} | null> {
  switch (edit.kind) {
    case 'set_pattern':
      return row.movementPatternId === edit.patternId
        ? null
        : {
            set: { movementPatternId: edit.patternId },
            audit: {
              field: 'movementPatternId',
              before: row.movementPatternId,
              after: edit.patternId,
            },
          };
    case 'set_level':
      return row.level === edit.level
        ? null
        : {
            set: { level: edit.level },
            audit: { field: 'level', before: row.level, after: edit.level },
          };
    case 'set_profile':
      return row.prescriptionProfileId === edit.profileId
        ? null
        : {
            set: { prescriptionProfileId: edit.profileId },
            audit: {
              field: 'prescriptionProfileId',
              before: row.prescriptionProfileId,
              after: edit.profileId,
            },
          };
    case 'mark_reviewed':
      return row.needsReview
        ? {
            set: { needsReview: false },
            audit: { field: 'needsReview', before: true, after: false },
          }
        : null;
    case 'publish':
      return row.status === 'published'
        ? null
        : {
            set: { status: 'published' },
            audit: { field: 'status', before: row.status, after: 'published' },
          };
    case 'archive':
      return {
        set: { status: 'archived' },
        audit: { field: 'status', before: row.status, after: 'archived' },
      };
    case 'add_category': {
      const links = await tx
        .select({ categoryId: exerciseCategoryLinks.categoryId })
        .from(exerciseCategoryLinks)
        .where(eq(exerciseCategoryLinks.exerciseId, row.id));
      if (links.some((l) => l.categoryId === edit.categoryId)) return null;
      // The first category of an exercise is its main one.
      await tx.insert(exerciseCategoryLinks).values({
        exerciseId: row.id,
        categoryId: edit.categoryId,
        isPrimary: links.length === 0,
      });
      return { set: {}, audit: { field: 'categoryIds', before: null, after: edit.categoryId } };
    }
    case 'add_primary_muscle': {
      const [m] = await tx
        .select({ role: exerciseMuscles.role })
        .from(exerciseMuscles)
        .where(
          and(eq(exerciseMuscles.exerciseId, row.id), eq(exerciseMuscles.muscleId, edit.muscleId)),
        );
      if (m?.role === 'primary') return null;
      if (m)
        await tx
          .update(exerciseMuscles)
          .set({ role: 'primary' })
          .where(
            and(
              eq(exerciseMuscles.exerciseId, row.id),
              eq(exerciseMuscles.muscleId, edit.muscleId),
            ),
          );
      else
        await tx
          .insert(exerciseMuscles)
          .values({ exerciseId: row.id, muscleId: edit.muscleId, role: 'primary' });
      return {
        set: {},
        audit: { field: `muscles.${edit.muscleId}`, before: m?.role ?? null, after: 'primary' },
      };
    }
  }
}

// ── Videos waiting for a person ───────────────────────────────────────────────

/** Videos of the centre's exercises that nobody has watched yet, one exercise after another. */
async function listPendingVideos_(ctx: RequestContext, query: unknown) {
  const q = parse(pendingVideosQuerySchema, query ?? {});
  requirePermission(ctx, 'library:read');
  const where = and(
    eq(exerciseMedia.type, 'video'),
    eq(exerciseMedia.status, 'pending_verification'),
    eq(exercises.organizationId, ctx.actor.organizationId),
    ne(exercises.status, 'archived'),
  );
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(exerciseMedia)
    .innerJoin(exercises, eq(exercises.id, exerciseMedia.exerciseId))
    .where(where);
  const rows = await ctx.db
    .select({
      mediaId: exerciseMedia.id,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      url: exerciseMedia.urlOrKey,
      title: exerciseMedia.title,
      channel: exerciseMedia.channel,
    })
    .from(exerciseMedia)
    .innerJoin(exercises, eq(exercises.id, exerciseMedia.exerciseId))
    .where(where)
    .orderBy(asc(exercises.name), asc(exerciseMedia.id))
    .limit(q.limit)
    .offset(q.offset);
  return {
    items: rows.map((r) => ({ ...r, embedUrl: parseVideoUrl(r.url)?.embedUrl ?? null })),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}
export type PendingVideo = Awaited<ReturnType<typeof listPendingVideos_>>['items'][number];

export const exerciseReviewOverview = secured(exerciseReviewOverview_);
export const listExerciseReview = secured(listExerciseReview_);
export const nextExerciseToReview = secured(nextExerciseToReview_);
export const bulkEditExercises = secured(bulkEditExercises_);
export const listPendingVideos = secured(listPendingVideos_);
