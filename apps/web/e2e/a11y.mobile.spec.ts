import { expect, test } from '@playwright/test';
import { a11yIds, scan } from './a11y-helpers';
import { login } from './helpers';

/** WCAG 2.2 AA on every client page on a phone, light and dark. See a11y-helpers.ts. */
test('client pages meet WCAG 2.2 AA on a phone (axe, light and dark)', async ({ page }) => {
  test.setTimeout(300_000);
  const i = await a11yIds();
  const found: string[] = [];
  await login(page, 'marcos.villalba@example.com');
  for (const url of [
    '/me',
    '/me/calendario',
    '/me/progreso',
    '/me/perfil',
    '/me/privacidad',
    '/me/ajustes',
    ...(i.clientSession ? [`/me/sesion/${i.clientSession}`] : []),
  ])
    await scan(page, url, found);
  console.log(found.join('\n') || 'Sin infracciones graves.');
  expect(found).toEqual([]);
});
