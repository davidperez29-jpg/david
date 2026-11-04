import Link from 'next/link';
import { type ReactNode } from 'react';
import { LogoMark } from '@/features/brand/logo';
import { ClientBottomNav } from '@/features/client/bottom-nav';

export default function ClientTabsLayout({ children }: { children: ReactNode }) {
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
      <main id="contenido" className="px-4 pt-5 pb-28">
        {children}
      </main>
      <ClientBottomNav />
    </>
  );
}
