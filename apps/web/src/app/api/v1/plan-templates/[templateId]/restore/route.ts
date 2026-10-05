import { restoreTemplateVersion } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Bring back an earlier version as a new version ({ version, expectedVersion }). */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  restoreTemplateVersion(ctx, params.templateId!, await readJson(req)),
);
