/**
 * Review of the exercise bank (restructure phase 19): what each exercise still lacks, and the rules
 * for editing many at once. The imported bank arrives as drafts; a person completes and checks
 * each one before it can be published (§14 del encargo, A68).
 */
import {
  MUSCLE_FAMILIES,
  publishProblems,
  type PublishFacts,
  type PublishProblem,
} from './publish';

/** What an exercise lacks: the publish requirements plus its videos (which never block it). */
export type ReviewGap = PublishProblem | 'pending_video' | 'broken_video';

export const REVIEW_GAPS: readonly ReviewGap[] = [
  'pending_review',
  'missing_pattern',
  'missing_category',
  'missing_primary_muscle',
  'missing_level',
  'missing_client_description',
  'missing_prescription_profile',
  'pending_video',
  'broken_video',
];

export interface ReviewFacts extends PublishFacts {
  pendingVideos: number;
  brokenVideos: number;
}

export function reviewGaps(f: ReviewFacts): ReviewGap[] {
  const gaps: ReviewGap[] = publishProblems(f);
  if (f.pendingVideos > 0) gaps.push('pending_video');
  if (f.brokenVideos > 0) gaps.push('broken_video');
  return REVIEW_GAPS.filter((g) => gaps.includes(g));
}

/** Pattern families whose exercises need a primary muscle (shared with the SQL of the queue). */
export const MUSCLE_REQUIRED_FAMILIES: readonly string[] = [...MUSCLE_FAMILIES];

/**
 * Changes that can be applied to many exercises at once. Texts (the explanation for the client,
 * instructions) are never written in bulk: they are specific to each exercise (A67).
 */
export type BulkEdit =
  | { kind: 'set_pattern'; patternId: string }
  | { kind: 'add_category'; categoryId: string }
  | { kind: 'set_level'; level: 'beginner' | 'intermediate' | 'advanced' }
  | { kind: 'set_profile'; profileId: string }
  | { kind: 'add_primary_muscle'; muscleId: string }
  | { kind: 'mark_reviewed' }
  | { kind: 'publish' }
  | { kind: 'archive' };

export type BulkSkip = 'global' | 'archived' | 'changed' | 'not_ready';

export interface BulkTarget {
  isGlobal: boolean;
  status: string;
  version: number;
  /** Version the person saw in the list: anything newer was changed by someone meanwhile. */
  expectedVersion: number | undefined;
  /** Publish problems after the other changes of the same exercise (for `publish`). */
  publishProblems: readonly PublishProblem[];
}

/**
 * Why an exercise of the selection is left as it is, or null when the change applies. A skipped
 * exercise never stops the others: the person sees the list and the reasons.
 */
export function bulkSkipReason(t: BulkTarget, edit: BulkEdit): BulkSkip | null {
  if (t.isGlobal) return 'global';
  if (t.status === 'archived') return 'archived';
  if (t.expectedVersion !== undefined && t.expectedVersion !== t.version) return 'changed';
  if (edit.kind === 'publish' && t.publishProblems.length) return 'not_ready';
  return null;
}
