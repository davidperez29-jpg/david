import { requestSubstitution } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) =>
  requestSubstitution(ctx, await readJson(req)),
);
