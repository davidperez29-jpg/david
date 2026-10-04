import { verifySecondFactor } from '@tp/application';
import { secondFactorCodeSchema } from '@tp/contracts';
import { DomainError } from '@tp/domain';
import { publicRoute, readJson } from '@/server/api';
import { SESSION_COOKIE } from '@/server/session';

export const POST = publicRoute(async ({ req, ctx }) => {
  const body = secondFactorCodeSchema.safeParse(await readJson(req));
  if (!body.success) throw new DomainError('validation', 'Código no válido.');
  await verifySecondFactor(ctx, req.cookies.get(SESSION_COOKIE)?.value ?? '', body.data.code);
  return { ok: true };
});
