'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  children,
  exact = false,
  also = [],
  alsoPattern,
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  /** Other sections that belong to this entry (e.g. «Clientes» covers /app and /app/clients). */
  also?: string[];
  /** Same, as a regular expression (e.g. a client's plans under /app/plans/…). */
  alsoPattern?: string;
}) {
  const path = usePathname();
  const within = (h: string) => path === h || path.startsWith(`${h}/`);
  const active =
    (exact ? path === href : within(href)) ||
    also.some(within) ||
    (!!alsoPattern && new RegExp(alsoPattern).test(path));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-surface text-text' : 'text-muted hover:text-text'}`}
    >
      {children}
    </Link>
  );
}
