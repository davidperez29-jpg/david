import { transferClients } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) => transferClients(ctx, await readJson(req)));
