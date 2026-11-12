import { enterAs, expect, test } from './fixtures';

/**
 * Bloque 2 · API de comandos de ejecución vista desde fuera (docs/EXECUTION.md §4): mismo
 * origen, límite de tamaño, cuerpo válido, idempotencia y sesiones ajenas. Los casos de dominio
 * (versiones, series fuera de rango, sesión cerrada…) están en `execution.test.ts`.
 */
test('B2-API · origen, tamaño, forma, idempotencia y sesión ajena', async ({
  page,
  baseURL,
  space,
}) => {
  // Escribe datos: en su propio espacio (el fixture solo se activa si se pide).
  expect(space).toBeTruthy();
  await enterAs(page, 'Marta, clienta');
  await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
  await expect(page).toHaveURL(/\/entrenar$/);
  const sessionId = new URL(page.url()).pathname.split('/')[3]!;
  const url = `/api/cliente/sesiones/${sessionId}/comandos`;
  const origin = { origin: baseURL! };
  const device = {
    recordedAt: new Date().toISOString(),
    timeZone: 'Europe/Madrid',
    utcOffsetMinutes: 60,
  };
  const start = { commandId: `e2e-api-${Date.now()}`, type: 'start', versionNumber: 1, device };

  // Sin cabecera Origin o con un origen ajeno: 403, y no se aplica nada.
  let response = await page.request.post(url, { data: start });
  expect(response.status()).toBe(403);
  response = await page.request.post(url, {
    data: start,
    headers: { origin: 'http://evil.example.com' },
  });
  expect(response.status()).toBe(403);

  // Cuerpo de más de 16 KB: 413.
  response = await page.request.post(url, {
    data: { ...start, padding: 'x'.repeat(17 * 1024) },
    headers: origin,
  });
  expect(response.status()).toBe(413);

  // JSON roto o comando sin la forma esperada: 400 con el motivo.
  response = await page.request.post(url, {
    data: '{"commandId":',
    headers: { ...origin, 'content-type': 'application/json' },
  });
  expect(response.status()).toBe(400);
  response = await page.request.post(url, {
    data: { ...start, commandId: undefined },
    headers: origin,
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ ok: false, error: 'bad_request' });

  // Nada de lo anterior ha empezado la sesión.
  let state = await (await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`)).json();
  expect(state.state.status).not.toBe('in_progress');

  // El mismo comando dos veces: se aplica una vez.
  response = await page.request.post(url, { data: start, headers: origin });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, result: 'applied' });
  response = await page.request.post(url, { data: start, headers: origin });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, result: 'already_applied' });

  // El mismo identificador con otro contenido (válido): 409, no se reinterpreta.
  response = await page.request.post(url, {
    data: {
      ...start,
      device: { ...device, recordedAt: new Date(Date.now() + 1_000).toISOString() },
    },
    headers: origin,
  });
  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ ok: false, error: 'command_id_reused' });

  state = await (await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`)).json();
  expect(state.state.status).toBe('in_progress');

  // Lucía no puede ni leer ni escribir la sesión de Marta: 404, como si no existiera.
  await enterAs(page, 'Lucía, clienta');
  response = await page.request.post(url, {
    data: { ...start, commandId: `e2e-api-lucia-${Date.now()}` },
    headers: origin,
  });
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ ok: false, error: 'not_found' });
  response = await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`);
  expect(response.status()).toBe(404);
});
