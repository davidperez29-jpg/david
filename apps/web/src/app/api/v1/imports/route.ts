import { createImportJob, listImportJobs } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listImportJobs(ctx));
/** Parses and validates the file; nothing is imported until the job is confirmed. */
export const POST = authedRoute(async ({ req, ctx }) => createImportJob(ctx, await readJson(req)));
