import { listClientInjuries, openInjury } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  listClientInjuries(ctx, params.clientId!),
);
export const POST = authedRoute(async ({ req, ctx, params }) =>
  openInjury(ctx, params.clientId!, await readJson(req)),
);
