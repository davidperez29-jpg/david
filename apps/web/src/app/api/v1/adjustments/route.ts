import { listPendingAdjustments } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Pending adjustments of every client the trainer follows (Alertas page, restructure phase 12). */
export const GET = authedRoute(async ({ ctx }) => listPendingAdjustments(ctx));
