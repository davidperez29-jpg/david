import { downloadClientReportView } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** PDF of the client's version (audited as an export). */
export const GET = authedRoute(async ({ ctx, params }) =>
  fileResponse(await downloadClientReportView(ctx, params.id!)),
);
