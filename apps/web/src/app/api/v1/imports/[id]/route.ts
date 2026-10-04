import { getImportJob } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getImportJob(ctx, params.id!));
