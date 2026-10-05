import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { fromMenu, login } from './helpers';

test('client exercises their rights from the app; ADMIN resolves and erases', async ({
  page,
  browser,
}) => {
  // Data subject: direct download (access/portability) and a request with a one-month due date.
  await login(page, 'elena.prieto@example.com');
  await page.goto('/me/privacidad');
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar mis datos (JSON)' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  const doc = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(doc.formato).toBe('exportacion-interesado/1');
  expect(doc.cliente.firstName).toBe('Elena');
  expect(doc.cliente).not.toHaveProperty('phoneEnc');

  await page.getByLabel('Derecho', { exact: true }).selectOption('objection');
  await page.getByLabel('Detalles (opcional)').fill('No quiero recibir novedades.');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByRole('status')).toHaveText(/Solicitud enviada/);
  const mine = page.getByRole('listitem').filter({ hasText: 'Oposición' });
  await expect(mine.getByText('En curso')).toBeVisible();
  // The download was recorded as an attended portability request.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Portabilidad' }).first().getByText('Atendida'),
  ).toBeVisible();

  // ADMIN inbox: resolve the request with an answer to the data subject.
  const admin = await browser.newPage();
  await login(admin, 'lucia.moreno@example.com');
  await fromMenu(admin, 'Privacidad');
  const item = admin
    .getByRole('listitem')
    .filter({ hasText: 'Oposición' })
    .filter({ hasText: 'Elena Prieto' });
  await item.getByLabel('Respuesta al interesado').fill('Se ha retirado el envío de novedades.');
  await item.getByRole('button', { name: 'Marcar como atendida' }).click();
  await expect(
    admin
      .getByRole('listitem')
      .filter({ hasText: 'Se ha retirado el envío de novedades.' })
      .getByText('Atendida'),
  ).toBeVisible();

  // Erasure with double confirmation on a throwaway client.
  const lastName = `E2E ${Date.now()}`;
  const res = await admin.request.post('/api/v1/clients', {
    headers: { origin: new URL(admin.url()).origin },
    data: {
      basics: { firstName: 'Borrar', lastName, birthDate: '1990-05-01', sex: 'female' },
    },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  await admin.goto(`/app/clients/${id}?tab=privacidad`);
  await admin.getByRole('button', { name: 'Suprimir datos…' }).click();
  const confirm = admin.getByRole('button', { name: 'Suprimir definitivamente' });
  await admin.getByLabel(/Escribe «Borrar E2E/).fill('Otro nombre');
  await expect(confirm).toBeDisabled();
  await admin.getByLabel(/Escribe «Borrar E2E/).fill(`borrar ${lastName.toLowerCase()}`);
  await confirm.click();
  await expect(admin.getByRole('status')).toHaveText('Datos suprimidos.');
  await admin.reload();
  await expect(admin.getByText(/Este cliente está anonimizado/)).toBeVisible();
  await expect(admin.getByRole('heading', { level: 1 })).toContainText('Cliente');
  await admin.close();
});
