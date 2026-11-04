import { expect, test } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues } from './helpers';

test('la portada ofrece las dos experiencias y es accesible', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Entrena con criterio');
  await expect(page.getByRole('link', { name: /Soy entrenador/ })).toHaveAttribute(
    'href',
    '/entrenador',
  );
  await expect(page.getByRole('link', { name: /Soy cliente/ })).toHaveAttribute('href', '/cliente');
  await expectNoSeriousA11yIssues(page);
  expect(errors).toEqual([]);
});

test('las respuestas incluyen las cabeceras de seguridad', async ({ request }) => {
  const response = await request.get('/entrenador');
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('el manifiesto permite instalar la PWA', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'TrainPro',
    display: 'standalone',
    start_url: '/',
    lang: 'es',
  });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
});

test('el service worker no se cachea y la página sin conexión existe', async ({ request }) => {
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toBe('no-cache, no-store, must-revalidate');
  expect(await sw.text()).toContain("OFFLINE_URL = '/offline.html'");
  expect((await request.get('/offline.html')).ok()).toBe(true);
});

test('sin conexión, la navegación muestra la página offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // la página pasa a estar controlada por el service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/entrenador').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  await context.setOffline(false);
});
