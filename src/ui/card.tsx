import { type ComponentProps, type ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-3xl border border-line/70 bg-white p-5 shadow-soft sm:p-6', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-cream-200 text-ink-700"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Heading className="text-lg font-bold leading-tight text-ink-900">{title}</Heading>
          {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
