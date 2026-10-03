import { getPlayerSession } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Player data: published sessions only for the client; full detail for staff (room mode). */
export const GET = authedRoute(async ({ ctx, params }) => getPlayerSession(ctx, params.sessionId!));
