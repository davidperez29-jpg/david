import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Route coverage (MASTER_SPECIFICATION §14.3): every HTTP handler under /api/v1 must be built with
 * `authedRoute` (session + use-case authorization) or `publicRoute`, and public routes are an
 * explicit allow-list. A new route that skips the wrappers fails CI.
 */
const ROOT = path.resolve(__dirname, '../src/app/api/v1');
const PUBLIC = new Set([
  'auth/login POST',
  'auth/logout POST',
  'auth/2fa/verify POST',
  'auth/password-reset/request POST',
  'auth/password-reset POST',
  'invitations/accept POST',
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? routeFiles(p) : f === 'route.ts' ? [p] : [];
  });
}

describe('API route coverage', () => {
  const files = routeFiles(ROOT);
  const handlers = files.flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, path.dirname(file)).split(path.sep).join('/');
    const exports = [
      ...src.matchAll(
        /export\s+(?:const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s*(=\s*(\w+))?/g,
      ),
    ];
    return exports.map((m) => ({ key: `${rel} ${m[1]}`, wrapper: m[3] ?? 'function' }));
  });

  it('finds the API routes', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(handlers)('$key uses an approved wrapper', ({ key, wrapper }) => {
    expect(['authedRoute', 'publicRoute']).toContain(wrapper);
    if (wrapper === 'publicRoute') expect(PUBLIC.has(key)).toBe(true);
  });

  it('every allow-listed public route exists', () => {
    const keys = new Set(handlers.map((h) => h.key));
    for (const p of PUBLIC) expect(keys.has(p)).toBe(true);
  });
});
