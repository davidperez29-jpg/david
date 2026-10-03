import type { ReactNode } from 'react';
import { NavLink } from '@/components/nav-link';
import { requireClientUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Mobile-first client shell (§9): bottom tab bar, large touch targets. */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  await requireClientUser();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-bg">
      <main className="flex-1 px-4 pt-6 pb-24">{children}</main>
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 border-t border-border bg-bg">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 p-2 text-center [&>a]:flex [&>a]:min-h-12 [&>a]:items-center [&>a]:justify-center">
          <NavLink href="/me" exact>
            Hoy
          </NavLink>
          <NavLink href="/me/perfil">Perfil</NavLink>
          <NavLink href="/me/privacidad">Privacidad</NavLink>
          <NavLink href="/me/ajustes">Ajustes</NavLink>
        </div>
      </nav>
    </div>
  );
}
