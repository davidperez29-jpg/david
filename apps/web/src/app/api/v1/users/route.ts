import { listUsers } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listUsers(ctx));
