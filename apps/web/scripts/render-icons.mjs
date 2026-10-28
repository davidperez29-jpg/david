/**
 * Renders the app icons from public/icon.svg (restructure phase 24). The iPhone home screen and
 * Android installation need PNG icons; run this after changing the icon:
 *   node apps/web/scripts/render-icons.mjs   (PW_CHROMIUM=<path> to use a preinstalled Chromium)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const icon = readFileSync(path.join(pub, 'icon.svg'), 'utf8');
// Full-bleed square for the maskable and Apple icons: the phone applies its own rounded mask, and
// transparent corners would turn black on an iPhone. The symbol already fits the safe zone.
const square = icon.replace(
  '<rect width="512" height="512" rx="96"',
  '<rect width="512" height="512"',
);
if (square === icon) throw new Error('icon.svg changed: update the background rect replacement');

const outputs = [
  ['icons/icon-192.png', icon, 192],
  ['icons/icon-512.png', icon, 512],
  ['icons/maskable-512.png', square, 512],
  ['apple-touch-icon.png', square, 180],
];
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
for (const [file, svg, size] of outputs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: path.join(pub, file), omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`Icons rendered in ${pub}`);
