import { duplicateSession } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  duplicateSession(ctx, params.sessionId!, await readJson(req)),
);
