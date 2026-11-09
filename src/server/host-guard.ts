/**
 * Protección del prototipo local (P-87, docs/V1_SPEC.md §7): solo se atienden peticiones cuyo
 * `Host` (y `X-Forwarded-Host`, si llega) sea uno de los permitidos. Así, aunque una página
 * ajena consiga que el navegador resuelva su dominio a 127.0.0.1 (DNS rebinding), el servidor
 * la rechaza.
 *
 * Sin `server-only`: lo usa `src/proxy.ts`, que se ejecuta antes de cada petición.
 */

export const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1'] as const;

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** Lista de `TRAINPRO_ALLOWED_HOSTS` (separada por comas). Falla si algún nombre no es válido. */
export function parseAllowedHosts(value: string | undefined): string[] {
  const hosts = (value?.trim() || DEFAULT_ALLOWED_HOSTS.join(','))
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  for (const host of hosts) {
    if (!HOSTNAME.test(host)) {
      throw new Error(
        `TRAINPRO_ALLOWED_HOSTS: "${host}" no es un nombre de host válido (sin puerto, comodines ni esquema).`,
      );
    }
  }
  return hosts;
}

/** Nombre de host de una cabecera `Host` («127.0.0.1:3000» → «127.0.0.1»), o `null`. */
export function hostnameOf(header: string | null | undefined): string | null {
  const value = header?.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('[')) return null; // IPv6: el servidor solo escucha en 127.0.0.1.
  const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(value);
  if (!match || (match[2] !== undefined && Number(match[2]) > 65_535)) return null;
  return match[1]!;
}

export function isAllowedRequest(
  headers: { get(name: string): string | null },
  allowedHosts: readonly string[],
): boolean {
  const host = hostnameOf(headers.get('host'));
  if (!host || !allowedHosts.includes(host)) return false;
  const forwarded = headers.get('x-forwarded-host');
  if (forwarded === null) return true;
  return forwarded
    .split(',')
    .map((part) => hostnameOf(part))
    .every((name) => name !== null && allowedHosts.includes(name));
}
