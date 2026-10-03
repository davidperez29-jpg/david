import { addHistoryEntry } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  addHistoryEntry(ctx, params.clientId!, await readJson(req)),
);
