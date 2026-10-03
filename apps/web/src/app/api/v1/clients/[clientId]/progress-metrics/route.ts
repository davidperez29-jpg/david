import { setProgressMetrics } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setProgressMetrics(ctx, params.clientId!, await readJson(req)),
);
