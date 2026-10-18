// Plain JavaScript: also used by scripts/startup-gate.mjs, which runs without a TypeScript
// compiler on the wake-up path of a sleeping instance (restructure phase 22).

/**
 * The connection string as a managed host gives it, made usable by this driver (restructure
 * phase 22, free hosting on Neon):
 * - `channel_binding` is a libpq option: postgres.js would send it to the server as a setting,
 *   and the server refuses the connection (`unrecognized configuration parameter`). SCRAM, which
 *   it protects, still applies.
 * - Neon's pooled host (`ep-…-pooler.…neon.tech`) is turned into the direct one (the same name
 *   without `-pooler`): migrations and start-up steps hold one session, which a transaction
 *   pooler does not keep.
 */
export function normalizeDatabaseUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.searchParams.delete('channel_binding');
  if (u.hostname.endsWith('.neon.tech')) u.hostname = u.hostname.replace(/-pooler(?=\.)/, '');
  return u.toString();
}
