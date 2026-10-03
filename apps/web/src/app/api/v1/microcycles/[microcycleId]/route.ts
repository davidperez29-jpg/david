import { updateMicrocycle } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateMicrocycle(ctx, params.microcycleId!, await readJson(req)),
);
