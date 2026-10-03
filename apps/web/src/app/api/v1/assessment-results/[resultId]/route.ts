import { deleteAssessmentResult } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  deleteAssessmentResult(ctx, params.resultId!),
);
