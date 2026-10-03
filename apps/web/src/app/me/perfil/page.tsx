import { getClient } from '@tp/application';
import Link from 'next/link';
import { requireClientUser } from '@/server/session';
import { ClientProfileForm } from './form';

export default async function ClientProfilePage() {
  const ctx = await requireClientUser();
  const me = await getClient(ctx, ctx.actor.clientId!);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mi perfil</h1>
      <nav aria-label="Más opciones" className="flex gap-3 text-sm">
        <Link href="/me/privacidad" className="text-accent underline">
          Privacidad
        </Link>
        <Link href="/me/ajustes" className="text-accent underline">
          Ajustes y seguridad
        </Link>
      </nav>
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
