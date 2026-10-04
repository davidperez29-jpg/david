import { expect, test } from '@playwright/test';
import { PASSWORD } from './helpers';

/**
 * Mobile performance (MASTER_SPECIFICATION §2.3: "TTI móvil < 2,5 s en 4G").
 *
 * Pixel 7 emulation, cold cache, with the throttling profile Lighthouse uses for mobile (150 ms
 * RTT, 1.6 Mbps down, 750 kbps up, CPU slowed 4×), which is stricter than an average 4G link.
 * TTI is approximated as Lighthouse does: the end of the last long task (≥ 50 ms) before a quiet
 * window, and never before DOMContentLoaded.
 */
const LIMIT_MS = 2500;
const PAGES = ['/login', '/me', '/me/calendario', '/me/progreso'];

test('client pages are interactive in < 2.5 s on a throttled phone', async ({ browser }) => {
  test.setTimeout(300_000);
  const rows: string[] = [];
  const slow: string[] = [];
  for (const url of PAGES) {
    // Fresh context per page: nothing cached.
    const context = await browser.newContext({ ...test.info().project.use });
    if (url !== '/login') {
      const r = await context.request.post('/api/v1/auth/login', {
        headers: { origin: new URL(test.info().project.use.baseURL!).origin },
        data: { email: 'marcos.villalba@example.com', password: PASSWORD },
      });
      expect(r.ok()).toBe(true);
    }
    const page = await context.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __longTasks: { start: number; end: number }[] };
      w.__longTasks = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          w.__longTasks.push({ start: e.startTime, end: e.startTime + e.duration });
      }).observe({ type: 'longtask', buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(3000); // quiet window
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const tasks = (window as unknown as { __longTasks: { end: number }[] }).__longTasks;
      const lastTask = tasks.reduce((a, t) => Math.max(a, t.end), 0);
      return {
        fcp,
        dcl: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
        tti: Math.max(nav.domContentLoadedEventEnd, fcp, lastTask),
        bytes: performance
          .getEntriesByType('resource')
          .reduce((a, r) => a + ((r as PerformanceResourceTiming).transferSize || 0), 0),
      };
    });
    const ms = (x: number) => `${Math.round(x)}`.padStart(5);
    rows.push(
      `${url.padEnd(16)} FCP ${ms(m.fcp)} ms · DCL ${ms(m.dcl)} ms · load ${ms(m.load)} ms · TTI ≈ ${ms(m.tti)} ms · ${Math.round(m.bytes / 1024)} KB`,
    );
    if (m.tti >= LIMIT_MS) slow.push(`${url}: TTI ≈ ${Math.round(m.tti)} ms`);
    await context.close();
  }
  console.log(rows.join('\n'));
  expect(slow).toEqual([]);
});
