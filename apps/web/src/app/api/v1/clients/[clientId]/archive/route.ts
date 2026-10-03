import { setClientArchived } from '@tp/application';
import { DomainError } from '@tp/domain';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) => {
  const body = (await readJson(req)) as { archived?: unknown; reason?: unknown };
  if (typeof body?.archived !== 'boolean')
    throw new DomainError('validation', 'Campo "archived" requerido.');
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;
  await setClientArchived(ctx, params.clientId!, body.archived, reason);
  return { ok: true };
});
