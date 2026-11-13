import { renameSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expectNoSeriousA11yIssues } from './helpers';
import { enterAs, expect, test } from './fixtures';

/**
 * B3.0 · Errores de la base de datos vistos por la clienta, en el móvil (Pixel 7): sin
 * instrucciones técnicas ni datos internos, y con la API respondiendo errores tipados que la cola
 * puede reintentar sin duplicar nada.
 */
const dbFile = (space: string) => `.data/e2e/espacios/${space}.sqlite`;

test.describe('errores de la base (clienta)', () => {
  test('B3.0 · base inaccesible: mensaje comprensible, sin instrucciones técnicas, y la API responde 503 sin datos', async ({
    page,
    space,
  }) => {
    await enterAs(page, 'Marta, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await expect(page).toHaveURL(/\/entrenar$/);
    const sessionId = new URL(page.url()).pathname.split('/')[3]!;
    renameSync(dbFile(space), `${dbFile(space)}.movida`);

    // La API: error tipado, reintentable más tarde, sin estado ni datos de nadie.
    const response = await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`);
    expect(response.status()).toBe(503);
    expect(response.headers()['retry-after']).toBe('10');
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: 'storage_unavailable' });
    expect(body).not.toHaveProperty('state');
    expect(JSON.stringify(body)).not.toMatch(/\.sqlite|espacios|SQLITE/);

    // La página: qué pasa, sin instrucciones técnicas.
    await page.goto('/cliente');
    const view = page.locator('[data-storage-kind="unavailable"]');
    await expect(view).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'No se puede acceder a los datos' }),
    ).toBeVisible();
    await expect(page.getByText(/Avisa a tu entrenador/)).toBeVisible();
    await expect(
      page.getByText(/pendiente de envío sigue guardado en este dispositivo/),
    ).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/pnpm|\.sqlite|SQLITE|espacios|db:/);
    // Cabe en el móvil.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoSeriousA11yIssues(page);
  });

  test('B3.0 · comando con la base ocupada: 503 reintentable, nada aplicado, y al repetirlo se aplica una sola vez', async ({
    page,
    baseURL,
    space,
  }) => {
    await enterAs(page, 'Marta, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await expect(page).toHaveURL(/\/entrenar$/);
    const sessionId = new URL(page.url()).pathname.split('/')[3]!;
    const url = `/api/cliente/sesiones/${sessionId}/comandos`;
    const start = {
      commandId: `b30-ocupada-${Date.now()}`,
      clientId: 'c-marta',
      type: 'start',
      versionNumber: 1,
      device: {
        recordedAt: new Date().toISOString(),
        timeZone: 'Europe/Madrid',
        utcOffsetMinutes: 60,
      },
    };
    const headers = { origin: baseURL! };
    const state = async () =>
      (await (await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`)).json()) as {
        state: { status: string };
      };

    const db = new Database(dbFile(space));
    db.exec('BEGIN IMMEDIATE');
    try {
      const busy = await page.request.post(url, { data: start, headers });
      expect(busy.status()).toBe(503);
      expect(busy.headers()['retry-after']).toBe('2');
      expect(await busy.json()).toMatchObject({ ok: false, error: 'storage_busy' });
    } finally {
      db.exec('ROLLBACK');
      db.close();
    }
    // Nada se aplicó.
    expect((await state()).state.status).not.toBe('in_progress');
    // El mismo comando (mismo identificador), al repetirlo: una vez; y otra vez, «ya aplicado».
    const applied = await page.request.post(url, { data: start, headers });
    expect(await applied.json()).toMatchObject({ ok: true, result: 'applied' });
    const again = await page.request.post(url, { data: start, headers });
    expect(await again.json()).toMatchObject({ ok: true, result: 'already_applied' });
    expect((await state()).state.status).toBe('in_progress');
  });
});
