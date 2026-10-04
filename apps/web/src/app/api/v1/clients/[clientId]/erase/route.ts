import { eraseClient } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** ADMIN only, with double confirmation (the client's full name). Irreversible. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  eraseClient(ctx, params.clientId!, await readJson(req)),
);
