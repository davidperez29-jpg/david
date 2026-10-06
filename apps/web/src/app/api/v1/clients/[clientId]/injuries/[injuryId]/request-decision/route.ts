import { requestInjuryDecision } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) =>
  requestInjuryDecision(ctx, params.clientId!, params.injuryId!),
);
