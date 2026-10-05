import { resetFormula, saveFormula } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PUT = authedRoute(async ({ req, ctx, params }) =>
  saveFormula(ctx, params.slug!, await readJson(req)),
);
export const DELETE = authedRoute(async ({ ctx, params }) => resetFormula(ctx, params.slug!));
