import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { Logo } from '@/features/brand/logo';
import { DemoBanner } from '@/features/shared/demo-banner';
import { Avatar } from '@/ui/avatar';
import { TrainerMobileNav, TrainerNavList } from './nav';

export function TrainerShell({
  trainerName,
  initials,
  children,
}: {
  trainerName: string;
  initials: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <DemoBanner compact viewer={`${trainerName.split(' ')[0]}, entrenador`} />
      <div className="lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-line bg-cream-50 lg:block">
          <div className="sticky top-0 flex h-dvh flex-col px-4 py-6">
            <Link href="/" className="px-2">
              <Logo subtitle="Área del entrenador" />
              <span className="sr-only"> (ir al inicio)</span>
            </Link>
            <nav aria-label="Secciones" className="mt-8 flex-1 overflow-y-auto">
              <TrainerNavList />
            </nav>
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Link
                href="/cliente"
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-ink-500 hover:bg-cream-200 hover:text-ink-900"
              >
                <Smartphone aria-hidden className="size-4" />
                Ver la app del cliente
              </Link>
              <div className="flex items-center gap-3 px-2">
                <Avatar initials={initials} seed="trainer" size="sm" />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-bold text-ink-900">{trainerName}</p>
                  <p className="text-ink-500">Entrenador · demo</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="relative flex items-center justify-between border-b border-line bg-cream-50 px-4 py-3 lg:hidden">
            <Link href="/">
              <Logo />
              <span className="sr-only"> (ir al inicio)</span>
            </Link>
            <TrainerMobileNav />
          </header>
          <main id="contenido" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
