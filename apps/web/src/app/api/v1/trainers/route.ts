import { listTrainers } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listTrainers(ctx));
