import { duplicateExercise } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) =>
  duplicateExercise(ctx, params.exerciseId!),
);
