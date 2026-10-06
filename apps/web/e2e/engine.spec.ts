import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 13 (programming engine): the centre's own load increment per exercise, and a
 * plan proposal applied as a new revision of the active plan. Leaves the increment as it was.
 */
test('the centre sets its own load increment for an exercise and can go back to the default', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/library?q=Sentadilla');
  await page
    .locator('main')
    .getByRole('link', { name: /^Sentadilla/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Progresiones', exact: true }).click();
  const card = page.locator('section').filter({ hasText: 'Incremento de carga' });
  await expect(card.getByText('Por defecto', { exact: true })).toBeVisible();
  await card.getByLabel('Incremento (kg)').fill('1,25');
  await card.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByText('Del centro', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Volver al de por defecto' }).click();
  await expect(card.getByText('Por defecto', { exact: true })).toBeVisible();
});

test('a proposal is applied to the active plan as a new revision', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.locator('main').getByRole('link', { name: 'Ocaña, Javier', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/clients\/[0-9a-f-]{36}/);
  const clientId = new URL(page.url()).pathname.split('/')[3]!;
  // A proposal for next week on, with another template's days (through the API, as the form does).
  const origin = new URL(page.url()).origin;
  const templates = (await (await page.request.get('/api/v1/plan-templates')).json()) as {
    id: string;
    slug: string;
  }[];
  const tpl = templates.find((t) => t.slug === 'hipertrofia-3d')!;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const res = await page.request.post(`/api/v1/clients/${clientId}/plan-proposals`, {
    headers: { Origin: origin },
    data: { templateId: tpl.id, startDate: d.toISOString().slice(0, 10), weekdays: [2, 4, 6] },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };

  await page.goto(`/app/plans/${id}`);
  await page.getByRole('button', { name: 'Aplicar al plan activo (nueva revisión)' }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await page.getByRole('link', { name: 'Gestión y revisiones' }).click();
  await expect(page.getByText(/Propuesta del motor aplicada/).first()).toBeVisible();
});
