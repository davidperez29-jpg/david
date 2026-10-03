import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer creates, completes and publishes an exercise; videos need verification', async ({
  page,
}) => {
  await login(page, 'pablo.ibarra@example.com');
  await page.getByRole('link', { name: 'Ejercicios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca de ejercicios' })).toBeVisible();

  // imported bank is searchable without accents and marked for review
  await page.getByLabel('Buscar').fill('nordico');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByRole('link', { name: /Curl nórdico/i }).first()).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: /Curl nórdico/i })
      .filter({ hasText: 'Revisar' })
      .first()
      .getByText('Revisar', { exact: true }),
  ).toBeVisible();

  await page.goto('/app/library/new');
  const name = `Sentadilla E2E ${Date.now()}`;
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByLabel('Patrón de movimiento').selectOption({ label: 'Dominante de rodilla' });
  await page.getByLabel('Perfil de prescripción').selectOption({ label: 'Fuerza / hipertrofia' });
  await page.getByRole('checkbox', { name: 'Fuerza', exact: true }).check();
  await page.getByLabel('Nivel').selectOption('beginner');
  await page.getByLabel('Añadir músculo').selectOption({ label: 'Cuádriceps (Tren inferior)' });
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await page.getByLabel('Para el cliente (breve)').fill('Baja controlado y sube con fuerza.');
  await page.getByRole('button', { name: 'Crear borrador' }).click();

  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Vídeo y silueta' }).click();
  await page.getByLabel('URL (YouTube o Vimeo)').fill('https://evil.example/video');
  await page.getByRole('button', { name: 'Añadir vídeo' }).click();
  await expect(page.getByText('URL de vídeo no válida (YouTube o Vimeo).').first()).toBeVisible();
  await page.getByLabel('URL (YouTube o Vimeo)').fill('youtu.be/vzIA5Wd9wTU');
  await page.getByRole('button', { name: 'Añadir vídeo' }).click();
  await expect(page.getByText('Vídeo pendiente de verificación.')).toBeVisible();
  await page.getByRole('button', { name: 'He visto el vídeo: es correcto' }).click();
  await expect(page.getByText('Verificado', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Sustituciones' }).click();
  await expect(page.getByRole('heading', { name: 'Alternativas sugeridas' })).toBeVisible();
});

test('client accounts cannot use the exercise library API', async ({ page }) => {
  await login(page, 'elena.prieto@example.com');
  const res = await page.request.get('/api/v1/exercises');
  expect(res.status()).toBe(403);
});
