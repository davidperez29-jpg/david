import { discardPlanProposal } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  discardPlanProposal(ctx, params.planId!, await readJson(req)),
);
