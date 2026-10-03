import { removeExerciseMedia } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  removeExerciseMedia(ctx, params.exerciseId!, params.mediaId!),
);
