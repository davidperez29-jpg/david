import { listSharedReports } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Reports the trainer shared with the client, newest first. */
export const GET = authedRoute(async ({ ctx, params }) => listSharedReports(ctx, params.clientId!));
