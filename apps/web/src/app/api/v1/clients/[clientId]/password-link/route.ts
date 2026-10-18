import { createClientPasswordLink } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) =>
  createClientPasswordLink(ctx, params.clientId!),
);
