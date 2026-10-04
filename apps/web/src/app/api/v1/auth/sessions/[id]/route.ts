import { revokeMySession } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Closes one of the user's own sessions (another device). */
export const DELETE = authedRoute(async ({ ctx, params }) => revokeMySession(ctx, params.id!));
