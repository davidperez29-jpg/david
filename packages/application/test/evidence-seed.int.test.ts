import { loadEvidenceFiles, seedEvidence } from '@tp/db';
import { EVIDENCE_DIR } from '@tp/db/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createExercise,
  getClaim,
  getMethod,
  getSource,
  listClaims,
  listMethods,
  scientificQaReport,
  setClaimStatus,
  setExerciseMethods,
  updateClaim,
  updateMethod,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;

beforeAll(async () => {
  o = await buildOrg();
});

describe('global scientific library seed', () => {
  it('publishes methods whose dose variables trace to verified PubMed sources', async () => {
    const all = await listMethods(o.trainer2);
    const strength = all.find((m) => m.slug === 'fuerza-maxima')!;
    expect(strength).toMatchObject({ isGlobal: true, status: 'published' });
    const m = await getMethod(o.trainer2, strength.id);
    const pct = m.variables.find((v) => v.variableKey === 'pct_1rm')!;
    expect(Number(pct.minValue)).toBe(80);
    expect(pct.claim?.status).toBe('published');
    const ev = pct.claim!.evidence.filter((e) => e.role === 'supports');
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.verificationStatus).toBe('verified');
      expect(e.pmid).toMatch(/^\d+$/);
      expect(e.verificationMethod).toMatch(/PubMed/);
      expect(e.quote?.length).toBeGreaterThan(10);
    }
  });

  it('keeps claims without verified support in draft at level H', async () => {
    const page = await listClaims(o.admin, { q: 'c_ecuaciones_reps_no_verificadas' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ evidenceLevel: 'H', status: 'draft', isGlobal: true });
  });

  it('records the retracted meta-analysis as retracted (QA error), never as support', async () => {
    const r = await scientificQaReport(o.admin);
    const retracted = r.errors.filter((e) => e.code === 'retracted');
    expect(retracted).toHaveLength(1);
    const src = await getSource(o.admin, retracted[0]!.target.key);
    expect(src.pmid).toBe('25968227');
    expect(src.findings).toHaveLength(0);
    expect(r.totals.verifiedSources).toBe(r.totals.sources - 1);
  });

  it('global content is read-only for organizations, but usable from their exercises', async () => {
    const claim = (await listClaims(o.admin, { q: 'c_volume_dose_response' })).items[0]!;
    await expect(
      updateClaim(o.admin, claim.id, { expectedVersion: claim.version, scope: 'x' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(setClaimStatus(o.admin, claim.id, { status: 'deprecated' })).rejects.toMatchObject(
      { code: 'forbidden' },
    );
    const method = (await listMethods(o.admin)).find((m) => m.slug === 'hipertrofia')!;
    await expect(
      updateMethod(o.admin, method.id, { expectedVersion: 1, definition: 'x' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const ex = await createExercise(o.admin, { name: `Curl ${o.tag}`, level: 'beginner' });
    await setExerciseMethods(o.trainer2, ex.id, { methodIds: [method.id] });
    expect((await getMethod(o.admin, method.id)).exercises.map((e) => e.id)).toContain(ex.id);
    expect((await getClaim(o.trainer2, claim.id)).evidence.length).toBeGreaterThan(1);
  });

  it('is idempotent', async () => {
    const data = loadEvidenceFiles(EVIDENCE_DIR);
    const a = await seedEvidence(testDb().db, data);
    const b = await seedEvidence(testDb().db, data);
    expect(b).toEqual(a);
    expect(a.claims.draft).toEqual(['c_ecuaciones_reps_no_verificadas']);
    expect(a.methods.draft).toEqual([]);
  });
});
