import { createExercise, listExercises } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listExercises(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx }) => createExercise(ctx, await readJson(req)));
