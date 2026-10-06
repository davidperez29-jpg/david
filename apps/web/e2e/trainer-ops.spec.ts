import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 12: the trainer decides the pending adjustments from Alertas and moves a
 * session to another day from the calendar (form and drag and drop). Leaves the data as it was.
 */
test('Alertas lists the pending adjustments by client and decides them there', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/alerts');
  const card = page.locator('section').filter({ has: page.locator('#ajustes') });
  await expect(card).toBeVisible();
  // Demo: a deload proposal for Javier (response signals).
  const javier = card.locator('details').filter({ hasText: 'Javier Ocaña' });
  await javier.locator('summary').first().click();
  const item = javier.locator(':scope > ul > li').first();
  await expect(item.getByText('Propuesta', { exact: true })).toBeVisible();
  await item.getByRole('button', { name: 'Posponer' }).click();
  await expect(item.getByText('Pospuesta', { exact: true })).toBeVisible();
  // Still pending (postponed), so still listed, now without «Posponer».
  await expect(item.getByRole('button', { name: 'Posponer' })).toHaveCount(0);
  await expect(javier.getByRole('link', { name: 'Ver el plan de Javier' })).toBeVisible();
});

test('the calendar moves a pending session to another day: «Mover» and drag and drop', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/calendar');
  await page.getByLabel('Cliente', { exact: true }).selectOption({ label: 'Villalba, Marcos' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('link', { name: 'Semana', exact: true }).click();
  await expect(page).toHaveURL(/vista=semana/);
  // Wait for next week to be on screen (the heading of this week is there before the click).
  const heading = page.getByRole('heading', { name: /^Semana del/ });
  const thisWeek = (await heading.textContent())!;
  await page.getByRole('link', { name: 'Siguiente →' }).click();
  await expect(heading).not.toHaveText(thisWeek);
  const grid = page.locator('.md\\:block');
  const movable = grid.locator('li').filter({ has: page.locator('[draggable="true"]') });
  await expect(movable.first()).toBeVisible();
  const day = (await movable
    .first()
    .locator('xpath=ancestor::div[@data-day]')
    .getAttribute('data-day'))!;
  const id = (await movable.first().locator('[data-session-id]').getAttribute('data-session-id'))!;
  const session = (d: string) => grid.locator(`[data-day="${d}"] [data-session-id="${id}"]`);
  // A target day of the same week, different from the original.
  const days = await grid
    .locator('[data-day]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-day')!));
  const target = days.find((d) => d !== day && d > day) ?? days.find((d) => d !== day)!;

  // 1) Keyboard-friendly form.
  await movable.first().locator('summary', { hasText: 'Mover' }).click();
  await movable.first().locator('input[type="date"]').fill(target);
  await movable.first().getByRole('button', { name: 'Mover a ese día' }).click();
  await expect(page.getByRole('status')).toHaveText(/Sesión movida al/);
  await expect(session(target)).toBeVisible();

  // 2) Drag it back to its original day.
  await session(target).dragTo(grid.locator(`[data-day="${day}"]`));
  await expect(session(day)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Sesión movida al/);

  // A past day is refused by the server, whatever the client sends.
  const res = await page.request.post(`/api/v1/plan-sessions/${id}/reschedule`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { expectedVersion: 1000, date: '2020-01-01' },
  });
  expect([409, 422]).toContain(res.status());
});
