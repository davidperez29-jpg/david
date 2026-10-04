import { cancelImportJob } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) => cancelImportJob(ctx, params.id!));
