import { schema } from '@tp/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createClaim,
  createScienceSearch,
  evidenceCards,
  getClaim,
  listScienceSearches,
} from '../src';
import { buildOrg, testDb } from './fixtures';

/** Restructure phase 9: «Fuente» cards, evidence kind, verification states and search log. */
type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
const { evidenceSources, knowledgeClaims, claimEvidence, evidenceFindings } = schema;
const sourceByKey = async (key: string) =>
  (
    await testDb()
      .db.select()
      .from(evidenceSources)
      .where(and(isNull(evidenceSources.organizationId), eq(evidenceSources.sourceKey, key)))
  )[0]!;

beforeAll(async () => {
  o = await buildOrg();
});

describe('«Fuente» cards (phase 9)', () => {
  it('a verified source shows article, DOI/PMID, population, what it supports and limitations', async () => {
    const grindem = await sourceByKey('grindem2016_acl_decision_rules');
    const r = await evidenceCards(o.admin, { sourceIds: [grindem.id] });
    expect(r.notSupporting).toEqual([]);
    const c = r.cards[0]!;
    expect(c).toMatchObject({ pmid: '27162233', doi: '10.1136/bjsports-2016-096031' });
    expect(c.population).toBeTruthy();
    expect(c.limitations).toBeTruthy();
    expect(c.verification).toBe('Verificada');
    expect(c.supports.length).toBeGreaterThan(0);
    expect(c.supports.every((s) => s.evidenceKind)).toBe(true);
  });

  it('an unverifiable reference of a user document never appears as support', async () => {
    const isak = await sourceByKey('marfelljones2006_isak_standards');
    expect(isak.verificationStatus).toBe('unverifiable');
    expect(isak.origin).toBe('user_document');
    expect(isak.pmid).toBeNull();
    const r = await evidenceCards(o.admin, { sourceIds: [isak.id] });
    expect(r.cards).toEqual([]);
    expect(r.notSupporting[0]).toMatchObject({ verification: 'No verificable' });
  });

  it('method cards come from the claims behind the method doses', async () => {
    const [m] = await testDb()
      .db.select({ id: schema.methods.id })
      .from(schema.methods)
      .where(and(isNull(schema.methods.organizationId), eq(schema.methods.status, 'published')))
      .limit(1);
    const r = await evidenceCards(o.admin, { methodIds: [m!.id] });
    expect(r.cards.length).toBeGreaterThan(0);
  });

  it('the client app cannot read the science library', async () => {
    await expect(evidenceCards(o.clientUser, { sourceIds: [] })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('evidence kind and the seed (phase 9)', () => {
  it('every published global claim has a kind and only verified supporting sources', async () => {
    const claims = await testDb()
      .db.select({ id: knowledgeClaims.id, kind: knowledgeClaims.evidenceKind })
      .from(knowledgeClaims)
      .where(and(isNull(knowledgeClaims.organizationId), eq(knowledgeClaims.status, 'published')));
    expect(claims.length).toBeGreaterThan(50);
    expect(claims.filter((c) => !c.kind)).toEqual([]);
    const support = await testDb()
      .db.select({ status: evidenceSources.verificationStatus })
      .from(claimEvidence)
      .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
      .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFindings.sourceId))
      .where(
        and(
          inArray(
            claimEvidence.claimId,
            claims.map((c) => c.id),
          ),
          eq(claimEvidence.role, 'supports'),
        ),
      );
    expect(
      support.filter((s) => s.status !== 'verified' && s.status !== 'verified_with_corrections'),
    ).toEqual([]);
  });

  it('«reduce el riesgo de lesiones» is rejected unless the evidence measured incidence', async () => {
    const base = {
      key: `c_test_${o.tag}`,
      statement:
        'El trabajo excéntrico reduce el riesgo de lesiones de isquiosurales en futbolistas.',
      epistemicType: 'inference',
      confidence: 'low',
    };
    await expect(
      createClaim(o.admin, { ...base, evidenceKind: 'risk_factor_change' }),
    ).rejects.toMatchObject({ code: 'validation' });
    const r = await createClaim(o.admin, { ...base, evidenceKind: 'incidence_reduction' });
    const c = await getClaim(o.admin, r.id);
    expect(c).toMatchObject({ evidenceKind: 'incidence_reduction', origin: 'practical_proposal' });
  });
});

describe('search log (phase 9)', () => {
  it('lists the seeded searches and the centre logs its own', async () => {
    const all = await listScienceSearches(o.admin, {});
    expect(all.topics).toContain('club_references');
    const club = all.items.filter((s) => s.topic === 'club_references');
    expect(club.length).toBeGreaterThan(0);
    expect(club.some((s) => s.selected.length > 0)).toBe(true);
    await createScienceSearch(o.admin, {
      topic: 'aductores',
      objective: 'Criterios de vuelta tras lesión aguda',
      query: 'adductor injury return to sport criteria',
      searchedOn: '2026-10-06',
      reviewed: 12,
    });
    const mine = await listScienceSearches(o.admin, { topic: 'aductores' });
    expect(mine.items[0]).toMatchObject({ isGlobal: false, reviewed: 12 });
    await expect(
      createScienceSearch(o.clientUser, {
        topic: 'x',
        objective: 'x',
        query: 'xxxx',
        searchedOn: '2026-10-06',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
