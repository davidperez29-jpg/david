import { getInjury } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  getInjury(ctx, params.clientId!, params.injuryId!),
);
