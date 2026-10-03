import { setMethodStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setMethodStatus(ctx, params.methodId!, await readJson(req)),
);
