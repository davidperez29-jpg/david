import { getDecisionRules, updateDecisionRules } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => getDecisionRules(ctx));
/** ADMIN only: saves a new, audited version of the organization's decision rules. */
export const PUT = authedRoute(async ({ req, ctx }) =>
  updateDecisionRules(ctx, await readJson(req)),
);
