import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A server component that imports a value (not a component) from a 'use client' module gets a
 * client reference, not the value: `Object.entries` of a label map gives nothing and the page
 * shows raw slugs. It happened with the template library filters (empty «Tipo» and «Población»).
 * Constants used on the server live in plain modules (src/lib).
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
const isClient = (code: string) => /^\s*['"]use client['"]/.test(code);
const resolveImport = (from: string, spec: string): string | null => {
  const base = spec.startsWith('@/')
    ? join(SRC, spec.slice(2))
    : spec.startsWith('.')
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts'])
    if (existsSync(base + ext)) return normalize(base + ext);
  return null;
};

describe('server / client boundary', () => {
  it('server code imports only components (PascalCase) or types from client modules', () => {
    const all = files(SRC);
    const code = new Map(all.map((f) => [f, readFileSync(f, 'utf8')]));
    const bad: string[] = [];
    const seen = new Set<string>();
    // From the server entry points (pages, layouts, route handlers) through plain modules; a
    // client module is the boundary: what it imports runs in the browser.
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = code.get(file) ?? '';
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
        const target = resolveImport(file, m[3]!);
        if (!target) continue;
        if (!isClient(code.get(target) ?? '')) {
          visit(target);
          continue;
        }
        if (m[1]) continue;
        const values = m[2]!
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n && !n.startsWith('type '))
          .map((n) => n.split(/\s+as\s+/)[0]!);
        for (const n of values)
          if (!/^[A-Z][a-z0-9]/.test(n))
            bad.push(`${relative(SRC, file)} → ${n} (${relative(SRC, target)})`);
      }
    };
    for (const f of all) if (f.startsWith(join(SRC, 'app')) && !isClient(code.get(f)!)) visit(f);
    expect(seen.size).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});
