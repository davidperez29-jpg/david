import { expect, test } from '@playwright/test';
import { login } from './helpers';
import { TimedTask } from './ux-tasks';

/** Thresholds of the UX review (docs/UX_REVIEW.md). */
const MAX = {
  alert: { interactions: 4, ms: 30_000 },
  calendar: { interactions: 6, ms: 30_000 },
  log: { interactions: 2, ms: 20_000 },
};

test('UX 1 · trainer handles the red pain alert from Hoy', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  const t = new TimedTask(page, 'Resolver la alerta roja de dolor desde Hoy');
  const row = page
    .locator('li')
    .filter({ hasText: /Dolor 7\/10/ })
    .first();
  await expect(row).toBeVisible();
  await t.step(() => row.getByRole('link', { name: /Tomás Garrido/ }).click());
  await expect(page.getByRole('heading', { name: /Carga interna semanal/ })).toBeVisible();
  const alert = page
    .locator('li')
    .filter({ hasText: /Dolor 7\/10/ })
    .first();
  await t.step(() => alert.getByRole('button', { name: 'Resolver…' }).click());
  await t.step(() =>
    alert.getByLabel('Nota de resolución').fill('Derivado a fisioterapia; ejercicio sustituido'),
  );
  await t.step(() => alert.getByRole('button', { name: 'Resolver', exact: true }).click());
  await expect(page.locator('li').filter({ hasText: /Dolor 7\/10/ })).toHaveCount(0);
  const r = t.done();
  expect(r.interactions).toBeLessThanOrEqual(MAX.alert.interactions);
  expect(r.ms).toBeLessThan(MAX.alert.ms);
});

test('UX 2 · trainer finds a client next week in the calendar and opens the session', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  const t = new TimedTask(page, 'Encontrar la sesión de la semana que viene de un cliente');
  await t.step(() =>
    page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Calendario' })
      .click(),
  );
  await expect(page.getByRole('heading', { name: 'Calendario', level: 1 })).toBeVisible();
  await t.step(() => page.getByRole('link', { name: 'Semana', exact: true }).click());
  const thisWeek = page.getByRole('heading', { name: /^Semana del/ });
  await expect(thisWeek).toBeVisible();
  const before = await thisWeek.textContent();
  await t.step(() => page.getByRole('link', { name: 'Siguiente →' }).click());
  await expect(thisWeek).not.toHaveText(before!);
  await t.step(() => page.getByLabel('Cliente').selectOption({ label: 'Villalba, Marcos' }));
  await t.step(() => page.getByRole('button', { name: 'Filtrar' }).click());
  await expect(page).toHaveURL(/cliente=/);
  await expect(page.getByRole('heading', { name: /^Semana del/ })).toBeVisible();
  const session = page.locator('a[href*="/sessions/"]').first();
  await t.step(() => session.click());
  await expect(page.getByRole('heading', { name: 'Cumplimiento' })).toBeVisible();
  const r = t.done();
  expect(r.interactions).toBeLessThanOrEqual(MAX.calendar.interactions);
  expect(r.ms).toBeLessThan(MAX.calendar.ms);
});
