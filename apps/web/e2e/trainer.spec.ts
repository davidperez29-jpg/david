import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer creates a client in one form and records consent + screening', async ({ page }) => {
  await login(page, 'pablo.ibarra@example.com');
  await expect(page.getByRole('heading', { name: 'Mis clientes', exact: true })).toBeVisible();
  // The main navigation has four entries.
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link')).toHaveText([
    'Clientes',
    'Plantillas',
    'Ejercicios',
    'Tests',
  ]);
  // referral need shown in the client's row
  await expect(
    page.getByText('Requiere valoración por profesional sanitario').first(),
  ).toBeVisible();

  await page.getByRole('link', { name: '+ Nuevo cliente' }).click();
  const unique = `E2E${Date.now()}`;
  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  await page.getByLabel('Nombre *').fill('Lola');
  await page.getByLabel('Apellidos *').fill(unique);
  await expect(save).toBeDisabled(); // the main profile is required
  await page.getByLabel('Fecha de nacimiento').fill('1999-02-03');
  await page.getByLabel('Perfil principal *').selectOption({ label: 'Salud' });
  // the profile proposes its goal; the experience proposes the level
  await expect(page.getByLabel('Objetivo')).toHaveValue(/.+/);
  await expect(page.locator('#goalId option:checked')).toHaveText('Salud general');
  await page.getByLabel('Experiencia').selectOption('intermediate');
  await expect(page.getByLabel('Nivel')).toHaveValue('2');
  await page.getByLabel('Días por semana').fill('2');
  await page.getByRole('button', { name: 'Casa básica' }).click();
  await expect(page.getByRole('button', { name: 'Quitar Mancuernas' })).toBeVisible();
  await save.click();

  await expect(page.getByRole('heading', { name: `Lola ${unique}` })).toBeVisible();
  await expect(
    page.getByText('Salud · Nivel 2 · 2 días/semana · Objetivo: Salud general'),
  ).toBeVisible();
  await expect(page.getByText('Cliente creado.')).toBeVisible();
  // health data needs explicit consent first
  await expect(page.getByRole('button', { name: 'Registrar declaración' })).toBeDisabled();
  // The Salud section asks for the health-data consent in place (Consentimientos lists all).
  await page.locator('#salud').getByRole('button', { name: 'Registrar consentimiento' }).click();
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

test('the user menu holds everything else', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  const menu = page.locator('details', { has: page.locator('summary', { hasText: 'Menú' }) });
  await menu.locator('summary').click();
  for (const name of [
    'Calendario',
    'Alertas',
    'Informes',
    'Ciencia',
    'Ajustes',
    'Usuarios',
    'Privacidad',
    'Cerrar sesión',
  ])
    await expect(
      menu.getByRole(name === 'Cerrar sesión' ? 'button' : 'link', { name }),
    ).toBeVisible();
  await menu.getByRole('link', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { name: 'Calendario', level: 1 })).toBeVisible();
  // the menu closes after navigating
  await expect(menu.getByRole('link', { name: 'Ciencia' })).toBeHidden();
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
