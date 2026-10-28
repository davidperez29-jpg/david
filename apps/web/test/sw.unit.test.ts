import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * The service worker (public/sw.js) run with a fake network and cache: what the installed app
 * gets when it opens at "/" or a client page, online and offline (restructure phase 24).
 */
const SOURCE = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/sw.js'),
  'utf8',
);
const ORIGIN = 'https://app.test';

type FetchEvent = { request: FakeRequest; respondWith: (r: Promise<Response>) => void };
type FakeRequest = { method: string; url: string; mode: string };

function worker({ online, cached }: { online: boolean; cached: Record<string, string> }) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map(Object.entries(cached));
  const key = (r: FakeRequest | string) =>
    new URL(typeof r === 'string' ? r : r.url, ORIGIN).pathname;
  const caches = {
    match: async (r: FakeRequest | string) =>
      store.has(key(r)) ? new Response(store.get(key(r)), { status: 200 }) : undefined,
    open: async () => ({
      put: async (r: FakeRequest, res: Response) => store.set(key(r), await res.text()),
      addAll: async () => undefined,
    }),
    keys: async () => [],
    delete: async () => true,
  };
  const network = async (r: FakeRequest) => {
    if (!online) throw new TypeError('Failed to fetch');
    return new Response(`network ${key(r)}`, { status: 200 });
  };
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  };
  vm.runInNewContext(SOURCE, { self, caches, fetch: network, Response, URL, Promise });
  return async (pathname: string, mode = 'navigate') => {
    let response: Promise<Response> | undefined;
    const event: FetchEvent = {
      request: { method: 'GET', url: `${ORIGIN}${pathname}`, mode },
      respondWith: (r) => (response = r),
    };
    handlers.fetch!(event);
    return response ? await response : undefined;
  };
}

describe('service worker', () => {
  it('online, the installed app opens at "/" from the network (each person to their area)', async () => {
    const open = worker({ online: true, cached: {} });
    expect(await (await open('/'))!.text()).toBe('network /');
  });

  it('offline, "/" takes a client to the last copy of «Hoy»', async () => {
    const open = worker({ online: false, cached: { '/me': 'hoy guardado' } });
    const r = (await open('/'))!;
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe(`${ORIGIN}/me`);
    expect(await (await open('/me'))!.text()).toBe('hoy guardado');
  });

  it('offline with nothing saved (staff, or after signing out), a page explains it', async () => {
    const open = worker({ online: false, cached: {} });
    const r = (await open('/'))!;
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('Sin conexión');
  });

  it('serves the app icons from the cache, and leaves staff pages and the API to the network', async () => {
    const open = worker({ online: false, cached: { '/icons/icon-192.png': 'png' } });
    expect(await (await open('/icons/icon-192.png', 'no-cors'))!.text()).toBe('png');
    expect(await open('/app', 'navigate')).toBeUndefined();
    expect(await open('/api/v1/me', 'cors')).toBeUndefined();
  });
});
