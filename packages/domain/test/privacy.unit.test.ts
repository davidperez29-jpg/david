import { describe, expect, it } from 'vitest';
import { anonymizedClientFields, privacyDueOn, retentionExpired } from '../src';

describe('data-subject rights and retention (RGPD)', () => {
  it('answers within one month (end of month clamped, year change)', () => {
    expect(privacyDueOn('2026-10-04')).toBe('2026-11-04');
    expect(privacyDueOn('2026-01-31')).toBe('2026-02-28');
    expect(privacyDueOn('2026-12-15')).toBe('2027-01-15');
  });

  it('retention: never without a decided period; only archived clients past the limit', () => {
    const archived = new Date('2020-01-10T00:00:00Z');
    const now = new Date('2026-01-11T00:00:00Z');
    expect(retentionExpired(archived, null, now)).toBe(false);
    expect(retentionExpired(null, 12, now)).toBe(false);
    expect(retentionExpired(archived, 72, now)).toBe(true);
    expect(retentionExpired(archived, 73, now)).toBe(false);
  });

  it('anonymization keeps only the birth year and a pseudonymous label', () => {
    expect(anonymizedClientFields('01a1-xyz-abcdef', '1995-03-14')).toEqual({
      firstName: 'Cliente',
      lastName: 'anónimo abcdef',
      birthDate: '1995-01-01',
      email: null,
      phoneEnc: null,
      preferences: null,
    });
  });
});
