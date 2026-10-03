import { getSource, updateSource } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getSource(ctx, params.sourceId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateSource(ctx, params.sourceId!, await readJson(req)),
);
