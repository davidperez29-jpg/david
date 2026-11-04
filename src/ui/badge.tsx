import { type ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'sun' | 'leaf' | 'sky' | 'coral' | 'plum' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-cream-200 text-ink-700',
  sun: 'bg-sun-200 text-sun-800',
  leaf: 'bg-leaf-100 text-leaf-700',
  sky: 'bg-sky-100 text-sky-700',
  coral: 'bg-coral-100 text-coral-700',
  plum: 'bg-plum-100 text-plum-700',
  outline: 'border border-line bg-white text-ink-700',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="shrink-0 [&>svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
