import { downloadPlanPdf } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** ?version=staff|client. The whole plan as a PDF (audited as an export). */
export const GET = authedRoute(async ({ req, ctx, params }) =>
  fileResponse(await downloadPlanPdf(ctx, params.planId!, req.nextUrl.searchParams.get('version'))),
);
