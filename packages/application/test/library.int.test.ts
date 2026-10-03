import { schema } from '@tp/db';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addExerciseVideo,
  addProgression,
  createExercise,
  duplicateExercise,
  forkExercise,
  getExercise,
  getFile,
  listExercises,
  listLibraryTaxonomies,
  markExerciseReviewed,
  removeProgression,
  setClientEquipment,
  setExerciseStatus,
  setExerciseTolerance,
  suggestExerciseSubstitutes,
  updateExercise,
  uploadExerciseSilhouette,
  verifyExerciseMedia,
  listCatalog,
  listExerciseTolerances,
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
const eqp = (slug: string) => tax.equipment.find((e) => e.slug === slug)!.id;
const prof = (slug: string) => tax.profiles.find((p) => p.slug === slug)!.id;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function squat(o: Org, name: string, extra: Record<string, unknown> = {}) {
  return createExercise(o.admin, {
    name,
    movementPatternId: pat('knee_dominant'),
    level: 'intermediate',
    bodyRegion: 'lower',
    axialLoad: 'high',
    technicalComplexity: 3,
    clientDescription: 'Baja controlando y sube con intención.',
    prescriptionProfileId: prof('loaded_dynamic'),
    categoryIds: [cat('strength')],
    muscles: [
      { muscleId: mus('quadriceps'), role: 'primary' },
      { muscleId: mus('gluteus_maximus'), role: 'secondary' },
    ],
    equipment: [
      { equipmentId: eqp('barbell'), optional: false },
      { equipmentId: eqp('squat_rack'), optional: false },
    ],
    instructions: [
      { kind: 'cue', text: 'Rodillas en la línea de los pies' },
      { kind: 'common_error', text: 'Talones despegados' },
    ],
    ...extra,
  });
}

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tax = await listLibraryTaxonomies(o.admin);
});

