import { createAssessment, listClientAssessments } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  listClientAssessments(ctx, params.clientId!),
);
export const POST = authedRoute(async ({ req, ctx, params }) =>
  createAssessment(ctx, params.clientId!, await readJson(req)),
);
