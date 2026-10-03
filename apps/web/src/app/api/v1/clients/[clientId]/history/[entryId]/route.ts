import { deleteHistoryEntry } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  deleteHistoryEntry(ctx, params.clientId!, params.entryId!),
);
