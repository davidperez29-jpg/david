/**
 * Consent purposes (§14.4). Health data (art. 9 RGPD) and photographs need explicit consent;
 * training data processing rests on the service contract but is recorded for transparency.
 */
export const CONSENT_PURPOSES = ['service_terms', 'health_data', 'photo', 'marketing'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Current version of the consent text per purpose. Bumping a version requires re-consent. */
export const CONSENT_TEXT_VERSIONS: Record<ConsentPurpose, string> = {
  service_terms: '2026-10-01',
  health_data: '2026-10-01',
  photo: '2026-10-01',
  marketing: '2026-10-01',
};

export interface ConsentRecord {
  purpose: ConsentPurpose;
  textVersion: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

/** Whether a valid, non-revoked consent exists for the current text version. */
export function hasActiveConsent(records: ConsentRecord[], purpose: ConsentPurpose): boolean {
  return records.some(
    (r) =>
      r.purpose === purpose &&
      r.revokedAt === null &&
      r.textVersion === CONSENT_TEXT_VERSIONS[purpose],
  );
}
