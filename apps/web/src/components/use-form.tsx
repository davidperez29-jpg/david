'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
