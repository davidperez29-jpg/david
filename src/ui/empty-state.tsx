import { type ReactNode } from 'react';

export function EmptyState({
  illustration,
  title,
  children,
  action,
}: {
  illustration?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-300/60 bg-cream-50 px-6 py-10 text-center">
      {illustration ? (
        <div className="mb-4" aria-hidden>
          {illustration}
        </div>
      ) : null}
      <h2 className="text-xl font-bold text-ink-900">{title}</h2>
      {children ? (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{children}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
