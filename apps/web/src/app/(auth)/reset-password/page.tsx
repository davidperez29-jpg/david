import { describePasswordLink } from '@tp/application';
import { baseContext } from '@/server/context';
import { ResetForm } from './reset-form';

export const dynamic = 'force-dynamic';

/** Opened from a new-password link, usually shared by the trainer (restructure phase 23). */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const account = token ? await describePasswordLink(baseContext(), token) : null;
  if (!account || !token) {
    return (
      <>
        <h1 className="mb-2 text-xl font-semibold">Enlace no válido</h1>
        <p className="text-sm text-muted">
          El enlace ha caducado o ya se ha usado. Pide uno nuevo a tu entrenador.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crea tu nueva contraseña</h1>
      <p className="mb-4 text-sm text-muted">{account.email}</p>
      <ResetForm token={token} />
    </>
  );
}
