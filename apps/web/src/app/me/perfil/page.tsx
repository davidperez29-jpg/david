import { getClient } from '@tp/application';
import { requireClientUser } from '@/server/session';
import { ClientProfileForm } from './form';

export default async function ClientProfilePage() {
  const ctx = await requireClientUser();
  const me = await getClient(ctx, ctx.actor.clientId!);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mi perfil</h1>
      <ClientProfileForm
        client={{
          id: me.id,
          version: me.version,
          email: me.email ?? '',
          phone: me.phone ?? '',
          preferences: me.preferences ?? '',
          availability: me.availability,
        }}
      />
    </div>
  );
}
