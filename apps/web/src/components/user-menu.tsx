'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The user menu of the trainer's header (docs/UX_FLOW.md §1): everything that is not one of the
 * four main sections. A native disclosure (<details>), closed again after navigating, with Escape
 * or when clicking outside.
 */
export function UserMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        d.open = false;
        d.querySelector('summary')?.focus();
      } else if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener('keydown', close);
    document.addEventListener('click', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('click', close);
    };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-md px-3 text-sm font-medium text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        {label} <span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col rounded-md border border-border bg-bg py-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

export function UserMenuLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-surface ${active ? 'font-semibold text-text' : 'text-text'}`}
    >
      {children}
    </Link>
  );
}
