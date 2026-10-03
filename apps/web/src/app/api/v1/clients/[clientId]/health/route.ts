import { addHealthDeclaration, listHealthDeclarations } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  listHealthDeclarations(ctx, params.clientId!),
);
export const POST = authedRoute(async ({ req, ctx, params }) =>
  addHealthDeclaration(ctx, params.clientId!, await readJson(req)),
);
