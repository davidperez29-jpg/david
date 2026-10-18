import { createUserPasswordLink } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) =>
  createUserPasswordLink(ctx, params.userId!),
);
