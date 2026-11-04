import { type ReactNode } from 'react';
import { cn } from './cn';

/** Aviso contextual: información, privacidad o funcionalidad pendiente. */
export function Notice({
  icon,
  title,
  children,
  tone = 'cream',
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  tone?: 'cream' | 'sun' | 'sky' | 'plum';
  className?: string;
}) {
  const tones = {
    cream: 'border-line bg-cream-50 text-ink-700',
    sun: 'border-sun-300 bg-sun-100 text-ink-700',
    sky: 'border-sky-100 bg-sky-100/60 text-sky-700',
    plum: 'border-plum-100 bg-plum-100/60 text-plum-700',
  };
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm', tones[tone], className)}>
      {icon ? (
        <span aria-hidden className="mt-0.5 shrink-0 [&>svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        {title ? <p className="font-bold text-ink-900">{title}</p> : null}
        <div className={cn(title ? 'mt-0.5' : undefined, 'leading-relaxed')}>{children}</div>
      </div>
    </div>
  );
}
