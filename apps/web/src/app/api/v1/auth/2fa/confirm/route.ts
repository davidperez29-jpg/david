import { confirmTotpEnrollment } from '@tp/application';
import { totpCodeSchema } from '@tp/contracts';
import { DomainError } from '@tp/domain';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) => {
  const body = totpCodeSchema.safeParse(await readJson(req));
  if (!body.success) throw new DomainError('validation', 'Código no válido.');
  // The recovery codes are shown once; only their hashes are stored.
  return confirmTotpEnrollment(ctx, body.data.code);
});
