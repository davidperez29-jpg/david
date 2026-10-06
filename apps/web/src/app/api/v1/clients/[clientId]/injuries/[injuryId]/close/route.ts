import { closeInjury } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  closeInjury(ctx, params.clientId!, params.injuryId!, await readJson(req)),
);
