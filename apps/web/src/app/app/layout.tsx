import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/logout-button';
import { Announcer } from '@/components/ui/announcer';
import { NavLink } from '@/components/nav-link';
import { UserMenu, UserMenuLink } from '@/components/user-menu';
import { monitoringOverview } from '@tp/application';
import { requireStaff } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * Trainer shell (docs/UX_FLOW.md §1): four sections — Clientes, Plantillas, Ejercicios, Tests — and
 * a user menu with everything else. Urgent alerts stay visible as a counter next to the menu.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff();
  const isAdmin = ctx.actor.roles.includes('ADMIN');
  const overview = await monitoringOverview(ctx);
  const urgent = overview.alerts.red + overview.alerts.yellow;
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <Link href="/app" className="mr-2 text-sm font-semibold text-accent uppercase">
            Entrenamiento
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Principal">
            <NavLink
              href="/app"
              exact
              also={['/app/clients', '/app/groups']}
              alsoPattern="^/app/plans/(?!templates)"
            >
              Clientes
            </NavLink>
            <NavLink href="/app/plans" exact also={['/app/plans/templates']}>
              Plantillas
            </NavLink>
            <NavLink href="/app/library">Ejercicios</NavLink>
            <NavLink href="/app/assessments">Tests</NavLink>
          </nav>
          <form action="/app/clients" role="search" className="hidden md:block">
            <input
              name="q"
              type="search"
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className="h-10 w-48 rounded-md border border-border bg-bg px-3 text-sm"
            />
          </form>
          {urgent ? (
            <Link
              href="/app/alerts"
              aria-label={`${urgent} alertas pendientes`}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold text-bg ${overview.alerts.red ? 'bg-danger' : 'bg-warn'}`}
            >
              <span aria-hidden="true">⚠ {urgent}</span>
            </Link>
          ) : null}
          <UserMenu label="Menú">
            <UserMenuLink href="/app/calendar">Calendario</UserMenuLink>
            <UserMenuLink href="/app/alerts">
              Alertas
              {urgent ? <span className="text-xs text-muted">{urgent} pendientes</span> : null}
            </UserMenuLink>
            <UserMenuLink href="/app/informes">Informes</UserMenuLink>
            <UserMenuLink href="/app/science">Ciencia</UserMenuLink>
            <hr className="my-1 border-border" />
            <UserMenuLink href="/app/settings">Ajustes</UserMenuLink>
            {isAdmin ? <UserMenuLink href="/app/admin/users">Usuarios</UserMenuLink> : null}
            {isAdmin ? <UserMenuLink href="/app/admin/privacidad">Privacidad</UserMenuLink> : null}
            <hr className="my-1 border-border" />
            <LogoutButton className="px-4 py-2 text-left text-text hover:bg-surface" />
          </UserMenu>
        </div>
      </header>
      <Announcer />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
