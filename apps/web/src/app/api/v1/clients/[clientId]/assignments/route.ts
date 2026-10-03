import { assignTrainer } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  assignTrainer(ctx, params.clientId!, await readJson(req)),
);
