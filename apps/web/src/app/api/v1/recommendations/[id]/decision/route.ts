import { decideRecommendation } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Accept / accept with changes / reject / postpone a proposal; changes are audited overrides. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  decideRecommendation(ctx, params.id!, await readJson(req)),
);
