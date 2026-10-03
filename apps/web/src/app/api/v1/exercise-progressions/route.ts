import { addProgression } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) => addProgression(ctx, await readJson(req)));
