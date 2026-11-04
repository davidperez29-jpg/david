'use client';

import { CalendarDays, Sun, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/ui/cn';

const ITEMS = [
  { href: '/cliente', label: 'Hoy', icon: Sun },
  { href: '/cliente/semana', label: 'Semana', icon: CalendarDays },
  { href: '/cliente/progreso', label: 'Progreso', icon: TrendingUp },
] as const;

export function ClientBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold"
              >
                <span
                  className={cn(
                    'grid h-8 w-14 place-items-center rounded-full transition-colors',
                    active ? 'bg-sun-400 text-ink-900' : 'text-ink-500',
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className={active ? 'text-ink-900' : 'text-ink-500'}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
