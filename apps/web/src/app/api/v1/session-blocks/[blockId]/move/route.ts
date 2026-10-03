import { moveBlock } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  moveBlock(ctx, params.blockId!, await readJson(req)),
);
