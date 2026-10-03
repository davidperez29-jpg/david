import { recordScreening } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  recordScreening(ctx, params.clientId!, await readJson(req)),
);
