import { describe, expect, it } from 'vitest';
import {
  assessApplicability,
  claimLevel,
  gradeFinding,
  qaClaim,
  qaFinding,
  qaSource,
  type GradingRationale,
  type QaFinding,
  type QaSource,
} from '../src';

const base: GradingRationale = {
  design: 'meta_analysis',
  riskOfBias: 'no',
  inconsistency: 'no',
  indirectness: 'no',
  imprecision: 'no',
  publicationBias: 'no',
};

describe('gradeFinding', () => {
  it('starts by design and explains the result', () => {
    const g = gradeFinding(base, true);
    expect(g.level).toBe('A');
    expect(g.explanation).toContain('metaanálisis');
    expect(gradeFinding({ ...base, design: 'rct' }, true).level).toBe('B');
    expect(gradeFinding({ ...base, design: 'cohort' }, true).level).toBe('C');
    expect(gradeFinding({ ...base, design: 'mechanistic' }, true).level).toBe('E');
    expect(gradeFinding({ ...base, design: 'narrative_review' }, true).level).toBe('G');
  });
  it('guidelines are A only when built on a systematic review', () => {
    expect(gradeFinding({ ...base, design: 'position_stand' }, true).level).toBe('F');
    expect(
      gradeFinding({ ...base, design: 'position_stand', basedOnSystematicReview: true }, true)
        .level,
    ).toBe('A');
  });
  it('downgrades one step per serious concern, floor C', () => {
    const g = gradeFinding(
      { ...base, indirectness: 'serious', imprecision: 'serious', riskOfBias: 'serious' },
      true,
    );
    expect(g.level).toBe('C');
    expect(g.downgrades).toHaveLength(3);
    expect(gradeFinding({ ...base, indirectness: 'serious' }, true).level).toBe('B');
  });
  it('contradictory → D, unverified → H regardless of design', () => {
    expect(gradeFinding({ ...base, inconsistency: 'contradictory' }, true).level).toBe('D');
    expect(gradeFinding(base, false).level).toBe('H');
  });
});

describe('claimLevel', () => {
  it('takes the best support and becomes D with comparable contradiction', () => {
    expect(
      claimLevel([
        { level: 'B', role: 'supports' },
        { level: 'A', role: 'supports' },
      ]),
    ).toBe('A');
    expect(
      claimLevel([
        { level: 'A', role: 'supports' },
        { level: 'B', role: 'contradicts' },
      ]),
    ).toBe('D');
    expect(
      claimLevel([
        { level: 'A', role: 'supports' },
        { level: 'G', role: 'contradicts' },
      ]),
    ).toBe('A');
    expect(claimLevel([{ level: 'B', role: 'context' }])).toBe('H');
  });
});

describe('assessApplicability', () => {
  const older = {
    name: 'Adultos mayores (≥ 65)',
    ageMin: 65,
    ageMax: null,
    sex: 'mixed' as const,
    trainingStatus: 'mixed' as const,
    sportSlug: null,
  };
  it('warns when a study in older adults is applied to a young athlete', () => {
    const r = assessApplicability(
      { age: 22, sex: 'male', trainingStatus: 'trained', sportSlug: 'football' },
      older,
    );
    expect(r.overall).toBe('mismatch');
    expect(r.warnings[0]).toContain('Adultos mayores');
    expect(r.warnings[0]).toContain('22 años');
  });
  it('flags sport and sex differences as partial', () => {
    const r = assessApplicability(
      { age: 24, sex: 'female', trainingStatus: 'trained', sportSlug: 'handball' },
      {
        name: 'Futbolistas',
        ageMin: 18,
        ageMax: 35,
        sex: 'male',
        trainingStatus: 'trained',
        sportSlug: 'football',
      },
    );
    expect(r.overall).toBe('partial');
    expect(r.dimensions).toMatchObject({
      age: 'match',
      sex: 'partial',
      training: 'match',
      sport: 'partial',
    });
  });
});

describe('scientific QA', () => {
  const src = (o: Partial<QaSource> = {}): QaSource => ({
    key: 's1',
    doi: '10.1249/MSS.0b013e3181915670',
    pmid: '19204579',
    verificationStatus: 'verified',
    verifiedAt: '2026-10-03',
    verificationMethod: 'PubMed',
    populationSummary: 'Adultos sanos',
    ...o,
  });
  const fin = (o: Partial<QaFinding> = {}): QaFinding => ({
    key: 'f1',
    sourceKey: 's1',
    populationSlug: 'adults_untrained',
    quote: 'effect size 0.37',
    effectValue: 0.37,
    ...o,
  });
  it('validates sources', () => {
    expect(qaSource(src())).toEqual([]);
    expect(qaSource(src({ doi: 'doi:10.1/x' })).map((i) => i.code)).toContain('doi_format');
    expect(qaSource(src({ verificationMethod: null })).map((i) => i.code)).toContain(
      'verification_incomplete',
    );
    expect(qaSource(src({ verificationStatus: 'retracted' })).map((i) => i.code)).toContain(
      'retracted',
    );
  });
  it('checks that numbers appear in the literal quote', () => {
    expect(qaFinding(fin({ effectValue: 0.8 })).map((i) => i.code)).toEqual([
      'number_not_in_quote',
    ]);
    expect(qaFinding(fin())).toEqual([]);
  });
  it('blocks causal language, unverified support and flags extrapolation', () => {
    const findings = new Map([['f1', fin()]]);
    const sources = new Map([['s1', src()]]);
    const claim = {
      key: 'c1',
      statement: 'El trabajo excéntrico previene lesiones de isquios',
      status: 'draft',
      findings: [{ findingKey: 'f1', role: 'supports' as const }],
      appliesTo: ['adults_untrained', 'football_players'],
      level: 'A' as const,
    };
    const codes = qaClaim(claim, findings, sources).map((i) => i.code);
    expect(codes).toContain('causal_language');
    expect(codes).toContain('extrapolation');
    const unverified = qaClaim(
      { ...claim, statement: 'ok' },
      findings,
      new Map([['s1', src({ verificationStatus: 'unverified' })]]),
    ).map((i) => i.code);
    expect(unverified).toContain('unverified_support');
    expect(
      qaClaim({ ...claim, statement: 'ok', findings: [] }, findings, sources).map((i) => i.code),
    ).toContain('no_support');
  });
});
