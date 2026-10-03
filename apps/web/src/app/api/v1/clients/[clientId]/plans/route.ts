import { createPlan, listClientPlans } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listClientPlans(ctx, params.clientId!));
export const POST = authedRoute(async ({ req, ctx, params }) =>
  createPlan(ctx, params.clientId!, await readJson(req)),
);
