import { advanceInjuryPhase } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  advanceInjuryPhase(ctx, params.clientId!, params.injuryId!, await readJson(req)),
);
