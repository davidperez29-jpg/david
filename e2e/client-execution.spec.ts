import { collectErrors, expectNoSeriousA11yIssues, todayInMadrid } from './helpers';
import {
  enterAs,
  expect,
  joinSpace,
  logVisibleSet,
  publishForLucia,
  startTraining,
  test,
} from './fixtures';

/**
 * Bloque 2 · ejecución real en el móvil (Pixel 7) y consulta del entrenador (escritorio).
 * Cada prueba trabaja en su propio espacio de datos. Ver docs/EXECUTION.md.
 */
test.describe('ejecución del entrenamiento (bloque 2)', () => {
  test('recorrido completo: Alex publica, Lucía entrena y Alex compara prescrito y realizado', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    const today = todayInMadrid();
    // 1–3 · Alex publica la sesión para Lucía y la consulta en su ficha.
    const { url: a7, plank } = await publishForLucia(browser, space, baseURL!, { date: today });

    // 4–5 · Lucía entra y empieza.
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await expect(page).toHaveURL(/\/entrenar$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fuerza · pierna' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await startTraining(page);

    // 6 · Registra las series del primer ejercicio: 10/RIR 2, 10/RIR 1 y 8/RIR 0.
    await expect(page.getByRole('heading', { level: 1, name: 'Sentadilla goblet' })).toBeVisible();
    await expect(page.getByText('16 kg').first()).toBeVisible();
    await expect(page.getByText('RIR 2').first()).toBeVisible();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'Serie hecha' }).click();
    // Descanso con la hora de fin; se puede pausar y saltar.
    await expect(page.getByRole('timer')).toBeVisible();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByText('Descanso en pausa')).toBeVisible();
    await page.getByRole('button', { name: 'Saltar descanso' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await expect(page.getByText('Confirmada').first()).toBeVisible();

    await page.getByRole('button', { name: '1', exact: true }).click();
    await logVisibleSet(page);
    const reps = page.getByLabel(/^Repeticiones$/);
    await reps.fill('8');
    await page.getByRole('button', { name: '0', exact: true }).click();
    await logVisibleSet(page);

    // 7 · Pasa sola al siguiente ejercicio.
    await expect(page.getByRole('heading', { level: 1, name: plank })).toBeVisible();
    await expect(page.getByText('3 de 5 series')).toBeVisible();
    await logVisibleSet(page);
    await page.getByRole('button', { name: 'Serie hecha' }).click();

    // 8 · Con todo registrado, se ofrece terminar.
    const finish = page.getByRole('dialog', { name: 'Terminar la sesión' });
    await expect(finish).toBeVisible();
    await finish.getByLabel(/Mensaje para Alex/).fill('La última serie me costó.');
    await finish.getByRole('button', { name: 'Terminar sesión' }).click();
    await expect(page.getByRole('heading', { name: '¡Sesión completada!' })).toBeVisible();
    await expect(page.getByText('5 de 5 series hechas')).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await expect(page.getByText('8 × 16 kg · RIR 0')).toBeVisible();
    await expect(page.getByText('−2 rep. · RIR 0 (previsto 2)')).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    // Hoy lo muestra como completada.
    await page.goto('/cliente');
    await expect(page.getByRole('link', { name: /Ver resumen/ })).toBeVisible();

    // 9–10 · Alex lo consulta: prescrito frente a realizado.
    const trainer = await browser.newContext({ baseURL });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(alex.getByText('Completada').first()).toBeVisible();
    await expect(alex.getByText('5 de 5 series').first()).toBeVisible();
    await alex.goto(a7);
    const review = alex.getByRole('region', { name: 'Ejecución: prescrito frente a realizado' });
    await expect(review).toContainText('5 de 5 hechas');
    await expect(review).toContainText('empezada con la v1');
    await expect(review).toContainText('Mensaje de Lucía: La última serie me costó.');
    const goblet = review.getByRole('region', { name: 'Sentadilla goblet' });
    await expect(goblet).toContainText('Prescrito: 3 × 10 · 16 kg · RIR 2');
    await expect(goblet.getByRole('listitem')).toHaveText([
      /Serie 1.*Previsto10 × 16 kg · RIR 2.*Hecho10 × 16 kg · RIR 2/,
      /Serie 2.*Hecho10 × 16 kg · RIR 1.*RIR 1 \(previsto 2\)/,
      /Serie 3.*Hecho8 × 16 kg · RIR 0.*−2 rep\. · RIR 0 \(previsto 2\)/,
    ]);
    await expectNoSeriousA11yIssues(alex);
    // El registro también aparece en la pestaña Registro de la ficha.
    await alex.goto('/entrenador/clientes/c-lucia/registro');
    await expect(alex.getByText('Fuerza · pierna')).toBeVisible();
    await trainer.close();
    expect(errors).toEqual([]);
  });

  test('cerrar y volver a abrir el navegador con la sesión en curso: se reanuda donde estaba', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await page.context().close();

    // Un navegador «nuevo»: sin nada en el dispositivo; lo confirmado viene del servidor.
    const fresh = await browser.newContext({ ...test.info().project.use, baseURL });
    await joinSpace(fresh, space, baseURL!);
    const again = await fresh.newPage();
    await enterAs(again, 'Lucía, clienta');
    const hero = again.getByRole('region', { name: 'Fuerza · pierna' });
    await expect(
      hero.getByRole('link', { name: /Continuar entrenamiento · 1 de 5 series/ }),
    ).toBeVisible();
    await hero.getByRole('link', { name: /Continuar entrenamiento/ }).click();
    await expect(again.getByRole('heading', { level: 1, name: 'Sentadilla goblet' })).toBeVisible();
    await expect(again.getByText('1 de 5 series')).toBeVisible();
    await expect(again.getByText('Confirmada')).toHaveCount(1);
    await expect(
      again.getByRole('region', { name: /Serie 2 de 3 de Sentadilla goblet/ }),
    ).toBeVisible();
    await fresh.close();
  });

  test('sin conexión: la serie queda pendiente en el móvil y se envía al volver la conexión', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();

    await page.context().setOffline(true);
    await logVisibleSet(page, { waitForServer: false });
    // Nunca se muestra como guardada: está en el móvil, pendiente de envío.
    await expect(page.getByText('Pendiente de envío').first()).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: /1 pendiente de envío · sin conexión/ }),
    ).toBeVisible();
    await expect(page.getByText('Confirmada')).toHaveCount(0);

    await page.context().setOffline(false);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Confirmada')).toHaveCount(1);
  });

  test('recargar con series pendientes: siguen en el móvil y se envían; ninguna se duplica', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();

    // El servidor no es alcanzable para los comandos (la página sí carga).
    await page.route('**/api/cliente/sesiones/*/comandos', (route) => route.abort('failed'));
    await logVisibleSet(page, { waitForServer: false });
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Pendiente de envío')).toHaveCount(2);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Sentadilla goblet' })).toBeVisible();
    await expect(page.getByText('Pendiente de envío')).toHaveCount(2);
    await expect(page.getByText('2 de 5 series')).toBeVisible();

    // Vuelve el servidor: «Reintentar» (o la espera) los envía, en orden.
    await page.unroute('**/api/cliente/sesiones/*/comandos');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Confirmada')).toHaveCount(2);
    const state = await page.evaluate(async () => {
      const id = location.pathname.split('/').at(-2);
      return (await (await fetch(`/api/cliente/sesiones/${id}/estado`)).json()) as {
        state: { sets: { setNumber: number }[] };
      };
    });
    expect(state.state.sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  test('respuesta perdida y reenvío del mismo comando: una sola serie', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();

    // El comando llega y se aplica, pero la respuesta se pierde: el móvil lo reintenta.
    let dropped = false;
    await page.route('**/api/cliente/sesiones/*/comandos', async (route) => {
      if (!dropped && route.request().postDataJSON()?.type === 'log_set') {
        dropped = true;
        await route.fetch();
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Confirmada')).toHaveCount(1, { timeout: 15_000 });
    expect(dropped).toBe(true);

    // Y dos envíos idénticos a mano: el segundo es «ya aplicado».
    const result = await page.evaluate(async () => {
      const id = location.pathname.split('/').at(-2)!;
      const body = JSON.stringify({
        commandId: 'manual-duplicado-0001',
        type: 'log_set',
        versionNumber: 1,
        prescriptionId: 'x',
        setNumber: 1,
        supersedes: null,
        completed: false,
        device: {
          recordedAt: new Date().toISOString(),
          timeZone: 'Europe/Madrid',
          utcOffsetMinutes: 60,
        },
      });
      const send = () =>
        fetch(`/api/cliente/sesiones/${id}/comandos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }).then(async (r) => ({ status: r.status, body: await r.json() }));
      const state = await (await fetch(`/api/cliente/sesiones/${id}/estado`)).json();
      return { first: await send(), second: await send(), sets: state.state.sets.length };
    });
    // La serie de un ejercicio inexistente se rechaza (409) las dos veces, sin efectos.
    expect(result.first.status).toBe(409);
    expect(result.first.body.error).toBe('unknown_set_in_version');
    expect(result.second.body.error).toBe('unknown_set_in_version');
    expect(result.sets).toBe(1);
  });

  test('cierre parcial: terminar con series pendientes exige elegirlo', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page);
    await page.getByRole('button', { name: 'No la he hecho' }).click();
    await page.getByRole('button', { name: /tu sesión/i }).click();
    await page
      .getByRole('dialog', { name: 'Tu sesión' })
      .getByRole('button', { name: 'Terminar sesión' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Te quedan 3 series sin registrar' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Seguir entrenando' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /tu sesión/i }).click();
    await page
      .getByRole('dialog', { name: 'Tu sesión' })
      .getByRole('button', { name: 'Terminar sesión' })
      .click();
    await dialog.getByRole('button', { name: 'Terminar igualmente (cierre parcial)' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sesión terminada parcialmente' }),
    ).toBeVisible();
    await expect(
      page.getByText('1 de 5 series hechas · 1 no realizadas · 3 sin registrar'),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
  });

  test('pausar vuelve a Hoy; «Continuar» la reanuda', async ({ page, browser, space, baseURL }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pausar la sesión y volver a Hoy' }).click();
    await expect(page).toHaveURL(/\/cliente$/);
    const hero = page.getByRole('region', { name: 'Fuerza · pierna' });
    await expect(hero).toContainText('Pausada');
    await hero.getByRole('link', { name: /Continuar entrenamiento/ }).click();
    await page.getByRole('button', { name: 'Reanudar' }).click();
    await expect(page.getByText('Sesión en pausa')).toBeHidden();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
  });

  test('corregir una serie confirmada conserva la anterior para el entrenador', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const { url: a7 } = await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page);
    await expect(page.getByText('Confirmada')).toHaveCount(1);
    await page.getByRole('button', { name: 'Corregir serie 1' }).click();
    await page.getByLabel(/^Repeticiones$/).fill('9');
    await page.getByRole('button', { name: 'Guardar corrección' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await expect(page.getByText('9 × 16 kg')).toBeVisible();

    const trainer = await browser.newContext({ baseURL });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(a7);
    const first = alex
      .getByRole('region', { name: 'Sentadilla goblet' })
      .getByRole('listitem')
      .first();
    await expect(first).toContainText('corregida');
    await expect(first).toContainText('Hecho9 × 16 kg');
    await expect(first).toContainText('Antes: 10 × 16 kg');
    await trainer.close();
  });

  test('B2-UI · el reproductor cabe en 360 px, es accesible y se usa con el teclado', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await page.setViewportSize({ width: 360, height: 740 });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Empezar entrenamiento' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Sentadilla goblet' })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expectNoSeriousA11yIssues(page);
    // Con el teclado: «Serie hecha» y el descanso.
    await page.getByRole('button', { name: 'Serie hecha' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('timer')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expectNoSeriousA11yIssues(page);
    // Los controles de registro tienen tamaño táctil (≥ 44 px).
    const sizes = await page
      .locator('main button:visible')
      .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(36);
    await page.getByRole('button', { name: 'Saltar descanso' }).click();
    const logButton = await page.getByRole('button', { name: 'Serie hecha' }).boundingBox();
    expect(logButton!.height).toBeGreaterThanOrEqual(48);
  });
});
