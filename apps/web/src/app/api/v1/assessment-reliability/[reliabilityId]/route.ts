import { deleteLocalReliability } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  deleteLocalReliability(ctx, params.reliabilityId!),
);
