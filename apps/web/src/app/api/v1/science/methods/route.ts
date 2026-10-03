import { createMethod, listMethods } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listMethods(ctx));
export const POST = authedRoute(async ({ req, ctx }) => createMethod(ctx, await readJson(req)));
