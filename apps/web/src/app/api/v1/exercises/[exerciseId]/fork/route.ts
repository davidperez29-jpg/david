import { forkExercise } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) => forkExercise(ctx, params.exerciseId!));
