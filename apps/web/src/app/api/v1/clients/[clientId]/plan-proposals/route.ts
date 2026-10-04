import { generatePlanProposal, listPlanProposals } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listPlanProposals(ctx, params.clientId!));
/** Generates a PROPOSAL plan from the latest decision run; the active plan is never touched. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  generatePlanProposal(ctx, params.clientId!, await readJson(req)),
);
