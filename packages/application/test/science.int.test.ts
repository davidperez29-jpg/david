import { schema } from '@tp/db';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addEvidenceReview,
  addFinding,
  createClaim,
  createExercise,
  createMethod,
  createSource,
  deleteFinding,
  getClaim,
  getExercise,
  getMethod,
  getSource,
  listClaims,
  listMethods,
  listScienceTaxonomies,
  listSources,
  scientificQaReport,
  setClaimStatus,
  setExerciseMethods,
  setMethodStatus,
  updateClaim,
  updateSource,
  verifySource,
  type ScienceTaxonomies,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tax: ScienceTaxonomies;
const pop = (slug: string) => tax.populations.find((p) => p.slug === slug)!.id;
const out = (slug: string) => tax.outcomes.find((p) => p.slug === slug)!.id;
const NO = {
  riskOfBias: 'no',
  inconsistency: 'no',
  indirectness: 'no',
  imprecision: 'no',
  publicationBias: 'no',
} as const;
const CHECK_OK = {
  numbersMatchSource: true,
  populationRespected: true,
  noCorrelationAsCausation: true,
  noMechanismAsClinicalOutcome: true,
  noInjuryPreventionAsFact: true,
  contraryEvidenceRecorded: true,
};

async function metaAnalysis(o: Org, title: string, pmid: string) {
  return createSource(o.trainer2, {
    title,
    authors: ['Autor A', 'Autor B'],
    year: 2020,
    journal: 'Revista de prueba',
    pmid,
    studyDesign: 'meta_analysis',
    populationSummary: 'Adultos entrenados en fuerza',
  });
}

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tax = await listScienceTaxonomies(o.admin);
});

