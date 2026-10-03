import { setClientRuleOverride } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setClientRuleOverride(ctx, params.clientId!, await readJson(req)),
);
