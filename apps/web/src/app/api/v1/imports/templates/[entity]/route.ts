import { downloadImportTemplate } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** ?format=csv|xlsx: columns, an example row and (XLSX) a help sheet. */
export const GET = authedRoute(async ({ req, ctx, params }) =>
  fileResponse(
    await downloadImportTemplate(
      ctx,
      params.entity!,
      req.nextUrl.searchParams.get('format') ?? 'csv',
    ),
  ),
);
