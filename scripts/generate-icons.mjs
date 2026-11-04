/**
 * Genera los iconos PNG de la PWA a partir del símbolo de TrainPro (public/icons/icon.svg).
 * Uso: pnpm icons  (requiere el Chromium de Playwright: pnpm exec playwright install chromium)
 * Los PNG resultantes se versionan en el repositorio; solo hay que regenerarlos si cambia el logo.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = await readFile(`${root}public/icons/icon.svg`, 'utf8');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** `maskable`: el símbolo ocupa el 70 % central sobre fondo amarillo (zona segura de Android). */
const variants = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, maskable } of variants) {
  const body = maskable
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" fill="#FFD23F"/><g transform="translate(4.8 4.8) scale(0.7)">${inner.replace('rx="10"', 'rx="0"')}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${inner}</svg>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${body}</body></html>`,
  );
  await page
    .locator('svg')
    .screenshot({ path: `${root}public/icons/${file}`, omitBackground: true });
  console.log(`public/icons/${file}`);
}
await browser.close();
