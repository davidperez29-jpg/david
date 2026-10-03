import { deleteBlock, updateBlock } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateBlock(ctx, params.blockId!, await readJson(req)),
);
export const DELETE = authedRoute(async ({ ctx, params }) => deleteBlock(ctx, params.blockId!));
