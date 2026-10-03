import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer creates a client with goals and records consent + screening', async ({ page }) => {
  await login(page, 'pablo.ibarra@example.com');
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible();
  // referral alert for a demo client with an uncleared declaration
  await expect(
    page.getByText('Requiere valoración por profesional sanitario').first(),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Nuevo cliente' }).click();
  const unique = `E2E${Date.now()}`;
  await page.getByLabel('Nombre', { exact: true }).fill('Lola');
  await page.getByLabel('Apellidos').fill(unique);
  await page.getByLabel('Fecha de nacimiento').fill('1999-02-03');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Experiencia').selectOption('beginner');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Añadir objetivo' }).click();
  await page.getByLabel('Objetivo', { exact: true }).selectOption({ label: 'Salud general' });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Crear cliente' }).click();

  await expect(page.getByRole('heading', { name: `Lola ${unique}` })).toBeVisible();
  await expect(page.getByText('Cliente creado.')).toBeVisible();
  // health data needs explicit consent first
  await expect(page.getByRole('button', { name: 'Registrar declaración' })).toBeDisabled();
  await page.getByRole('button', { name: 'Registrar consentimiento' }).click();
  await expect(page.getByRole('button', { name: 'Registrar declaración' })).toBeEnabled();
  await page.getByLabel('Resultado').selectOption('refer');
  await page
    .locator('section')
    .filter({ hasText: 'Cribado previo a la participación' })
    .getByRole('button', { name: 'Registrar', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Requiere valoración por profesional sanitario.' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Historial de cambios' }).click();
  await expect(page.getByText('Consentimiento otorgado · Consentimiento')).toBeVisible();
});

test('trainer cannot open a client assigned to another trainer', async ({ page }) => {
  await login(page, 'nerea.soto@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await expect(page.getByRole('link', { name: /Arrieta, Iker/ })).toHaveCount(0);
  const res = await page.request.get('/api/v1/clients?q=Arrieta');
  expect((await res.json()).total).toBe(0);
});

test('client account cannot reach the trainer area or other clients', async ({ page }) => {
  await login(page, 'elena.prieto@example.com');
  await expect(page).toHaveURL(/\/me$/);
  await page.goto('/app/clients');
  await expect(page).toHaveURL(/\/me$/);
  const list = await (await page.request.get('/api/v1/clients')).json();
  expect(list.items).toHaveLength(1);
  const users = await page.request.get('/api/v1/users');
  expect(users.status()).toBe(403);
});

test('mutations without a same-origin header are rejected (CSRF)', async ({ request }) => {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: 'lucia.moreno@example.com', password: 'x' },
    headers: { Origin: 'https://evil.example' },
  });
  expect(res.status()).toBe(403);
});

test('unauthenticated API access is rejected', async ({ request }) => {
  const res = await request.get('/api/v1/clients');
  expect(res.status()).toBe(401);
});
