'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { api, type ApiError } from '@/lib/api-client';

/** Small helper: submit JSON to the API, expose field errors, refresh server data on success. */
export function useApiAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);

  async function run<T>(
    path: string,
    method: string,
    body?: unknown,
    opts: { refresh?: boolean } = {},
  ) {
    setPending(true);
    setError(null);
    setDone(false);
    const r = await api<T>(path, { method, body });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    setDone(true);
    if (opts.refresh !== false) router.refresh();
    return r.data;
  }

  const fieldError = (name: string) => error?.details?.[name];
  return { run, pending, error, done, fieldError, setError };
}

export function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
      {error.message}
    </p>
  );
}

/**
 * Field errors of a long form, listed with links to where each one is (phase 18). It takes the
 * focus when it appears, so keyboard and screen-reader users learn what failed and can jump there.
 */
export function ErrorSummary({
  error,
  link,
}: {
  error: ApiError | null;
  link: (field: string) => { href: string; label: string } | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const entries = Object.entries(error?.details ?? {});
  useEffect(() => {
    if (error?.details && Object.keys(error.details).length) box.current?.focus();
  }, [error]);
  if (!entries.length) return null;
  return (
    <div
      ref={box}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className="rounded-md border border-danger px-3 py-2 text-sm"
    >
      <p id={titleId} className="font-medium text-danger">
        {entries.length === 1 ? 'Revisa este campo:' : `Revisa estos ${entries.length} campos:`}
      </p>
      <ul className="list-inside list-disc">
        {entries.map(([field, msgs]) => {
          const l = link(field);
          return (
            <li key={field}>
              {l ? (
                <a href={l.href} className="underline">
                  {l.label}
                </a>
              ) : (
                field
              )}
              : {msgs.join(' ')}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
