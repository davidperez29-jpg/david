import { getPrivacySettings, updatePrivacySettings } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => getPrivacySettings(ctx));
/** ADMIN: retention period (months after archiving) and mandatory 2FA for ADMIN. */
export const PUT = authedRoute(async ({ req, ctx }) =>
  updatePrivacySettings(ctx, await readJson(req)),
);
