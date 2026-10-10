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
  // Phase 18: text that is not a number is refused in place (it used to reset the value).
  await card.getByLabel('Incremento (kg)').fill('mucho');
  await card.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByText(/Escribe un número mayor que 0/)).toBeVisible();
  await expect(card.getByLabel('Incremento (kg)')).toHaveAttribute('aria-invalid', 'true');
  await expect(card.getByLabel('Incremento (kg)')).toBeFocused();
  await card.getByLabel('Incremento (kg)').fill('1,25');
  await card.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByText('Del centro', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Volver al de por defecto' }).click();
  await expect(card.getByText('Por defecto', { exact: true })).toBeVisible();
  await expect(card.getByRole('status')).toHaveText(/Vuelve al de por defecto/);
  await expect(card.getByLabel('Incremento (kg)')).toBeFocused();
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

/**
 * Restructure phase 15: Javier's plan now trains Tuesday, Thursday and Saturday (previous test).
 * When his availability changes to Monday, Wednesday and Friday, the engine proposes moving the
 * sessions of the next two weeks inside each week; the trainer accepts and undoes it.
 */
test('a new availability proposes moving sessions to the client’s days; accept and undo', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.locator('main').getByRole('link', { name: 'Ocaña, Javier', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/clients\/[0-9a-f-]{36}/);
  const clientId = new URL(page.url()).pathname.split('/')[3]!;
  const origin = new URL(page.url()).origin;
  const client = (await (await page.request.get(`/api/v1/clients/${clientId}`)).json()) as {
    availability: { weekday: number; startTime: string | null; endTime: string | null }[];
  };
  const put = (slots: unknown[]) =>
    page.request.put(`/api/v1/clients/${clientId}/availability`, {
      headers: { Origin: origin },
      data: { slots },
    });
  expect((await put([{ weekday: 1 }, { weekday: 3 }, { weekday: 5 }])).ok()).toBe(true);

  await page.goto(`/app/clients/${clientId}?tab=programa#ajustes`);
  const card = page.locator('section').filter({ has: page.locator('#ajustes') });
  const item = card
    .locator('li')
    .filter({ hasText: /mover \d+ sesi(ón|ones) a días disponibles/ })
    .first();
  await expect(item).toBeVisible();
  await expect(item.getByText('Días de entrenamiento')).toBeVisible();
  // Not editable: accepted as proposed or moved by hand in the Calendario.
  await expect(item.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await item.getByText(/Qué cambiaría/).click();
  await expect(item.getByText(/(lunes|miércoles|viernes), \d+\/\d+$/).first()).toBeVisible();

  await item.getByRole('button', { name: 'Aceptar', exact: true }).click();
  const decided = card
    .locator('details')
    .filter({ hasText: /Decididos recientemente/ })
    .last();
  await decided.locator('summary').first().click();
  const done = decided
    .locator('li')
    .filter({ hasText: /a días disponibles/ })
    .first();
  await expect(done.getByText('Aceptada')).toBeVisible();
  await done.getByRole('button', { name: 'Deshacer' }).click();
  await expect(done.getByText('Deshecha')).toBeVisible();

  // Back to Javier's own availability (times as HH:MM, as the form sends them).
  const restore = client.availability.map((a) => ({
    weekday: a.weekday,
    startTime: a.startTime?.slice(0, 5) ?? null,
    endTime: a.endTime?.slice(0, 5) ?? null,
  }));
  expect((await put(restore)).ok()).toBe(true);
});
