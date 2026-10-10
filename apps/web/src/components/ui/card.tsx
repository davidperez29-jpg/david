import type { ReactNode } from 'react';

export function Card({
  title,
  actions,
  children,
  className = '',
  headingId,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Makes the heading a focus target (tabIndex -1) for `announce(…, headingId)`. */
  headingId?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-bg p-4 ${className}`}>
      {title || actions ? (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2
              id={headingId}
              tabIndex={headingId ? -1 : undefined}
              className="text-base font-semibold"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  children: ReactNode;
}) {
  const t = {
    neutral: 'border-border text-muted',
    ok: 'border-ok text-ok',
    warn: 'border-warn text-warn',
    danger: 'border-danger text-danger',
    accent: 'border-accent text-accent',
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${t}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}
