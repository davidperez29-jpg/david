import { removeExerciseTolerance } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  removeExerciseTolerance(ctx, params.clientId!, params.toleranceId!),
);
