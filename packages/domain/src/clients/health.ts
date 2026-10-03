/**
 * Declared health information. The system never diagnoses (§10 del encargo, §14.5).
 * Any declaration flagged as needing professional assessment surfaces this exact text.
 */
export const REFERRAL_TEXT = 'Requiere valoración por profesional sanitario.';

export const HEALTH_DECLARATION_TYPES = ['injury', 'surgery', 'limitation', 'other'] as const;
export type HealthDeclarationType = (typeof HEALTH_DECLARATION_TYPES)[number];

export const DECLARED_STATUS = ['active', 'resolved', 'unknown'] as const;
export type DeclaredStatus = (typeof DECLARED_STATUS)[number];

export interface HealthDeclarationFlags {
  declaredStatus: DeclaredStatus;
  requiresProfessionalAssessment: boolean;
  /** Set when a trainer records that a health professional has cleared the issue. */
  clearedAt?: Date | null;
}

/** A client shows a referral banner while any declaration needs assessment and is not cleared. */
export function needsReferral(declarations: HealthDeclarationFlags[]): boolean {
  return declarations.some((d) => d.requiresProfessionalAssessment && !d.clearedAt);
}
