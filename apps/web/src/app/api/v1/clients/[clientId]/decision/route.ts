import { getDecision } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Latest decision-engine run for the client, with its recommendations and their status. */
export const GET = authedRoute(async ({ ctx, params }) => getDecision(ctx, params.clientId!));
