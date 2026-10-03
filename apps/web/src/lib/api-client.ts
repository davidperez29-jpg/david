'use client';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]> | null;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Same-origin JSON fetch. The browser sends the Origin header used for CSRF checks. */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
    const json = (await res.json().catch(() => ({}))) as { error?: ApiError };
    if (!res.ok)
      return { ok: false, error: json.error ?? { code: 'internal', message: 'Error inesperado.' } };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: { code: 'network', message: 'Sin conexión. Inténtalo de nuevo.' } };
  }
}
