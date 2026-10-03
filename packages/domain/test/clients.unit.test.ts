import { describe, expect, it } from 'vitest';
import {
  ageAt,
  checkPassword,
  CONSENT_TEXT_VERSIONS,
  diffFields,
  hasActiveConsent,
  needsReferral,
  redact,
  validateGoalSelection,
} from '../src';

describe('ageAt', () => {
  it('computes whole years, respecting birthdays', () => {
    expect(ageAt('2000-10-04', new Date('2026-10-03T12:00:00Z'))).toBe(25);
    expect(ageAt('2000-10-03', new Date('2026-10-03T12:00:00Z'))).toBe(26);
    expect(ageAt('2000-02-29', new Date('2027-02-28T12:00:00Z'))).toBe(26);
  });
});

describe('validateGoalSelection', () => {
  const g = (goalId: string, isPrimary: boolean, w: number) => ({ goalId, isPrimary, priorityWeight: w });
  it('accepts one primary plus secondaries', () => {
    expect(validateGoalSelection([g('a', true, 1), g('b', false, 0.5)])).toEqual([]);
  });
  it('requires exactly one primary', () => {
    expect(validateGoalSelection([g('a', false, 1)])).toContain('no_primary');
    expect(validateGoalSelection([g('a', true, 1), g('b', true, 1)])).toContain('multiple_primary');
  });
  it('rejects duplicates, bad weights and secondaries outweighing the primary', () => {
    expect(validateGoalSelection([g('a', true, 1), g('a', false, 0.2)])).toContain('duplicate_goal');
    expect(validateGoalSelection([g('a', true, 1.5)])).toContain('weight_out_of_range');
    expect(validateGoalSelection([g('a', true, 0.4), g('b', false, 0.6)])).toContain('primary_not_highest');
  });
});

describe('consents', () => {
  const now = new Date();
  it('requires the current text version and no revocation', () => {
    const v = CONSENT_TEXT_VERSIONS.health_data;
    expect(hasActiveConsent([{ purpose: 'health_data', textVersion: v, grantedAt: now, revokedAt: null }], 'health_data')).toBe(true);
    expect(hasActiveConsent([{ purpose: 'health_data', textVersion: 'old', grantedAt: now, revokedAt: null }], 'health_data')).toBe(false);
    expect(hasActiveConsent([{ purpose: 'health_data', textVersion: v, grantedAt: now, revokedAt: now }], 'health_data')).toBe(false);
    expect(hasActiveConsent([{ purpose: 'photo', textVersion: v, grantedAt: now, revokedAt: null }], 'health_data')).toBe(false);
  });
});

describe('needsReferral', () => {
  it('flags uncleared declarations that require professional assessment', () => {
    expect(needsReferral([{ declaredStatus: 'active', requiresProfessionalAssessment: true }])).toBe(true);
    expect(needsReferral([{ declaredStatus: 'active', requiresProfessionalAssessment: true, clearedAt: new Date() }])).toBe(false);
    expect(needsReferral([{ declaredStatus: 'active', requiresProfessionalAssessment: false }])).toBe(false);
  });
});

describe('checkPassword', () => {
  it('enforces length and rejects trivial passwords', () => {
    expect(checkPassword('short')).toContain('too_short');
    expect(checkPassword('aaaaaaaaaaaaaa')).toContain('too_common');
    expect(checkPassword('juan.perez-2026-entreno', 'juan.perez@example.com')).toContain('contains_email');
    expect(checkPassword('correct-horse-battery-staple', 'ana@example.com')).toEqual([]);
  });
});

describe('diffFields', () => {
  it('reports only changed listed fields and normalises dates', () => {
    const d = diffFields(
      { a: 1, b: 'x', when: new Date('2026-01-01T00:00:00Z'), ignored: 1 },
      { a: 1, b: 'y', when: new Date('2026-01-01T00:00:00Z'), ignored: 2 },
      ['a', 'b', 'when'],
    );
    expect(d).toEqual([{ field: 'b', before: 'x', after: 'y' }]);
  });
  it('redacts secrets', () => {
    expect(redact([{ field: 'passwordHash', before: 'h1', after: 'h2' }])[0]).toEqual({ field: 'passwordHash', before: '[redacted]', after: '[redacted]' });
  });
});
