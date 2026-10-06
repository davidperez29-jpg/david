import { reviewInjuryAlert } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  reviewInjuryAlert(
    ctx,
    params.clientId!,
    params.injuryId!,
    params.injuryAlertId!,
    await readJson(req),
  ),
);
