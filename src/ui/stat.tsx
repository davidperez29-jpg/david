import { type ReactNode } from 'react';
import { cn } from './cn';

export function Stat({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border p-5 shadow-soft',
        accent ? 'border-sun-300 bg-sun-400' : 'border-line/70 bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-sm font-semibold', accent ? 'text-ink-900' : 'text-ink-500')}>
          {label}
        </p>
        {icon ? (
          <span
            aria-hidden
            className={cn('[&>svg]:size-5', accent ? 'text-ink-900' : 'text-sun-700')}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">{value}</p>
      {hint ? (
        <p className={cn('mt-1 text-sm', accent ? 'text-ink-700' : 'text-ink-500')}>{hint}</p>
      ) : null}
    </div>
  );
}
