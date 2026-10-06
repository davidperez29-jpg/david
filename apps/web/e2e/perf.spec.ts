import { request as pwRequest, expect, test, type APIRequestContext } from '@playwright/test';
import { apiHandlers } from '../test/api-routes';
import { PASSWORD } from './helpers';

/**
 * Performance (MASTER_SPECIFICATION §2.3): "Entrenador: listados < 300 ms p95 con 1 000 clientes".
 * Needs the load data of `pnpm db:seed:perf` (Centro Escala: 10 trainers, 1 000 clients); skipped
 * otherwise. Every API listing (GET without path parameters) and the main list pages, measured
 * against the production build, as the ADMIN (1 000 clients) and as a trainer (100 clients).
 */
const RUNS = Number(process.env.PERF_RUNS ?? 20);
const LIMIT_MS = 300;
const PAGES = [
  '/app',
  '/app/clients',
  '/app/alerts',
  '/app/calendar',
  '/app/plans',
  '/app/informes',
  // Restructure phase 10: pages added since phase 14.
  '/app/groups',
  '/app/library',
  '/app/assessments',
  '/app/science/sources',
  '/app/science/busquedas',
];
// Listings that need query parameters to be meaningful (calendar: the 6 weeks of a month view).
const monday = new Date();
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const QUERY: Record<string, string> = {
  calendar: `?from=${iso(monday)}&to=${iso(new Date(monday.getTime() + 41 * 86_400_000))}&perDay=4`,
};
// Not listings: own session data, and `exports` (a file generated on demand, not a page of results).
const SKIP = new Set(['auth/sessions', 'me', 'exports']);

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]!;

async function login(baseURL: string, email: string): Promise<APIRequestContext | null> {
  const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const r = await ctx.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  return r.ok() ? ctx : null;
}

async function time(
  ctx: APIRequestContext,
  url: string,
): Promise<{ ms: number[]; status: number }> {
  let status = 0;
  for (let i = 0; i < 2; i++) status = (await ctx.get(url)).status(); // warm-up
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    const r = await ctx.get(url);
    await r.body();
    ms.push(performance.now() - t);
    status = r.status();
  }
  return { ms, status };
}

test('listings answer in < 300 ms p95 with 1 000 clients', async ({ baseURL }) => {
  test.setTimeout(900_000);
  const admin = await login(baseURL!, 'escala.admin@example.com');
  test.skip(!admin, 'Sin datos de carga: ejecuta pnpm db:seed:perf');
  const trainer = (await login(baseURL!, 'escala.entrenador01@example.com'))!;
  const listings = [
    ...new Set(
      apiHandlers()
        .filter((h) => h.method === 'GET' && !h.path.includes('[') && !SKIP.has(h.path))
        .filter((h) => !h.path.startsWith('auth/'))
        .map((h) => `/api/v1/${h.path}${QUERY[h.path] ?? ''}`),
    ),
  ];
  const rows: string[] = [];
  const slow: string[] = [];
  for (const [who, ctx] of [
    ['ADMIN (1 000 clientes)', admin!],
    ['entrenador (100 clientes)', trainer],
  ] as const) {
    for (const url of [...listings, ...PAGES]) {
      const { ms, status } = await time(ctx, url);
      if (status >= 400) continue; // needs parameters or permission: not a listing for this role
      const v = Math.round(p95(ms));
      rows.push(`${who.padEnd(26)} ${url.padEnd(48)} p95 ${String(v).padStart(4)} ms`);
      if (v >= LIMIT_MS) slow.push(`${who} ${url}: p95 ${v} ms`);
    }
  }
  console.log(rows.join('\n'));
  expect(slow).toEqual([]);
});
