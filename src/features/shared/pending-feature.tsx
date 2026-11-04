import { Construction } from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from '@/ui/badge';

/**
 * Marca de forma visible una funcionalidad que aún no existe. Nunca se presenta como hecha:
 * dice qué incluirá y en qué fase se abordará.
 */
export function PendingFeature({
  title,
  phase,
  children,
  items,
}: {
  title: string;
  phase: string;
  children?: ReactNode;
  items?: string[];
}) {
  return (
    <section className="rounded-3xl border border-dashed border-ink-300/70 bg-cream-50 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Construction aria-hidden className="size-5 text-sun-700" />
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <Badge tone="sun">Pendiente · {phase}</Badge>
      </div>
      {children ? (
        <div className="mt-2 text-sm leading-relaxed text-ink-500">{children}</div>
      ) : null}
      {items?.length ? (
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-ink-700 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-sun-500" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
