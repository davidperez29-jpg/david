import { verifySource } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  verifySource(ctx, params.sourceId!, await readJson(req)),
);
