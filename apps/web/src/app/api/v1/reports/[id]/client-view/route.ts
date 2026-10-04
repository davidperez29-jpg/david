import { getClientReportView } from '@tp/application';
import { authedRoute } from '@/server/api';

/** The client's plain-language version of a shared report (the trainer can preview it). */
export const GET = authedRoute(async ({ ctx, params }) => getClientReportView(ctx, params.id!));
