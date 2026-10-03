import { getPlan, updatePlan } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getPlan(ctx, params.planId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updatePlan(ctx, params.planId!, await readJson(req)),
);