describe('scientific library', () => {
  it('grades findings from the rationale and caps unverified sources at H', async () => {
    const s = await metaAnalysis(o, `Metaanálisis de volumen ${o.tag}`, '90000001');
    const f = await addFinding(o.trainer2, s.id, {
      outcomeId: out('muscle_hypertrophy'),
      populationId: pop('adults_resistance_trained'),
      effectMetric: 'SMD',
      effectValue: 0.24,
      quote: 'Higher volumes produced greater gains (SMD 0.24).',
      grading: { ...NO, imprecision: 'serious' },
    });
    expect(f.level).toBe('H');

    // Trainers cannot verify; admins can, and verification recomputes the level (A → B).
    await expect(
      verifySource(o.trainer2, s.id, {
        status: 'verified',
        access: 'abstract_only',
        verificationMethod: 'PubMed',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await verifySource(o.admin, s.id, {
      status: 'verified',
      access: 'abstract_only',
      verificationMethod: 'PubMed, resumen leído',
    });
    const detail = await getSource(o.trainer2, s.id);
    expect(detail.findings[0]!.evidenceLevel).toBe('B');
    expect(detail.findings[0]!.gradingExplanation).toMatch(/imprecisi/i);

    // A non-bibliographic edit keeps authors and the verification.
    await updateSource(o.trainer2, s.id, {
      expectedVersion: detail.version,
      practicalApplication: 'Aplicable a adultos entrenados.',
    });
    const kept = await getSource(o.admin, s.id);
    expect(kept.authors).toEqual(['Autor A', 'Autor B']);
    expect(kept.verificationStatus).toBe('verified');

    // Editing bibliographic data un-verifies and drops the level back to H.
    await updateSource(o.trainer2, s.id, { expectedVersion: kept.version, year: 2021 });
    const after = await getSource(o.admin, s.id);
    expect(after.verificationStatus).toBe('unverified');
    expect(after.findings[0]!.evidenceLevel).toBe('H');
  });

  it('refuses to verify a source without DOI, PMID or URL', async () => {
    const s = await createSource(o.admin, {
      title: `Libro sin identificador ${o.tag}`,
      studyDesign: 'book',
    });
    await expect(
      verifySource(o.admin, s.id, {
        status: 'verified',
        access: 'full_text',
        verificationMethod: 'Lectura',
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('blocks publishing claims that fail scientific QA, and ADMIN-only publishing', async () => {
    const s = await metaAnalysis(o, `Metaanálisis de frecuencia ${o.tag}`, '90000002');
    const f = await addFinding(o.admin, s.id, {
      outcomeId: out('max_strength_1rm'),
      populationId: pop('adults_resistance_trained'),
      quote: 'Frequency did not significantly affect strength when volume was equated.',
      grading: NO,
    });
    const c = await createClaim(o.trainer2, {
      key: `freq.equated.${o.tag}`,
      statement:
        'Con el volumen igualado, la frecuencia semanal no previene nada y apenas cambia la fuerza.',
      scope: 'Fuerza',
      epistemicType: 'inference',
      confidence: 'moderate',
      findings: [{ findingId: f.id, role: 'supports' }],
      appliesTo: ['adults_resistance_trained', 'older_adults'],
    });
    let claim = await getClaim(o.admin, c.id);
    expect(claim.evidenceLevel).toBe('H');
    const codes = claim.qa.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['unverified_support', 'causal_language', 'extrapolation']),
    );

    await expect(setClaimStatus(o.trainer2, c.id, { status: 'published' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(setClaimStatus(o.admin, c.id, { status: 'published' })).rejects.toMatchObject({
      code: 'validation',
    });

    await verifySource(o.admin, s.id, {
      status: 'verified',
      access: 'abstract_only',
      verificationMethod: 'PubMed',
    });
    await updateClaim(o.trainer2, c.id, {
      expectedVersion: claim.version,
      statement:
        'Con el volumen igualado, la frecuencia semanal apenas cambia la ganancia de fuerza.',
      appliesTo: ['adults_resistance_trained'],
    });
    claim = await getClaim(o.admin, c.id);
    expect(claim.evidenceLevel).toBe('A');
    expect(claim.qa.filter((i) => i.severity === 'error')).toEqual([]);

    // Approval requires a complete checklist.
    await expect(
      addEvidenceReview(o.admin, {
        target: 'claim',
        targetId: c.id,
        outcome: 'approved',
        checklist: { ...CHECK_OK, contraryEvidenceRecorded: false },
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await addEvidenceReview(o.admin, {
      target: 'claim',
      targetId: c.id,
      outcome: 'approved',
      checklist: CHECK_OK,
    });
    await setClaimStatus(o.admin, c.id, { status: 'published' });
    claim = await getClaim(o.trainer2, c.id);
    expect(claim.status).toBe('published');
    expect(claim.reviews).toHaveLength(1);

    // Editing a published claim sends it back to draft.
    await updateClaim(o.trainer2, c.id, {
      expectedVersion: claim.version,
      limitations: 'Solo adultos entrenados.',
    });
    expect((await getClaim(o.admin, c.id)).status).toBe('draft');

    // Deleting the only finding leaves the claim without support (level H).
    await deleteFinding(o.admin, f.id);
    expect((await getClaim(o.admin, c.id)).evidenceLevel).toBe('H');
  });

  it('a contradicting finding of comparable strength yields level D', async () => {
    const a = await metaAnalysis(o, `A favor ${o.tag}`, '90000003');
    const b = await metaAnalysis(o, `En contra ${o.tag}`, '90000004');
    for (const id of [a.id, b.id])
      await verifySource(o.admin, id, {
        status: 'verified',
        access: 'abstract_only',
        verificationMethod: 'PubMed',
      });
    const fa = await addFinding(o.admin, a.id, {
      outcomeId: out('jump_height'),
      populationId: pop('adults_recreational'),
      quote: 'Improved jump height.',
      grading: NO,
    });
    const fb = await addFinding(o.admin, b.id, {
      outcomeId: out('jump_height'),
      populationId: pop('adults_recreational'),
      quote: 'No change in jump height.',
      grading: NO,
    });
    const c = await createClaim(o.admin, {
      key: `jump.contradiction.${o.tag}`,
      statement: 'El método mejora la altura de salto en adultos recreativos.',
      epistemicType: 'inference',
      confidence: 'low',
      findings: [
        { findingId: fa.id, role: 'supports' },
        { findingId: fb.id, role: 'contradicts' },
      ],
    });
    expect((await getClaim(o.admin, c.id)).evidenceLevel).toBe('D');
  });

  it('methods expose traceability and publish only when every variable is justified', async () => {
    const s = await metaAnalysis(o, `Metaanálisis de descanso ${o.tag}`, '90000005');
    await verifySource(o.admin, s.id, {
      status: 'verified',
      access: 'abstract_only',
      verificationMethod: 'PubMed',
    });
    const f = await addFinding(o.admin, s.id, {
      outcomeId: out('muscle_hypertrophy'),
      populationId: pop('adults_resistance_trained'),
      quote: 'Longer rest intervals favoured hypertrophy.',
      grading: NO,
    });
    const c = await createClaim(o.admin, {
      key: `rest.long.${o.tag}`,
      statement: 'Descansos más largos pueden favorecer la hipertrofia.',
      epistemicType: 'inference',
      confidence: 'moderate',
      findings: [{ findingId: f.id, role: 'supports' }],
    });
    const m = await createMethod(o.trainer2, {
      name: `Series de hipertrofia ${o.tag}`,
      kind: 'training_method',
      definition: 'Series con cargas moderadas cerca del fallo.',
      notes: [{ kind: 'mechanism', text: 'Tensión mecánica', claimId: c.id }],
      variables: [
        { variableKey: 'rest_seconds', minValue: 120, maxValue: 180, unit: 's', claimId: c.id },
        { variableKey: 'rir', minValue: 0, maxValue: 3 },
      ],
    });
    await expect(setMethodStatus(o.trainer2, m.id, { status: 'published' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(setMethodStatus(o.admin, m.id, { status: 'published' })).rejects.toMatchObject({
      code: 'validation',
    });

    const detail = await getMethod(o.trainer2, m.id);
    const rest = detail.variables.find((v) => v.variableKey === 'rest_seconds')!;
    expect(rest.claim?.level).toBe('A');
    expect(rest.claim?.evidence[0]!.pmid).toBe('90000005');
    expect(detail.notes[0]!.claim?.key).toBe(`rest.long.${o.tag}`);

    await expect(
      createMethod(o.admin, {
        name: 'Rango inválido',
        kind: 'training_method',
        variables: [{ variableKey: 'reps', minValue: 12, maxValue: 6 }],
      }),
    ).rejects.toMatchObject({ code: 'validation' });

    // Link exercises ↔ methods (by id only).
    const ex = await createExercise(o.admin, { name: `Prensa ${o.tag}`, level: 'beginner' });
    await setExerciseMethods(o.trainer2, ex.id, { methodIds: [m.id] });
    expect((await getMethod(o.admin, m.id)).exercises.map((e) => e.id)).toEqual([ex.id]);
    expect((await listMethods(o.admin)).find((x) => x.id === m.id)!.exercises).toBe(1);
    await expect(
      setExerciseMethods(other.admin, ex.id, { methodIds: [m.id] }),
    ).rejects.toMatchObject({ code: 'not_found' });
    const otherEx = await createExercise(other.admin, {
      name: `Prensa otra ${o.tag}`,
      level: 'beginner',
    });
    await expect(
      setExerciseMethods(other.admin, otherEx.id, { methodIds: [m.id] }),
    ).rejects.toMatchObject({ code: 'validation' });
    void getExercise;
  });

  it('isolates organizations, keeps global content read-only and hides science from clients', async () => {
    const s = await metaAnalysis(o, `Privada ${o.tag}`, '90000006');
    await expect(getSource(other.admin, s.id)).rejects.toMatchObject({ code: 'not_found' });
    expect((await listSources(other.admin, { q: `Privada ${o.tag}` })).total).toBe(0);
    await expect(listSources(o.clientUser, {})).rejects.toMatchObject({ code: 'forbidden' });

    const [g] = await testDb()
      .db.insert(schema.evidenceSources)
      .values({
        organizationId: null,
        title: `Global ${o.tag}`,
        studyDesign: 'rct',
        pmid: `8${o.tag.replace(/\D/g, '').slice(0, 7) || '1'}`,
        verificationStatus: 'unverified',
      })
      .returning();
    expect((await getSource(other.admin, g!.id)).isGlobal).toBe(true);
    await expect(
      updateSource(o.admin, g!.id, { expectedVersion: 1, year: 2000 }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      addFinding(o.admin, g!.id, {
        outcomeId: out('pain'),
        populationId: pop('adults_untrained'),
        quote: 'Some quote.',
        grading: NO,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await testDb().db.delete(schema.evidenceSources).where(eq(schema.evidenceSources.id, g!.id));
  });

  it('duplicate DOI/PMID within an organization is a conflict', async () => {
    await metaAnalysis(o, `Duplicada ${o.tag}`, '90000007');
    await expect(metaAnalysis(o, `Duplicada 2 ${o.tag}`, '90000007')).rejects.toMatchObject({
      code: 'conflict',
    });
    await metaAnalysis(other, `Otra org ${o.tag}`, '90000007');
  });

  it('QA report summarises errors and claim levels', async () => {
    const r = await scientificQaReport(o.admin);
    expect(r.totals.sources).toBeGreaterThan(3);
    expect(r.errors.every((e) => e.href.startsWith('/app/science/'))).toBe(true);
    expect(
      (await listClaims(o.admin, { level: 'D' })).items.some((c) =>
        c.key.startsWith('jump.contradiction'),
      ),
    ).toBe(true);
  });
});
