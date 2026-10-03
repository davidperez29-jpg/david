import { decideSubstitution } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  decideSubstitution(ctx, params.substitutionId!, await readJson(req)),
);
