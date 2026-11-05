'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type Route } from 'next';
import { cn } from '@/ui/cn';

const TABS = [
  ['', 'Información'],
  ['/objetivos', 'Objetivos'],
  ['/evaluaciones', 'Evaluaciones'],
  ['/resultados', 'Resultados'],
  ['/planificacion', 'Planificación'],
  ['/sesiones', 'Sesiones'],
  ['/registro', 'Registro'],
  ['/informes', 'Informes'],
  ['/salud', 'Salud'],
  ['/compartido', 'Compartido'],
] as const;

/** Pestañas horizontales de la ficha. Cada pestaña es una ruta: se puede enlazar y recargar. */
export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/entrenador/clientes/${clientId}`;
  return (
    <nav aria-label="Pestañas de la ficha" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map(([suffix, label]) => {
          const href = `${base}${suffix}`;
          const active = suffix === '' ? pathname === base : pathname.startsWith(href);
          return (
            <li key={suffix}>
              <Link
                href={href as Route}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px block rounded-t-2xl border-b-[3px] px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? 'border-sun-500 bg-white text-ink-900'
                    : 'border-transparent text-ink-500 hover:bg-cream-50 hover:text-ink-900',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
