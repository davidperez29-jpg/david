import { getAssessmentTest, updateAssessmentTest } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getAssessmentTest(ctx, params.testId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateAssessmentTest(ctx, params.testId!, await readJson(req)),
);
