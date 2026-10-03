import { addFinding } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  addFinding(ctx, params.sourceId!, await readJson(req)),
);
