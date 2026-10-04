import { regenerateRecoveryCodes } from '@tp/application';
import { recoveryRegenerateSchema } from '@tp/contracts';
import { DomainError } from '@tp/domain';
import { authedRoute, readJson } from '@/server/api';

/** New recovery codes (the old ones stop working); requires a current TOTP code. */
export const POST = authedRoute(async ({ req, ctx }) => {
  const body = recoveryRegenerateSchema.safeParse(await readJson(req));
  if (!body.success) throw new DomainError('validation', 'Código no válido.');
  return regenerateRecoveryCodes(ctx, body.data.code);
});
