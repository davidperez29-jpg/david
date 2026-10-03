import { setTraitFlag } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** The trainer's judgement of a trait when no applicable reference exists (null clears it). */
export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setTraitFlag(ctx, params.clientId!, await readJson(req)),
);
