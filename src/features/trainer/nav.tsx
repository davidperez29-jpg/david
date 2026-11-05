'use client';

import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type Route } from 'next';
import { useEffect, useState } from 'react';
import { cn } from '@/ui/cn';

export const TRAINER_NAV = [
  { href: '/entrenador', label: 'Panel', icon: LayoutDashboard },
  { href: '/entrenador/clientes', label: 'Clientes', icon: Users },
  { href: '/entrenador/evaluaciones', label: 'Evaluaciones', icon: ClipboardCheck },
  { href: '/entrenador/analisis', label: 'Análisis de resultados', icon: TrendingUp },
  { href: '/entrenador/planificacion', label: 'Planificación', icon: CalendarDays },
  { href: '/entrenador/ejercicios', label: 'Biblioteca de ejercicios', icon: Dumbbell },
  { href: '/entrenador/carga', label: 'Carga y volumen', icon: ChartColumn },
  { href: '/entrenador/readaptacion', label: 'Readaptación', icon: HeartPulse },
  { href: '/entrenador/informes', label: 'Informes', icon: FileText },
  { href: '/entrenador/configuracion', label: 'Configuración', icon: Settings },
] as const satisfies readonly { href: Route; label: string; icon: unknown }[];

function isActive(pathname: string, href: string) {
  return href === '/entrenador'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function TrainerNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {TRAINER_NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors',
                active
                  ? 'bg-sun-400 text-ink-900 shadow-soft'
                  : 'text-ink-700 hover:bg-cream-200 hover:text-ink-900',
              )}
            >
              <Icon
                aria-hidden
                className={cn('size-5', active ? 'text-ink-900' : 'text-ink-500')}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Menú desplegable para pantallas estrechas. */
export function TrainerMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="menu-entrenador"
        className="grid size-11 place-items-center rounded-2xl border border-line bg-white text-ink-900"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        <span className="sr-only">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
      </button>
      {open ? (
        <nav
          id="menu-entrenador"
          aria-label="Secciones"
          key={pathname}
          className="absolute inset-x-0 top-full z-40 border-b border-line bg-cream-50 px-4 pt-2 pb-5 shadow-lift"
        >
          <TrainerNavList onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </div>
  );
}
