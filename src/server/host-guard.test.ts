import { describe, expect, it } from 'vitest';
import { hostnameOf, isAllowedRequest, parseAllowedHosts } from './host-guard';

/** B1-11 · Protección local: solo se atienden los `Host` permitidos (también contra DNS rebinding). */
const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});
const allowed = parseAllowedHosts(undefined);

describe('protección del prototipo local', () => {
  it('por defecto solo admite localhost y 127.0.0.1, con cualquier puerto', () => {
    expect(allowed).toEqual(['localhost', '127.0.0.1']);
    expect(isAllowedRequest(headers({ host: '127.0.0.1:3000' }), allowed)).toBe(true);
    expect(isAllowedRequest(headers({ host: 'LOCALHOST:3100' }), allowed)).toBe(true);
  });

  it('rechaza un Host ajeno, vacío o una IP de la red local', () => {
    for (const host of ['evil.example.com', 'evil.example.com:3000', '192.168.1.20:3000', '']) {
      expect(isAllowedRequest(headers({ host }), allowed), host).toBe(false);
    }
    expect(isAllowedRequest(headers({}), allowed)).toBe(false);
    expect(isAllowedRequest(headers({ host: '[::1]:3000' }), allowed)).toBe(false);
    expect(isAllowedRequest(headers({ host: 'localhost.evil.com' }), allowed)).toBe(false);
  });

  it('también comprueba X-Forwarded-Host si llega', () => {
    expect(
      isAllowedRequest(headers({ host: 'localhost', 'x-forwarded-host': 'evil.com' }), allowed),
    ).toBe(false);
    expect(
      isAllowedRequest(
        headers({ host: 'localhost', 'x-forwarded-host': 'localhost:3000' }),
        allowed,
      ),
    ).toBe(true);
  });

  it('se pueden añadir nombres exactos, nunca comodines ni puertos', () => {
    const custom = parseAllowedHosts('localhost,mi-portatil.local');
    expect(isAllowedRequest(headers({ host: 'mi-portatil.local:3000' }), custom)).toBe(true);
    expect(() => parseAllowedHosts('*.local')).toThrow();
    expect(() => parseAllowedHosts('http://localhost')).toThrow();
    expect(hostnameOf('127.0.0.1:99999')).toBeNull();
  });
});
