import { getPlanTemplate, updateTemplate } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getPlanTemplate(ctx, params.templateId!));
/** Edit an own template (details and/or content); every saved edit is a version. */
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  // A whole yearly template with per-phase sessions can exceed the default 256 KB.
  updateTemplate(ctx, params.templateId!, await readJson(req, 1024 * 1024)),
);
