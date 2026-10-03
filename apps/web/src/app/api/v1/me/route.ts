import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => ({ actor: ctx.actor }));
