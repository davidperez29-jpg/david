/**
 * Minimum data before an exercise can be published to clients (§14 del encargo).
 * Drafts can be incomplete; published exercises must be usable and explainable.
 */
export interface PublishFacts {
  name: string;
  movementPatternId: string | null;
  /** Family of the movement pattern (lower, upper, trunk, conditioning, locomotion…). */
  patternFamily: string | null;
  categoryCount: number;
  primaryMuscleCount: number;
  level: string | null;
  clientDescription: string | null;
  prescriptionProfileId: string | null;
  needsReview: boolean;
}

export type PublishProblem =
  | 'missing_pattern'
  | 'missing_category'
  | 'missing_primary_muscle'
  | 'missing_level'
  | 'missing_client_description'
  | 'missing_prescription_profile'
  | 'pending_review';

/** Pattern families where target muscles are meaningful and required. */
const MUSCLE_FAMILIES = new Set(['lower', 'upper', 'trunk', 'full_body', 'accessory']);

export function publishProblems(f: PublishFacts): PublishProblem[] {
  const p: PublishProblem[] = [];
  if (!f.movementPatternId) p.push('missing_pattern');
  if (f.categoryCount === 0) p.push('missing_category');
  if (f.primaryMuscleCount === 0 && f.patternFamily && MUSCLE_FAMILIES.has(f.patternFamily))
    p.push('missing_primary_muscle');
  if (!f.level) p.push('missing_level');
  if (!f.clientDescription?.trim()) p.push('missing_client_description');
  if (!f.prescriptionProfileId) p.push('missing_prescription_profile');
  if (f.needsReview) p.push('pending_review');
  return p;
}
