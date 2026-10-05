import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Acceptance (§16.2): log a whole session offline and sync it without duplicates.
 */
test('client logs a session offline and it syncs once, without duplicates', async ({
  page,
  context,
}) => {
  await login(page, 'marcos.villalba@example.com');
  // «Empezar ▶» on a training day, «Ver sesión» otherwise.
  await page.getByRole('link', { name: /^(Empezar|Ver sesión)/ }).click();
  await expect(page).toHaveURL(/\/me\/sesion\//);
  const sessionId = page.url().split('/').pop()!;
  await expect(page.getByRole('status').filter({ hasText: 'Sincronizado' })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión/).first()).toBeVisible();
  const ticks = page.getByRole('button', { name: /^Registrar serie/ });
  for (let i = 0; i < 3; i++) {
    await ticks.nth(i).click();
    // The rest timer appears after each set; it never blocks logging.
  }
  await expect(page.getByText('Pendiente de enviar')).toHaveCount(3);
  await expect(page.getByText(/Sin conexión · \d+ pendientes/)).toBeVisible();

  // "No puedo hacer este ejercicio" works offline as well.
  await page.getByRole('button', { name: 'No puedo hacer este ejercicio' }).last().click();
  await page.getByLabel('Falta de espacio').check();
  await page
    .getByRole('button', { name: /Avisar a mi entrenador\/a y saltar|^Hacer / })
    .first()
    .click();

  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption({ label: 'Cansancio' });
  await page
    .getByRole('button', { name: /^¿Cómo de dura ha sido la sesión\? \(0–10\): 6/ })
    .click();
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión registrada' })).toBeVisible();
  await expect(
    page.getByText('Se enviará en cuanto haya conexión.', { exact: false }),
  ).toBeVisible();

  // Back online: the queue is replayed automatically.
  await context.setOffline(false);
  await expect(page.getByText('Tu entrenador/a ya puede verla.')).toBeVisible({ timeout: 15_000 });

  const res = await page.request.get(`/api/v1/sessions/${sessionId}`);
  expect(res.status()).toBe(200);
  const s = (await res.json()) as {
    attendance: { status: string } | null;
    feedback: { sessionRpe: number | null } | null;
    blocks: { exercises: { logs: { clientMutationId: string; setIndex: number }[] }[] }[];
  };
  const logs = s.blocks.flatMap((b) => b.exercises.flatMap((e) => e.logs));
  expect(logs).toHaveLength(3);
  expect(s.attendance?.status).toBe('partial');
  expect(s.feedback?.sessionRpe).toBe(6);

  // Replaying the same mutations (e.g. a lost response) never duplicates.
  const origin = new URL(page.url()).origin;
  const replay = await page.request.post('/api/v1/sync', {
    headers: { Origin: origin },
    data: {
      mutations: logs.map((l) => ({
        type: 'set',
        clientMutationId: l.clientMutationId,
        sessionId,
        exerciseId: '00000000-0000-0000-0000-000000000000',
        setIndex: l.setIndex,
      })),
    },
  });
  expect(replay.status()).toBe(200);
  const { results } = (await replay.json()) as { results: { status: string }[] };
  expect(results.every((r) => r.status === 'duplicate')).toBe(true);
  const after = (await (
    await page.request.get(`/api/v1/sessions/${sessionId}`)
  ).json()) as typeof s;
  expect(after.blocks.flatMap((b) => b.exercises.flatMap((e) => e.logs))).toHaveLength(3);
});

test('client calendar lists published sessions and staff APIs stay closed', async ({ page }) => {
  await login(page, 'iker.arrieta@example.com');
  await page.getByRole('link', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
  await expect(page.getByText(/Completada|Parcial/).first()).toBeVisible();
  // Their plan as a PDF (published sessions, plain language).
  const dl = page.waitForEvent('download');
  await page
    .getByRole('link', { name: /Descargar «.+» en PDF/ })
    .first()
    .click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^plan-[a-z0-9-]+\.pdf$/);
  expect(file.suggestedFilename()).not.toMatch(/\.equipo\.pdf$/);
  expect((await page.request.get('/api/v1/review-inbox')).status()).toBe(403);
  // Out of scope for a client: refused (403) or not even disclosed (404).
  const pub = await page.request.post('/api/v1/sessions/publish', {
    headers: { Origin: new URL(page.url()).origin },
    data: { scope: 'plan', id: '00000000-0000-0000-0000-000000000000', published: true },
  });
  expect([403, 404]).toContain(pub.status());
});

test('client sees their consistency in plain language', async ({ page }) => {
  await login(page, 'iker.arrieta@example.com');
  await page.getByRole('link', { name: 'Progreso' }).click();
  await expect(
    page.getByText(/Has hecho \d+ de \d+ sesiones en las últimas 4 semanas/),
  ).toBeVisible();
  // Alerts are for the trainer only.
  expect((await page.request.get('/api/v1/alerts')).status()).toBe(403);
});
