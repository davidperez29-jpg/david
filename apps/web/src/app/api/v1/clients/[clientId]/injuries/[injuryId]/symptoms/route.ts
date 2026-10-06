import { recordInjurySymptom } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  recordInjurySymptom(ctx, params.clientId!, params.injuryId!, await readJson(req)),
);
