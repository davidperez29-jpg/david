import { getClientReport } from '@tp/application';
import { authedRoute } from '@/server/api';

/** The report rebuilt from its frozen snapshot (with an integrity check of its hash). */
export const GET = authedRoute(async ({ ctx, params }) => getClientReport(ctx, params.id!));
