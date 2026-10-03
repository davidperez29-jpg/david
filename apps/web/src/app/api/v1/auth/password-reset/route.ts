import { resetPassword } from '@tp/application';
import { publicRoute, readJson } from '@/server/api';

export const POST = publicRoute(async ({ req, ctx }) => {
  await resetPassword(ctx, await readJson(req));
  return { ok: true };
});
