import { expect, test } from '@playwright/test';
import { login } from './helpers';
import { TimedTask } from './ux-tasks';

/** Restructure phase 3: the template library (docs/PLANNING.md §6 ter). */

test('UX 5 · from a client without a plan, a plan from a template in 3 clicks', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Cuesta, Noelia' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo plan' })).toBeVisible();
  const t = new TimedTask(page, 'Crear un plan desde una plantilla');
  await t.step(() => page.getByRole('link', { name: 'Usar plantilla' }).click());
  const item = page.getByRole('listitem').filter({
    has: page.getByRole('link', { name: 'Salud y función · 2 días (full body)', exact: true }),
  });
  await t.step(() => item.getByText('Usar con Noelia Cuesta').click());
  const form = item.getByRole('form', { name: /^Usar «Salud y función · 2 días/ });
  await t.step(() => form.getByLabel('Inicio').fill('2026-11-03'));
  await t.step(() => form.getByRole('button', { name: 'Crear plan' }).click());
  await expect(page.getByText('12 semanas · 2 sesiones/semana', { exact: false })).toBeVisible();
  const r = t.done();
  // Three clicks and typing the start date (docs/UX_FLOW.md §3).
  expect(r.interactions).toBeLessThanOrEqual(4);
  expect(r.ms).toBeLessThan(30_000);
});

test('my templates: duplicate one of the platform, use it, edit it (new version) and restore', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Plantillas', exact: true }).click();
  // Filters: 2 days, level 1.
  const filters = page.getByRole('search', { name: 'Filtrar plantillas' });
  await filters.getByLabel('Días').selectOption('2');
  await filters.getByLabel('Nivel').selectOption('1');
  await filters.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/days=2/);
  const names = await page.locator('main li > div > a').allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /2 días/.test(n))).toBe(true);

  await page
    .getByRole('link', { name: 'Iniciación · 2 días (técnica de patrones)', exact: true })
    .click();
  await page.getByRole('button', { name: 'Duplicar en mis plantillas' }).click();
  await expect(
    page.getByRole('heading', { name: 'Iniciación · 2 días (técnica de patrones) (copia)' }),
  ).toBeVisible();

  // Using it with a client keeps that version as it is.
  const use = page.getByRole('form', { name: /^Usar «Iniciación/ });
  await use.getByLabel('Cliente').selectOption({ label: 'Ferrán, Rosa' });
  await use.getByLabel('Inicio').fill('2026-11-03');
  await use.getByRole('button', { name: 'Crear plan' }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]{36}$/);
  await page.goBack();

  // Editing the template now makes a new version, saved cell by cell like a session.
  const grid = page.getByRole('grid', { name: 'Ejercicios de la sesión' });
  const sets = grid
    .getByRole('row')
    .filter({ has: page.getByRole('checkbox') })
    .first()
    .locator('td')
    .nth(3);
  const before = (await sets.innerText()).trim();
  const other = before === '4' ? '5' : '4';
  await sets.click();
  await page.keyboard.type(other);
  await page.keyboard.press('Enter');
  await expect(page.getByText('versión 2').first()).toBeVisible();
  await page.reload();
  await expect(sets).toHaveText(other);
  const versions = page.getByRole('table', { name: 'Versiones de la plantilla' });
  await expect(versions.getByRole('row', { name: /v2 \(actual\)/ })).toBeVisible();
  await expect(versions.getByRole('row', { name: /v1 .*usada en planes/ })).toBeVisible();

  // Restoring v1 is a new version with v1's content: nothing is lost.
  page.once('dialog', (d) => void d.accept());
  await versions.getByRole('button', { name: 'Restaurar la versión 1' }).click();
  await expect(
    versions.getByRole('row', { name: /v3 \(actual\).*Restaurada la versión 1/ }),
  ).toBeVisible();
  await expect(sets).toHaveText(before);
});

test('platform templates are read-only and clients cannot reach the library API', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Plantillas', exact: true }).click();
  await page.getByRole('link', { name: 'Hipertrofia · 3 días (full body)', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Hipertrofia · 3 días (full body)' }),
  ).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Ejercicios de la sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pegar desde Excel' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archivar' })).toHaveCount(0);
  const id = page.url().split('/').pop()!;
  // Same origin (not a CSRF refusal): the platform's templates themselves are read-only.
  const res = await page.request.patch(`/api/v1/plan-templates/${id}`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { expectedVersion: 1, name: 'Cambiada' },
  });
  expect(res.status()).toBe(403);
  expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
    /duplícala en tus plantillas/,
  );
});
