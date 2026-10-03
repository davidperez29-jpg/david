import { setPlanStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setPlanStatus(ctx, params.planId!, await readJson(req)),
);
