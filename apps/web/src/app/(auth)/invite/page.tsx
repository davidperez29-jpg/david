import { describeInvitation } from '@tp/application';
import { baseContext } from '@/server/context';
import { label } from '@/lib/labels';
import { AcceptInvitationForm } from './accept-form';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const inv = token ? await describeInvitation(baseContext(), token) : null;
  if (!inv || !token) {
    return (
      <>
        <h1 className="mb-2 text-xl font-semibold">Invitación no válida</h1>
        <p className="text-sm text-muted">
          El enlace ha caducado o ya se ha utilizado. Pide una nueva invitación.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crea tu cuenta</h1>
      <p className="mb-4 text-sm text-muted">
        {inv.email} · {label('role', inv.role)}
      </p>
      <AcceptInvitationForm token={token} />
    </>
  );
}
