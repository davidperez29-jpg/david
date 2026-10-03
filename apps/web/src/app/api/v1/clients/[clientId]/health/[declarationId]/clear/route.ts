import { clearHealthDeclaration } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  clearHealthDeclaration(ctx, params.clientId!, params.declarationId!, await readJson(req)),
);
