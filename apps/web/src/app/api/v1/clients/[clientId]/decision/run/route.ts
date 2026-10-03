import { runDecision } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Runs the decision engine (deterministic) and stores a new set of proposals. */
export const POST = authedRoute(async ({ ctx, params }) => runDecision(ctx, params.clientId!));
