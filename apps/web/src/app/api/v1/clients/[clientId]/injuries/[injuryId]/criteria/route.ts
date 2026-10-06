import { checkInjuryCriterion } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  checkInjuryCriterion(ctx, params.clientId!, params.injuryId!, await readJson(req)),
);
