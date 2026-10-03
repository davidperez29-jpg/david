import { addBlock } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  addBlock(ctx, params.sessionId!, await readJson(req)),
);