describe('exercise library', () => {
  it('exposes the seeded taxonomies', () => {
    expect(tax.patterns).toHaveLength(17);
    expect(tax.categories.length).toBeGreaterThanOrEqual(22);
    expect(tax.profiles.length).toBe(10);
  });

  it('creates, searches accent-insensitively and filters', async () => {
    const { id } = await squat(o, 'Sentadilla trasera con barra');
    await createExercise(o.admin, {
      name: 'Press banca',
      movementPatternId: pat('horizontal_push'),
      categoryIds: [cat('strength')],
    });
    const byAccent = await listExercises(o.trainer2, { q: 'SENTADÍLLA' });
    expect(byAccent.items.map((e) => e.id)).toContain(id);
    const typo = await listExercises(o.trainer2, { q: 'sentadila trasera' });
    expect(typo.items.map((e) => e.id)).toContain(id);
    const byPattern = await listExercises(o.admin, { patternId: pat('horizontal_push') });
    expect(byPattern.items.map((e) => e.name)).toEqual(['Press banca']);
    const byMuscle = await listExercises(o.admin, { muscleGroup: 'quadriceps' });
    expect(byMuscle.items.map((e) => e.id)).toEqual([id]);
    // only dumbbells available → barbell squat is not doable
    const noBar = await listExercises(o.admin, { equipmentIds: eqp('dumbbells') });
    expect(noBar.items.map((e) => e.id)).not.toContain(id);
    const withBar = await listExercises(o.admin, {
      equipmentIds: `${eqp('barbell')},${eqp('squat_rack')}`,
    });
    expect(withBar.items.map((e) => e.id)).toContain(id);
  });

  it('isolates organizations and forbids the client role', async () => {
    const { id } = await squat(o, 'Sentadilla privada');
    await expect(getExercise(other.admin, id)).rejects.toMatchObject({ code: 'not_found' });
    expect((await listExercises(other.admin, { q: 'privada' })).total).toBe(0);
    await expect(listExercises(o.clientUser, {})).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('publishing requires complete data and review', async () => {
    const { id } = await createExercise(o.admin, { name: 'Borrador incompleto' });
    await expect(setExerciseStatus(o.admin, id, { status: 'published' })).rejects.toMatchObject({
      code: 'validation',
    });
    const d = await getExercise(o.admin, id);
    expect(d.publishProblems).toEqual(
      expect.arrayContaining(['missing_pattern', 'missing_category', 'missing_level']),
    );
    const ok = await squat(o, 'Sentadilla completa');
    await setExerciseStatus(o.admin, ok.id, { status: 'published' });
    expect((await getExercise(o.admin, ok.id)).status).toBe('published');
  });

  it('imported exercises stay unpublishable until reviewed', async () => {
    const { id } = await squat(o, 'Sentadilla importada');
    await testDb()
      .db.update(schema.exercises)
      .set({ needsReview: true })
      .where(eq(schema.exercises.id, id));
    await expect(setExerciseStatus(o.admin, id, { status: 'published' })).rejects.toMatchObject({
      code: 'validation',
    });
    await markExerciseReviewed(o.admin, id, { notes: 'Revisado con el entrenador' });
    await setExerciseStatus(o.admin, id, { status: 'published' });
  });

  it('updates with optimistic locking and replaces relations', async () => {
    const { id } = await squat(o, 'Sentadilla frontal');
    const d = await getExercise(o.admin, id);
    await updateExercise(o.admin, id, {
      expectedVersion: d.version,
      technicalComplexity: 4,
      muscles: [{ muscleId: mus('quadriceps'), role: 'primary' }],
    });
    await expect(
      updateExercise(o.admin, id, { expectedVersion: d.version, level: 'advanced' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const after = await getExercise(o.admin, id);
    expect(after.technicalComplexity).toBe(4);
    expect(after.muscles).toHaveLength(1);
    expect(after.instructions.map((i) => i.text)).toContain('Talones despegados');
  });

  it('rejects references to another organization’s taxonomy', async () => {
    const [foreignTag] = await testDb()
      .db.insert(schema.exerciseTags)
      .values({ organizationId: other.org.organizationId, slug: 'x', name: 'x' })
      .returning();
    await expect(
      createExercise(o.admin, { name: 'Con etiqueta ajena', tagIds: [foreignTag!.id] }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('videos start pending, are validated and verified by a person', async () => {
    const { id } = await squat(o, 'Sentadilla con vídeo');
    await expect(
      addExerciseVideo(o.admin, id, { url: 'https://evil.example/x' }),
    ).rejects.toMatchObject({ code: 'validation' });
    const { mediaId } = await addExerciseVideo(o.admin, id, {
      url: 'youtu.be/vzIA5Wd9wTU',
      title: 'Demo',
    });
    await expect(
      addExerciseVideo(o.admin, id, { url: 'https://www.youtube.com/watch?v=vzIA5Wd9wTU' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    let d = await getExercise(o.admin, id);
    expect(d.media[0]).toMatchObject({
      status: 'pending_verification',
      notice: 'Vídeo pendiente de verificación.',
      embedUrl: 'https://www.youtube-nocookie.com/embed/vzIA5Wd9wTU',
    });
    expect((await listExercises(o.admin, { video: 'pending' })).items.map((e) => e.id)).toContain(
      id,
    );
    await verifyExerciseMedia(o.admin, id, mediaId, { status: 'verified' });
    d = await getExercise(o.admin, id);
    expect(d.media[0]!.status).toBe('verified');
    expect(d.media[0]!.verifiedAt).not.toBeNull();
  });

  it('silhouette upload sniffs the real type and replaces the previous one', async () => {
    const { id } = await squat(o, 'Sentadilla con silueta');
    await expect(
      uploadExerciseSilhouette(o.admin, id, new TextEncoder().encode('<svg onload=alert(1)>')),
    ).rejects.toMatchObject({ code: 'validation' });
    const first = await uploadExerciseSilhouette(o.admin, id, PNG);
    const second = await uploadExerciseSilhouette(o.admin, id, PNG);
    const d = await getExercise(o.admin, id);
    const sil = d.media.filter((m) => m.type === 'silhouette');
    expect(sil.find((m) => m.id === first.mediaId)!.status).toBe('replaced');
    expect(sil.find((m) => m.id === second.mediaId)!.isPrimary).toBe(true);
    const file = await getFile(o.admin, second.fileId);
    expect(file.contentType).toBe('image/png');
    await expect(getFile(other.admin, second.fileId)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('progression graph rejects contradictions', async () => {
    const a = await squat(o, 'Sentadilla goblet');
    const b = await squat(o, 'Sentadilla trasera progresión');
    const c = await squat(o, 'Sentadilla con pausa');
    await addProgression(o.admin, {
      fromExerciseId: a.id,
      toExerciseId: b.id,
      relation: 'progression',
    });
    await addProgression(o.admin, {
      fromExerciseId: b.id,
      toExerciseId: c.id,
      relation: 'progression',
    });
    await expect(
      addProgression(o.admin, { fromExerciseId: a.id, toExerciseId: c.id, relation: 'regression' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      addProgression(o.admin, {
        fromExerciseId: a.id,
        toExerciseId: b.id,
        relation: 'progression',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const detail = await getExercise(o.admin, b.id);
    expect(detail.related.map((r) => [r.name, r.relation]).sort()).toEqual([
      ['Sentadilla con pausa', 'progression'],
      ['Sentadilla goblet', 'regression'],
    ]);
    await removeProgression(
      o.admin,
      detail.related.find((r) => r.name === 'Sentadilla con pausa')!.id,
    );
  });

  it('global exercises are read-only and can be forked', async () => {
    const [g] = await testDb()
      .db.insert(schema.exercises)
      .values({
        organizationId: null,
        slug: `global-${o.tag}`,
        name: `Zancada global ${o.tag}`,
        status: 'published',
        level: 'beginner',
      })
      .returning();
    await expect(
      updateExercise(o.admin, g!.id, { expectedVersion: 1, level: 'advanced' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const fork = await forkExercise(o.admin, g!.id);
    const f = await getExercise(o.admin, fork.id);
    expect(f.isGlobal).toBe(false);
    expect(f.derivedFromId).toBe(g!.id);
    const dup = await duplicateExercise(o.admin, fork.id);
    expect((await getExercise(o.admin, dup.id)).name).toContain('(copia)');
  });

  it('suggests substitutes using client equipment and tolerances, with reasons', async () => {
    const back = await squat(o, 'Sentadilla trasera sustituible');
    const goblet = await createExercise(o.admin, {
      name: 'Sentadilla goblet sustituta',
      movementPatternId: pat('knee_dominant'),
      level: 'beginner',
      axialLoad: 'low',
      technicalComplexity: 2,
      muscles: [{ muscleId: mus('quadriceps'), role: 'primary' }],
      equipment: [{ equipmentId: eqp('dumbbells'), optional: false }],
      categoryIds: [cat('strength')],
    });
    const press = await createExercise(o.admin, {
      name: 'Prensa sustituta',
      movementPatternId: pat('knee_dominant'),
      axialLoad: 'none',
      technicalComplexity: 1,
      muscles: [{ muscleId: mus('quadriceps'), role: 'primary' }],
      equipment: [{ equipmentId: eqp('leg_press'), optional: false }],
    });
    const cat_ = await listCatalog(o.admin);
    await setClientEquipment(o.admin, o.clientA, {
      items: [
        { equipmentId: cat_.equipment.find((e) => e.slug === 'dumbbells')!.id, location: 'home' },
      ],
    });
    const r = await suggestExerciseSubstitutes(o.admin, back.id, {
      reason: 'pain',
      clientId: o.clientA,
      limit: 20,
    });
    const ids = r.suggestions.map((s) => s.exerciseId);
    expect(ids).toContain(goblet.id);
    expect(ids).not.toContain(press.id); // no leg press available
    expect(r.suggestions.find((s) => s.exerciseId === goblet.id)!.reasons).toContain(
      'Menor carga axial o impacto',
    );
    await setExerciseTolerance(o.admin, o.clientA, {
      exerciseId: goblet.id,
      kind: 'not_tolerated',
      reason: 'Molestia declarada',
    });
    const r2 = await suggestExerciseSubstitutes(o.admin, back.id, {
      reason: 'pain',
      clientId: o.clientA,
      limit: 20,
    });
    expect(r2.suggestions.map((s) => s.exerciseId)).not.toContain(goblet.id);
    expect((await listExerciseTolerances(o.admin, o.clientA))[0]!.exerciseName).toBe(
      'Sentadilla goblet sustituta',
    );
    // trainer2 cannot use another trainer's client as context
    await expect(
      suggestExerciseSubstitutes(o.trainer2, back.id, { reason: 'pain', clientId: o.clientA }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('exercise bank import', () => {
  it('imports drafts flagged for review, pending videos, idempotently', async () => {
    const { importExerciseBank } = await import('../src');
    const entry = {
      key: `bank-${o.tag}`,
      name: `Curl nórdico importado ${o.tag}`,
      workbooks: ['Rutina_General_1'],
      blocks: ['Batería preventiva · Tipo 3'],
      sources: ['Personalizado'],
      videos: ['https://www.youtube.com/watch?v=vzIA5Wd9wTU'],
      pattern: 'hip_dominant',
      primaryMuscles: ['hamstrings'],
      secondaryMuscles: [],
      categories: ['eccentric'],
      contraction: ['eccentric'],
      equipment: [],
      bodyRegion: 'lower',
      profile: 'loaded_dynamic',
      battery: {
        number: 60,
        type: 'Tipo 3 · Fortalecimiento',
        mode: 'Excéntrico',
        targetZone: 'isquiotibiales',
        dose: '2 x 5',
        execution: 'Descenso controlado.',
        error: 'Flexionar la cadera.',
      },
      review: ['Material sin clasificar.'],
    };
    const r1 = await importExerciseBank(o.admin, [entry]);
    expect(r1).toMatchObject({ created: 1, videos: 1, failed: [] });
    const r2 = await importExerciseBank(o.admin, [entry]);
    expect(r2).toMatchObject({ created: 0, skippedExisting: 1 });
    const found = await listExercises(o.admin, { q: `importado ${o.tag}` });
    const d = await getExercise(o.admin, found.items[0]!.id);
    expect(d).toMatchObject({ status: 'draft', needsReview: true, source: 'excel' });
    expect(d.publishProblems).toContain('pending_review');
    expect(d.media[0]!.status).toBe('pending_verification');
    expect(d.instructions.map((i) => i.kind).sort()).toEqual(['common_error', 'execution']);
    expect(d.contractionEmphasis).toEqual(['eccentric']);
  });
});
