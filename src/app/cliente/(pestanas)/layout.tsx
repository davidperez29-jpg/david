import Link from 'next/link';
import { type ReactNode } from 'react';
import { LogoMark } from '@/features/brand/logo';
import { ClientBottomNav } from '@/features/client/bottom-nav';
import { PendingSync } from '@/features/client/pending-sync';
import { getClientContext } from '@/server/context';

export default async function ClientTabsLayout({ children }: { children: ReactNode }) {
  // La identidad de quien tiene abierta la app: la cola local se separa por persona (A-08).
  const { actor } = await getClientContext();
  return (
    <>
      <header className="flex items-center justify-between px-4 pt-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-lg font-extrabold text-ink-900">
            Train<span className="text-sun-700">Pro</span>
          </span>
          <span className="sr-only"> (ir al inicio)</span>
        </Link>
      </header>
      <main id="contenido" className="px-4 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <PendingSync clientId={actor.clientId} />
        {children}
      </main>
      <ClientBottomNav />
    </>
  );
}
