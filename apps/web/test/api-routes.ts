import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const API_ROOT = path.resolve(__dirname, '../src/app/api/v1');

function routeFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? routeFiles(p) : f === 'route.ts' ? [p] : [];
    });
}

export interface ApiHandler {
  /** Path relative to /api/v1 with Next segments, e.g. `clients/[clientId]/erase`. */
  path: string;
  method: string;
  /** Wrapper used: authedRoute, publicRoute (or something else, which the route test rejects). */
  wrapper: string;
  file: string;
}

/** Every HTTP handler under /api/v1, read from the route files. */
export function apiHandlers(): ApiHandler[] {
  return routeFiles(API_ROOT).flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    const rel = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join('/');
    return [
      ...src.matchAll(
        /export\s+(?:const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s*(=\s*(\w+))?/g,
      ),
    ].map((m) => ({ path: rel, method: m[1]!, wrapper: m[3] ?? 'function', file }));
  });
}
