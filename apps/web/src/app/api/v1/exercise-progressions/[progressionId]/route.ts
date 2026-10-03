import { removeProgression } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  removeProgression(ctx, params.progressionId!),
);
