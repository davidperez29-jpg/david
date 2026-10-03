import { setClientAvailability } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setClientAvailability(ctx, params.clientId!, await readJson(req)),
);
