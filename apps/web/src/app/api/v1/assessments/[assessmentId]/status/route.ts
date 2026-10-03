import { setAssessmentStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setAssessmentStatus(ctx, params.assessmentId!, await readJson(req)),
);
