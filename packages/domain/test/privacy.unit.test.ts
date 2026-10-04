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

describe('external measurements (Phase 15)', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('known type, its unit, technical bounds and no future dates', async () => {
    const { validateMeasurement } = await import('../src');
    expect(
      validateMeasurement(
        { type: 'steps', value: 1000, unit: 'pasos', measuredAt: '2026-10-04T08:00:00Z' },
        now,
      ),
    ).toEqual({});
    expect(
      Object.keys(
        validateMeasurement({ type: 'vo2', value: 50, unit: 'x', measuredAt: '2026-10-04' }, now),
      ),
    ).toEqual(['type']);
    expect(
      Object.keys(
        validateMeasurement(
          { type: 'body_mass', value: 72, unit: 'lb', measuredAt: '2026-10-04' },
          now,
        ),
      ),
    ).toEqual(['unit']);
    expect(
      Object.keys(
        validateMeasurement(
          { type: 'resting_heart_rate', value: 900, unit: 'bpm', measuredAt: '2026-10-04' },
          now,
        ),
      ),
    ).toEqual(['value']);
    expect(
      Object.keys(
        validateMeasurement(
          { type: 'steps', value: 1, unit: 'pasos', measuredAt: '2027-01-01' },
          now,
        ),
      ),
    ).toEqual(['measuredAt']);
  });
});
