import { revokeConsent } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  revokeConsent(ctx, params.clientId!, params.purpose!),
);
