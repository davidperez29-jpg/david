import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/logout-button';
import { NavLink } from '@/components/nav-link';
import { monitoringOverview } from '@tp/application';
import { requireStaff } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff();
  const isAdmin = ctx.actor.roles.includes('ADMIN');
  const overview = await monitoringOverview(ctx);
  const urgent = overview.alerts.red + overview.alerts.yellow;
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
          <span className="mr-4 text-sm font-semibold text-accent uppercase">Entrenamiento</span>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Principal">
            <NavLink href="/app" exact>
              Hoy
            </NavLink>
            <NavLink href="/app/clients">Clientes</NavLink>
            <NavLink href="/app/calendar">Calendario</NavLink>
            <NavLink href="/app/alerts">
              Alertas
              {urgent ? (
                <span
                  aria-label={`${urgent} alertas pendientes`}
                  className={`ml-1 rounded-full px-1.5 text-xs text-white ${overview.alerts.red ? 'bg-danger' : 'bg-warn'}`}
                >
                  {urgent}
                </span>
              ) : null}
            </NavLink>
            <NavLink href="/app/library">Ejercicios</NavLink>
            <NavLink href="/app/assessments">Evaluación</NavLink>
            <NavLink href="/app/plans">Planificación</NavLink>
            <NavLink href="/app/science">Ciencia</NavLink>
            {isAdmin ? <NavLink href="/app/admin/users">Usuarios</NavLink> : null}
            <NavLink href="/app/settings">Ajustes</NavLink>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
