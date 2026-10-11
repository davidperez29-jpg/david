import { schema } from '@tp/db';
import { and, eq, isNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addExerciseVideo,
  bulkEditExercises,
  createExercise,
  exerciseReviewOverview,
  getExercise,
  listExerciseReview,
  listLibraryTaxonomies,
  listPendingVideos,
  nextExerciseToReview,
  verifyExerciseMedia,
  type LibraryTaxonomies,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tax: LibraryTaxonomies;
const pat = (slug: string) => tax.patterns.find((p) => p.slug === slug)!.id;
const mus = (slug: string) => tax.muscles.find((m) => m.slug === slug)!.id;
const cat = (slug: string) => tax.categories.find((c) => c.slug === slug)!.id;
const prof = (slug: string) => tax.profiles.find((p) => p.slug === slug)!.id;
const db = () => testDb().db;

/** An imported-like draft: only a name, flagged for review. */
async function imported(name: string, extra: Record<string, unknown> = {}) {
  const { id } = await createExercise(o.admin, { name, ...extra });
  await db()
    .update(schema.exercises)
    .set({ needsReview: true, source: 'excel' })
    .where(eq(schema.exercises.id, id));
  return id;
}
const versionOf = async (id: string) =>
  (
    await db()
      .select({ v: schema.exercises.version })
      .from(schema.exercises)
      .where(eq(schema.exercises.id, id))
  )[0]!.v;

let a: string;
let b: string;
let c: string;

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tax = await listLibraryTaxonomies(o.admin);
  a = await imported('Banco A sentadilla');
  b = await imported('Banco B zancada', { movementPatternId: pat('knee_dominant') });
  c = await imported('Banco C plancha', {
    movementPatternId: pat('knee_dominant'),
    level: 'beginner',
    clientDescription: 'Mantén la posición.',
    prescriptionProfileId: prof('loaded_dynamic'),
    categoryIds: [cat('strength')],
    muscles: [{ muscleId: mus('quadriceps'), role: 'primary' }],
  });
  await addExerciseVideo(o.admin, a, { url: 'https://youtu.be/vzIA5Wd9wTU' });
});

