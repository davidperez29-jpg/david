import { confirmImportJob } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Imports the valid rows through the regular use cases; returns imported and failed rows. */
export const POST = authedRoute(async ({ ctx, params }) => confirmImportJob(ctx, params.id!));
