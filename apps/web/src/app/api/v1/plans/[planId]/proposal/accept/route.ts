import { acceptPlanProposal } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** The proposal becomes a CLIENT_PLAN draft. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  acceptPlanProposal(ctx, params.planId!, await readJson(req)),
);
