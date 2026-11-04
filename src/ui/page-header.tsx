import { type ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-sm font-semibold tracking-wide text-sun-700 first-letter:uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-base text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
