import { type Metadata } from 'next';
import { type ReactNode } from 'react';
import { DemoBanner } from '@/features/shared/demo-banner';
import { getClientContext } from '@/server/context';

export const metadata: Metadata = { title: { default: 'Hoy', template: '%s · TrainPro' } };

/** Experiencia del cliente: una columna pensada para el móvil, también usable en ordenador. */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  const ctx = await getClientContext();
  const me = await ctx.repos.clients.getById(ctx.actor.clientId);
  return (
    <div className="min-h-dvh bg-cream-100">
      <DemoBanner compact viewer={me ? me.displayName.split(' ')[0] : undefined} />
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
