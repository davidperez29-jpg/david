import { downloadClientReport } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** ?format=pdf|xlsx|csv (audited as an export). */
export const GET = authedRoute(async ({ req, ctx, params }) =>
  fileResponse(
    await downloadClientReport(ctx, params.id!, req.nextUrl.searchParams.get('format') ?? 'pdf'),
  ),
);
