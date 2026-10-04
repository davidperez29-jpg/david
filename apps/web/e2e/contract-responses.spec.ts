import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { apiHandlers } from '../test/api-routes';
import { breakingDiff, mergeShapes, shapeOf, type Shape } from '../test/contract/shape';
import { apiLogin, fill, loadVictim } from './route-ids';

/**
 * Response contract (Phase 15 pending; §15.1 «sin cambios rompientes sin versión», for responses):
 * every GET route of /api/v1 is called as the demo ADMIN with real ids and its response shape is
 * compared with docs/api/responses.json. A removed field or a changed type fails; new fields are
 * accepted with `CONTRACT_UPDATE=1` (pnpm contract:responses).
 */
const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/api/responses.json',
);
const UPDATE = process.env.CONTRACT_UPDATE === '1';

test('GET responses keep their contract', async ({ baseURL }) => {
  test.setTimeout(300_000);
  const v = await loadVictim();
  const admin = await apiLogin(baseURL!, 'lucia.moreno@example.com');
  const now: Record<string, Shape> = {};
  for (const h of apiHandlers().filter((x) => x.method === 'GET' && x.wrapper === 'authedRoute')) {
    const { url, missing } = fill(h, v);
    if (missing) continue;
    const q =
      h.path === 'calendar'
        ? '?from=2026-09-01&to=2026-10-31'
        : h.path === 'exports'
          ? '?entity=clients&format=csv'
          : '';
    const r = await admin.get(url + q);
    if (r.status() >= 400) continue;
    const type = r.headers()['content-type'] ?? '';
    now[`GET ${h.path}`] = type.includes('application/json')
      ? shapeOf(await r.json())
      : `file:${type.split(';')[0]}`;
  }
  expect(Object.keys(now).length).toBeGreaterThan(60);
  const before: Record<string, Shape> = existsSync(FILE)
    ? JSON.parse(readFileSync(FILE, 'utf8'))
    : {};
  const broken: string[] = [];
  for (const [route, shape] of Object.entries(before)) {
    if (!(route in now)) continue; // route removed or without demo data: the request contract covers it
    breakingDiff(shape, now[route]!, route, broken);
  }
  if (UPDATE) {
    const merged: Record<string, Shape> = { ...before };
    for (const [k, s] of Object.entries(now))
      merged[k] = k in before ? mergeShapes(before[k]!, s) : s;
    writeFileSync(
      FILE,
      JSON.stringify(Object.fromEntries(Object.entries(merged).sort()), null, 2) + '\n',
    );
    return;
  }
  expect(broken, `Cambios rompientes en respuestas de la API v1:\n${broken.join('\n')}`).toEqual(
    [],
  );
});
