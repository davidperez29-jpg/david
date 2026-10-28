import { expect, test } from '@playwright/test';
import { scanState } from './a11y-helpers';
import { login, offerInstall } from './helpers';

/**
 * The app installs free from the browser, on the phone and on the computer (restructure phase 24,
 * A72): manifest and PNG icons a phone accepts, and «Instalar la app» in Ajustes.
 */
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test('manifest and icons let phones and computers install the app', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
  const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
  for (const [size, purpose] of [
    [192, 'any'],
    [512, 'any'],
    [512, 'maskable'],
  ] as const) {
    const icon = icons.find((i) => i.sizes === `${size}x${size}` && i.purpose === purpose)!;
    expect(icon.type).toBe('image/png');
    const res = await request.get(icon.src);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(pngSize(await res.body())).toEqual([size, size]);
  }
  const apple = await request.get('/apple-touch-icon.png');
  expect(pngSize(await apple.body())).toEqual([180, 180]);

  // The iPhone takes its icon and name from the page itself.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    'content',
    'Entreno',
  );
});

test('a trainer installs the app on the computer from Ajustes', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/settings');
  const card = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'App en el móvil y el ordenador' }),
  });
  await expect(card).toContainText('Abre esta dirección en Chrome o Edge');
  await offerInstall(page);
  await card.getByRole('button', { name: 'Instalar la app' }).click();
  await expect(card).toContainText('Ya la tienes instalada en este dispositivo.');
  expect(
    await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted),
  ).toBe(true);
  const found: string[] = [];
  await scanState(page, 'ajustes, app instalada', found);
  expect(found).toEqual([]);
});
