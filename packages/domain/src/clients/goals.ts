export interface GoalSelection {
  goalId: string;
  isPrimary: boolean;
  /** Relative priority 0–1. */
  priorityWeight: number;
  targetDate?: string | null;
}

export type GoalSelectionProblem =
  | 'no_primary'
  | 'multiple_primary'
  | 'duplicate_goal'
  | 'weight_out_of_range'
  | 'primary_not_highest';

/**
 * A client has exactly one primary goal plus any number of secondary goals (§9 del encargo).
 * The primary goal must carry the highest weight (ties allowed).
 */
export function validateGoalSelection(goals: GoalSelection[]): GoalSelectionProblem[] {
  const problems = new Set<GoalSelectionProblem>();
  const primaries = goals.filter((g) => g.isPrimary);
  if (primaries.length === 0) problems.add('no_primary');
  if (primaries.length > 1) problems.add('multiple_primary');
  const ids = new Set<string>();
  for (const g of goals) {
    if (ids.has(g.goalId)) problems.add('duplicate_goal');
    ids.add(g.goalId);
    if (!(g.priorityWeight >= 0 && g.priorityWeight <= 1)) problems.add('weight_out_of_range');
  }
  const primary = primaries[0];
  if (primary && goals.some((g) => !g.isPrimary && g.priorityWeight > primary.priorityWeight)) {
    problems.add('primary_not_highest');
  }
  return [...problems];
}
