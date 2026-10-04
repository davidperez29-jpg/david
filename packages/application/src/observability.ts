/**
 * Observability (MASTER_SPECIFICATION §5: "logs estructurados sin datos de salud"; error reporting
 * with scrubbing). One JSON line per event on stdout, so any collector (Loki, CloudWatch, Datadog,
 * an OpenTelemetry agent…) can ingest it without a vendor SDK in the app.
 *
 * - Never logs request or response bodies.
 * - Field names that may carry personal or health data are redacted.
 * - Free text (error messages) is scrubbed: e-mails, phone-like numbers, tokens and DOIs/ids stay
 *   out of the logs.
 * - Optional error sink: ERROR_WEBHOOK_URL receives the same scrubbed JSON (e.g. an EU-hosted
 *   collector or a Sentry relay). Fire-and-forget, never blocks a request.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Keys whose values are never written (case-insensitive substring match). */
const SENSITIVE =
  /pass(word)?|token|secret|cookie|authorization|email|phone|name|birth|address|health|pain|description|comment|notes?|reason|details|body|payload|raw|content|answer|text/i;

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const LONG_DIGITS = /\+?\d[\d\s-]{7,}\d/g;
const TOKENISH = /\b[A-Za-z0-9_-]{32,}\b/g;

/** Removes personal data from free text (error messages from the database included). */
export function scrubText(s: string): string {
  return s
    .replace(EMAIL, '[email]')
    .replace(TOKENISH, '[token]')
    .replace(LONG_DIGITS, '[número]')
    .slice(0, 500);
}

/** Copies a record dropping sensitive keys (recursively, max depth 3). */
export function redact(v: unknown, depth = 0): unknown {
  if (v == null || typeof v !== 'object') return typeof v === 'string' ? scrubText(v) : v;
  if (depth > 3) return '[…]';
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>))
    out[k] = SENSITIVE.test(k) ? '[redactado]' : redact(x, depth + 1);
  return out;
}

export interface LogSink {
  write(line: string): void;
}
let sink: LogSink = { write: (l) => process.stdout.write(l + '\n') };
/** Tests capture the output; production writes to stdout. */
export function setLogSink(s: LogSink): void {
  sink = s;
}

const threshold = () => ORDER[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? ORDER.info;

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < threshold()) return;
  sink.write(
    JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as object) }),
  );
}

/** Replaces ids in a path so routes aggregate (`/api/v1/clients/:id/plans`). */
export function routePattern(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n');
}

/**
 * Unexpected errors: logged (scrubbed, with the error class and the top stack frames inside our
 * code) and, if configured, forwarded to ERROR_WEBHOOK_URL.
 */
export function reportError(e: unknown, context: Record<string, unknown> = {}): void {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = (err as { cause?: { message?: string; code?: string } }).cause;
  const record = {
    error: err.name,
    message: scrubText(err.message),
    pgCode: cause?.code,
    stack: (err.stack ?? '')
      .split('\n')
      .slice(1)
      .filter((l) => /packages\/|apps\//.test(l) && !l.includes('node_modules'))
      .slice(0, 5)
      .map((l) => scrubText(l.trim())),
    ...context,
  };
  log('error', 'unexpected_error', record);
  const url = process.env.ERROR_WEBHOOK_URL;
  if (url)
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts: new Date().toISOString(), ...(redact(record) as object) }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => undefined);
}