describe('bank review queue (restructure phase 19)', () => {
  it('counts what the centre’s exercises lack; the list and the domain agree on each gap', async () => {
    const ov = await exerciseReviewOverview(o.admin);
    expect(ov.total).toBe(3);
    expect(ov.gaps.pending_review).toBe(3);
    expect(ov.gaps.missing_pattern).toBe(1);
    expect(ov.gaps.missing_level).toBe(2);
    // B has a strength pattern and no muscles; A has no pattern yet (not asked for muscles).
    expect(ov.gaps.missing_primary_muscle).toBe(1);
    expect(ov.videos).toEqual({ pending: 1, verified: 0, broken: 0 });
    expect(ov.ready).toBe(0);

    for (const gap of ['missing_level', 'missing_primary_muscle', 'pending_video'] as const) {
      const page = await listExerciseReview(o.admin, { gap });
      expect(page.total).toBe(ov.gaps[gap]);
      expect(page.items.every((i) => i.gaps.includes(gap))).toBe(true);
    }
    const all = await listExerciseReview(o.admin, {});
    expect(all.items.map((i) => i.name)).toEqual([
      'Banco A sentadilla',
      'Banco B zancada',
      'Banco C plancha',
    ]);
    expect(all.items.find((i) => i.id === c)!.gaps).toEqual(['pending_review']);
    // Another centre sees none of them.
    expect((await exerciseReviewOverview(other.admin)).total).toBe(0);
    expect((await listExerciseReview(other.admin, {})).total).toBe(0);
  });

  it('applies one change to many: versioned, audited, skipping what changed meanwhile', async () => {
    const [va, vb] = [await versionOf(a), await versionOf(b)];
    // Someone edits B after the list was loaded: B is skipped, not overwritten.
    await db()
      .update(schema.exercises)
      .set({ version: vb + 1 })
      .where(eq(schema.exercises.id, b));
    const r = await bulkEditExercises(o.admin, {
      ids: [a, b],
      expectedVersions: { [a]: va, [b]: vb },
      edit: { kind: 'set_level', level: 'beginner' },
    });
    expect(r.applied).toBe(1);
    expect(r.skipped).toEqual([
      { id: b, name: 'Banco B zancada', reason: expect.stringMatching(/cambiado/) },
    ]);
    const ea = await getExercise(o.admin, a);
    expect(ea).toMatchObject({ level: 'beginner', version: va + 1 });
    const [audit] = await db()
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, a), eq(schema.auditLogs.entityType, 'exercise')))
      .orderBy(schema.auditLogs.occurredAt);
    expect(audit).toBeDefined();
    const logs = await db().select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, a));
    expect(
      logs.some(
        (l) =>
          l.reason === 'Revisión del banco (en bloque)' &&
          JSON.stringify(l.changes).includes('"level"'),
      ),
    ).toBe(true);
    // The same change again is «unchanged», not a new version.
    const again = await bulkEditExercises(o.admin, {
      ids: [a],
      edit: { kind: 'set_level', level: 'beginner' },
    });
    expect(again).toMatchObject({ applied: 0, unchanged: 1, skipped: [] });
    expect(await versionOf(a)).toBe(va + 1);
  });

  it('relations: a pattern, a first (main) category and a primary muscle', async () => {
    await bulkEditExercises(o.admin, {
      ids: [a],
      edit: { kind: 'set_pattern', patternId: pat('knee_dominant') },
    });
    await bulkEditExercises(o.admin, {
      ids: [a, b],
      edit: { kind: 'add_category', categoryId: cat('strength') },
    });
    const r = await bulkEditExercises(o.admin, {
      ids: [a, b, c],
      edit: { kind: 'add_primary_muscle', muscleId: mus('quadriceps') },
    });
    expect(r).toMatchObject({ applied: 2, unchanged: 1 });
    const ea = await getExercise(o.admin, a);
    expect(ea.categories).toEqual([
      expect.objectContaining({ id: cat('strength'), isPrimary: true }),
    ]);
    expect(ea.muscles).toEqual([
      expect.objectContaining({ muscleId: mus('quadriceps'), role: 'primary' }),
    ]);
    expect(ea.publishProblems).not.toContain('missing_primary_muscle');
  });

  it('publishes only complete exercises; mark as reviewed; archive leaves the queue', async () => {
    let r = await bulkEditExercises(o.admin, { ids: [a, c], edit: { kind: 'publish' } });
    expect(r.applied).toBe(0);
    expect(r.skipped.map((s) => s.reason)).toEqual([
      expect.stringMatching(/faltan datos/i),
      expect.stringMatching(/faltan datos/i),
    ]);
    r = await bulkEditExercises(o.admin, { ids: [c], edit: { kind: 'mark_reviewed' } });
    expect(r.applied).toBe(1);
    expect((await exerciseReviewOverview(o.admin)).ready).toBe(1);
    expect((await listExerciseReview(o.admin, { gap: 'ready' })).items.map((i) => i.id)).toEqual([
      c,
    ]);
    r = await bulkEditExercises(o.admin, { ids: [a, c], edit: { kind: 'publish' } });
    expect(r.applied).toBe(1);
    expect((await getExercise(o.admin, c)).status).toBe('published');
    await bulkEditExercises(o.admin, { ids: [b], edit: { kind: 'archive' } });
    const ov = await exerciseReviewOverview(o.admin);
    expect(ov).toMatchObject({ total: 2, published: 1 });
    // An archived exercise is skipped by later changes.
    r = await bulkEditExercises(o.admin, { ids: [b], edit: { kind: 'mark_reviewed' } });
    expect(r.skipped[0]!.reason).toMatch(/archivado/);
  });

  it('isolation and permissions: other centres, global exercises, clients, unknown values', async () => {
    const [g] = await db()
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(isNull(schema.exercises.organizationId))
      .limit(1);
    // Global exercises are the platform's: read-only for every centre.
    const own = await bulkEditExercises(o.admin, { ids: [g!.id], edit: { kind: 'mark_reviewed' } });
    expect(own.skipped[0]!.reason).toMatch(/global/);
    const globalId = g!.id;
    const r = await bulkEditExercises(other.admin, {
      ids: [a, globalId],
      edit: { kind: 'set_level', level: 'advanced' },
    });
    expect(r.applied).toBe(0);
    expect(r.skipped.find((s) => s.id === a)!.reason).toMatch(/no es de tu centro/);
    expect((await getExercise(o.admin, a)).level).toBe('beginner');
    await expect(
      bulkEditExercises(o.clientUser, { ids: [a], edit: { kind: 'mark_reviewed' } }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listExerciseReview(o.clientUser, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      bulkEditExercises(o.admin, {
        ids: [a],
        edit: { kind: 'set_pattern', patternId: '01a11fd0-0000-7000-8000-000000000000' },
      }),
    ).rejects.toMatchObject({ code: 'validation', details: { patternId: ['unknown'] } });
    await expect(
      bulkEditExercises(o.admin, { ids: [], edit: { kind: 'mark_reviewed' } }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('next pending in the same queue, by name, with what remains', async () => {
    const d = await imported('Banco D remo');
    const e = await imported('Banco E salto');
    const n = await nextExerciseToReview(o.admin, { after: d, gap: 'pending_review' });
    expect(n).toEqual({ next: { id: e, name: 'Banco E salto' }, remaining: 1 });
    expect(await nextExerciseToReview(o.admin, { after: e, gap: 'pending_review' })).toEqual({
      next: null,
      remaining: 0,
    });
    await expect(nextExerciseToReview(other.admin, { after: d })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('videos wait for a person: verified or broken leaves the queue, and the audit says from what', async () => {
    let v = await listPendingVideos(o.admin, { limit: 1 });
    expect(v.total).toBe(1);
    const item = v.items[0]!;
    expect(item).toMatchObject({
      exerciseId: a,
      embedUrl: expect.stringContaining('youtube-nocookie'),
    });
    expect((await listPendingVideos(other.admin, {})).total).toBe(0);
    await verifyExerciseMedia(o.admin, a, item.mediaId, { status: 'broken' });
    v = await listPendingVideos(o.admin, {});
    expect(v.total).toBe(0);
    expect((await exerciseReviewOverview(o.admin)).videos).toMatchObject({ pending: 0, broken: 1 });
    const logs = await db()
      .select({ action: schema.auditLogs.action, changes: schema.auditLogs.changes })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, item.mediaId));
    expect(logs.find((l) => l.action === 'update')!.changes).toEqual([
      { field: 'status', before: 'pending_verification', after: 'broken' },
    ]);
    // The broken video is a gap of its own, without blocking publication.
    const facts = (await listExerciseReview(o.admin, { gap: 'broken_video' })).items;
    expect(facts.map((f) => f.id)).toEqual([a]);
  });
});
