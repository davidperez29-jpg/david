import { duplicateWeek } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  duplicateWeek(ctx, params.microcycleId!, await readJson(req)),
);
