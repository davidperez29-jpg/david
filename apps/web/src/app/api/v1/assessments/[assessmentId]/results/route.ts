import { recordAssessmentResult } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  recordAssessmentResult(ctx, params.assessmentId!, await readJson(req)),
);
