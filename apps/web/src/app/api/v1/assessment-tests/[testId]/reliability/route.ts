import { addLocalReliability } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  addLocalReliability(ctx, params.testId!, await readJson(req)),
);
