import { describe, expect, it } from 'vitest';
import {
  canSupport,
  EVIDENCE_KINDS,
  evidenceKindIssue,
  inferEvidenceKind,
  qaClaim,
  type QaFinding,
  type QaSource,
} from '../src';

describe('evidence kind (restructure phase 9)', () => {
  it('infers the kind from what the supporting findings measured', () => {
    const k = (outcomes: [string, string][], level = 'B', epistemicType = 'fact') =>
      inferEvidenceKind({
        epistemicType,
        level,
        supportOutcomes: outcomes.map(([slug, domain]) => ({ slug, domain })),
      });
    expect(k([['injury_incidence', 'clinical']])).toBe('incidence_reduction');
    expect(k([['falls', 'clinical']])).toBe('incidence_reduction');
    expect(k([['eccentric_strength', 'strength']])).toBe('performance');
    expect(k([['interlimb_asymmetry', 'assessment']])).toBe('risk_factor_change');
    expect(k([['joint_kinematics', 'biomechanics']])).toBe('risk_factor_change');
    expect(k([], 'B')).toBe('insufficient');
    expect(k([['jump_height', 'power']], 'H')).toBe('insufficient');
    expect(k([['pain', 'clinical']], 'F')).toBe('practical_criterion');
    expect(k([['muscle_activation', 'neuromuscular']], 'C', 'hypothesis')).toBe('mechanism');
    expect(Object.keys(EVIDENCE_KINDS)).toHaveLength(6);
  });

  it('«reduce el riesgo de lesión» needs incidence evidence; a risk factor never says it', () => {
    const text = 'El programa reduce el riesgo de lesiones de isquiosurales en futbolistas.';
    expect(evidenceKindIssue(text, 'incidence_reduction')).toBeNull();
    expect(evidenceKindIssue(text, 'risk_factor_change')).toMatch(/no midió la incidencia/);
    expect(evidenceKindIssue('Menor tasa de caídas en mayores.', 'performance')).not.toBeNull();
    expect(
      evidenceKindIssue('Mejora la fuerza excéntrica, asociada a la lesión.', 'risk_factor_change'),
    ).toBeNull();
  });

  it('only verified sources support; QA flags the mismatch and unverified support', () => {
    expect(canSupport('verified')).toBe(true);
    expect(canSupport('verified_with_corrections')).toBe(true);
    for (const v of [
      'unverified',
      'cited_in_document',
      'unverifiable',
      'retracted',
      'non_scientific',
    ])
      expect(canSupport(v)).toBe(false);
    const src = (verificationStatus: QaSource['verificationStatus']): QaSource => ({
      key: 's',
      doi: null,
      pmid: '1',
      verificationStatus,
      verifiedAt: '2026-10-06',
      verificationMethod: 'PubMed',
      populationSummary: 'x',
    });
    const f: QaFinding = {
      key: 'f',
      sourceKey: 's',
      populationSlug: 'p',
      quote: 'q',
      effectValue: null,
    };
    const claim = {
      key: 'c',
      statement: 'Reduce la incidencia de lesiones en futbolistas.',
      status: 'published',
      findings: [{ findingKey: 'f', role: 'supports' as const }],
      appliesTo: ['p'],
      level: 'B' as const,
      evidenceKind: 'risk_factor_change' as const,
    };
    const codes = (s: QaSource) =>
      qaClaim(claim, new Map([['f', f]]), new Map([['s', s]])).map((i) => i.code);
    expect(codes(src('verified'))).toContain('evidence_kind_mismatch');
    expect(codes(src('cited_in_document'))).toContain('unverified_support');
    expect(
      qaClaim(
        { ...claim, evidenceKind: 'incidence_reduction' },
        new Map([['f', f]]),
        new Map([['s', src('verified')]]),
      ),
    ).toEqual([]);
  });
});
