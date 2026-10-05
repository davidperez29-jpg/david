import { archiveTemplate } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Archive ({ archived: true }) or recover ({ archived: false }) an own template. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  archiveTemplate(ctx, params.templateId!, await readJson(req)),
);
