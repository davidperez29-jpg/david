import { createPlanRevision, listPlanRevisions } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listPlanRevisions(ctx, params.planId!));
export const POST = authedRoute(async ({ req, ctx, params }) =>
  createPlanRevision(ctx, params.planId!, await readJson(req)),
);
