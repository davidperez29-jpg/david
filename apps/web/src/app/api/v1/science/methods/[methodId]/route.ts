import { getMethod, updateMethod } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getMethod(ctx, params.methodId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateMethod(ctx, params.methodId!, await readJson(req)),
);
