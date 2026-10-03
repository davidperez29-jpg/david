import { setUserActive } from '@tp/application';
import { DomainError } from '@tp/domain';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) => {
  const body = (await readJson(req)) as { active?: unknown };
  if (typeof body?.active !== 'boolean')
    throw new DomainError('validation', 'Campo "active" requerido.');
  await setUserActive(ctx, params.userId!, body.active);
  return { ok: true };
});
