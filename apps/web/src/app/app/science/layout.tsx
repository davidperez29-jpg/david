import type { ReactNode } from 'react';
import { NavLink } from '@/components/nav-link';
import { ScienceDisclaimer } from '@/components/science/evidence';

export default function ScienceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Biblioteca científica</h1>
        <ScienceDisclaimer />
        <nav
          className="flex flex-wrap gap-1 border-b border-border pb-1"
          aria-label="Biblioteca científica"
        >
          <NavLink href="/app/science" exact>
            Métodos
          </NavLink>
          <NavLink href="/app/science/claims">Afirmaciones</NavLink>
          <NavLink href="/app/science/sources">Fuentes</NavLink>
          <NavLink href="/app/science/busquedas">Búsquedas</NavLink>
          <NavLink href="/app/science/qa">Control de calidad</NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
