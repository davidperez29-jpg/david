import { createImportJob, listImportJobs } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listImportJobs(ctx));
/** Parses and validates the file; nothing is imported until the job is confirmed. */
// Files up to 2 MB travel as base64 (≈ 2.7 MB of JSON).
export const POST = authedRoute(async ({ req, ctx }) =>
  createImportJob(ctx, await readJson(req, 3 * 1024 * 1024)),
);
