import { clientSessionReview } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  clientSessionReview(ctx, params.clientId!),
);
