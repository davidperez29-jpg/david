import { collectErrors, expectNoSeriousA11yIssues, todayInMadrid } from './helpers';
import {
  addDays,
  enterAs,
  expect,
  joinSpace,
  logVisibleSet,
  publishForLucia,
  startTraining,
  test,
} from './fixtures';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

    // Vuelve el servidor: «Reintentar» (o el reintento automático, que puede adelantarse) los
    // envía, en orden.
    const retry = page.getByRole('button', { name: 'Reintentar' });
    await expect(retry).toBeVisible();
    await page.unroute('**/api/cliente/sesiones/*/comandos');
    if (await retry.isVisible()) await retry.click({ timeout: 2_000 }).catch(() => undefined);
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

  test('respuesta perdida y reenvío del mismo comando: una sola serie; un duplicado se rechaza', async ({
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

    // E2E-23 · A mano: la misma serie con otro identificador (y sin `supersedes`) es un
    // duplicado → 409 set_already_logged, con el registro que ya tiene el servidor; reenviarlo
    // tampoco la aplica. Y un comando nuevo reenviado dos veces se aplica una sola vez.
    const result = await page.evaluate(async () => {
      const id = location.pathname.split('/').at(-2)!;
      const state = await (await fetch(`/api/cliente/sesiones/${id}/estado`)).json();
      const done = state.state.sets[0] as { prescriptionId: string; setNumber: number };
      const command = (commandId: string, setNumber: number) =>
        JSON.stringify({
          commandId,
          clientId: 'c-lucia',
          type: 'log_set',
          versionNumber: 1,
          prescriptionId: done.prescriptionId,
          setNumber,
          supersedes: null,
          completed: true,
          reps: 10,
          load: { kind: 'external', kg: 16 },
          rir: 2,
          device: {
            recordedAt: new Date().toISOString(),
            timeZone: 'Europe/Madrid',
            utcOffsetMinutes: 60,
          },
        });
      const send = (body: string) =>
        fetch(`/api/cliente/sesiones/${id}/comandos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }).then(async (r) => ({ status: r.status, body: await r.json() }));
      const duplicate = command('manual-duplicado-0001', done.setNumber);
      const second = command('manual-serie-2-0001', done.setNumber + 1);
      const out = {
        duplicate: await send(duplicate),
        duplicateAgain: await send(duplicate),
        second: await send(second),
        secondAgain: await send(second),
        sets: 0,
      };
      const after = await (await fetch(`/api/cliente/sesiones/${id}/estado`)).json();
      out.sets = after.state.sets.length;
      return out;
    });
    expect(result.duplicate.status).toBe(409);
    expect(result.duplicate.body.error).toBe('set_already_logged');
    expect(result.duplicate.body.effective.setNumber).toBe(1);
    expect(result.duplicateAgain.body.error).toBe('set_already_logged');
    expect(result.second).toMatchObject({ status: 200, body: { result: 'applied' } });
    expect(result.secondAgain).toMatchObject({ status: 200, body: { result: 'already_applied' } });
    expect(result.sets).toBe(2);
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
      page.getByText('1 de 5 series hechas · 1 no realizada · 3 sin registrar'),
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
    // Con el teclado: «Serie hecha» y el descanso (el formulario acepta pulsaciones a los 400 ms).
    await expect(page.getByRole('button', { name: 'Serie hecha' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.getByRole('button', { name: 'Serie hecha' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('timer')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expectNoSeriousA11yIssues(page);
    // Los controles de registro tienen tamaño táctil (≥ 44 px).
    const sizes = await page
      .locator('main button:visible')
      .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Saltar descanso' }).click();
    const logButton = await page.getByRole('button', { name: 'Serie hecha' }).boundingBox();
    expect(logButton!.height).toBeGreaterThanOrEqual(48);
  });

  test('E2E-2 · doble toque en «Serie hecha»: una sola serie, y el descanso no se salta', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/comandos') && r.method() === 'POST') {
        sent.push((r.postDataJSON() as { type: string }).type);
      }
    });
    const done = page.getByRole('button', { name: 'Serie hecha' });
    await expect(done).not.toHaveAttribute('aria-disabled', 'true');
    await done.dblclick();
    await expect(page.getByText('Confirmada')).toHaveCount(1);
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    // El segundo toque cayó en el descanso recién aparecido y no hizo nada.
    await expect(page.getByRole('heading', { name: 'Descanso', exact: true })).toBeVisible();
    await expect(page.getByText('1 de 5 series')).toBeVisible();
    expect(sent.filter((type) => type === 'log_set')).toHaveLength(1);
  });

  test('E2E-4 · recargar durante el descanso: la cuenta sigue y se vuelve a la misma serie', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page, { skipRest: false });
    const timer = page.getByRole('timer');
    const remaining = async () =>
      Number((await timer.getAttribute('aria-label'))!.match(/quedan (\d+) segundos/)![1]);
    const before = await remaining();
    expect(before).toBeGreaterThan(10);
    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(timer).toBeVisible();
    const after = await remaining();
    // La cuenta se calcula con la hora de fin guardada: ha seguido corriendo durante la recarga.
    expect(before - after).toBeGreaterThanOrEqual(2);
    expect(before - after).toBeLessThanOrEqual(6);
    await page.getByRole('button', { name: 'Saltar descanso' }).click();
    await expect(
      page.getByRole('region', { name: /Serie 2 de 3 de Sentadilla goblet/ }),
    ).toBeVisible();
  });

  test('E2E-5 · navegación: «Tu sesión» a otro ejercicio, «Anterior» y «Siguiente ejercicio»', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const { plank } = await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await logVisibleSet(page);
    await page.getByRole('button', { name: /tu sesión/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Tu sesión' });
    await expect(dialog.getByRole('button', { name: /Sentadilla goblet\s*1\/3/ })).toBeVisible();
    await dialog.getByRole('button', { name: new RegExp(escapeRegExp(plank)) }).click();
    await expect(page.getByRole('heading', { level: 1, name: plank })).toBeVisible();
    await expect(page.getByText('Ejercicio 2 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sentadilla goblet' })).toBeVisible();
    // Vuelve a la primera serie sin registrar, con lo confirmado intacto.
    await expect(
      page.getByRole('region', { name: /Serie 2 de 3 de Sentadilla goblet/ }),
    ).toBeVisible();
    await expect(page.getByText('Confirmada')).toHaveCount(1);
    await page.getByRole('button', { name: 'Siguiente ejercicio' }).click();
    await expect(page.getByRole('heading', { level: 1, name: plank })).toBeVisible();
  });

  test('E2E-18 · empezar antes o después del día previsto: se permite y el entrenador lo ve', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const today = todayInMadrid();
    const late = await publishForLucia(browser, space, baseURL!, {
      date: addDays(today, -1),
      title: 'De ayer',
    });
    const early = await publishForLucia(browser, space, baseURL!, {
      date: addDays(today, 2),
      title: 'De pasado mañana',
    });
    await enterAs(page, 'Lucía, clienta');
    for (const { url } of [late, early]) {
      const sessionId = url.split('/').at(-1)!;
      await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
      await startTraining(page);
      await logVisibleSet(page);
    }

    const trainer = await browser.newContext({ baseURL });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(alex.locator('li', { hasText: 'De ayer' }).first()).toContainText(
      '(1 día después)',
    );
    await expect(alex.locator('li', { hasText: 'De pasado mañana' }).first()).toContainText(
      '(2 días antes)',
    );
    await trainer.close();
  });

  test('E2E-19 · pasada la medianoche: las series siguen en la sesión de su día, con su hora', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    expect(space).toBeTruthy();
    // Sesión de Marta sembrada para pasado mañana: publicada (ficticiamente) hace dos días, así que
    // ayer a las 23:50 ya existía (A-10: nada se ejecuta antes de publicarse).
    const today = todayInMadrid();
    const yesterday = addDays(today, -1);
    const sessionId = `s-marta-${addDays(today, 2)}`;
    // Madrid en noviembre: UTC+1. Solo se fija la hora del navegador; los temporizadores siguen.
    await page.clock.setFixedTime(new Date(`${yesterday}T23:50:00+01:00`));
    await enterAs(page, 'Marta, clienta');
    await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
    await startTraining(page);
    await page.clock.setFixedTime(new Date(`${yesterday}T23:58:00+01:00`));
    await logVisibleSet(page);
    await page.clock.setFixedTime(new Date(`${today}T00:03:00+01:00`));
    await logVisibleSet(page);
    await expect(page.getByText('Confirmada')).toHaveCount(2);

    const trainer = await browser.newContext({ baseURL, timezoneId: 'Europe/Madrid' });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(`/entrenador/clientes/c-marta/sesiones/${sessionId}`);
    const first = alex.getByRole('region').filter({ hasText: 'Previsto' }).first();
    await expect(first.getByRole('listitem').nth(0)).toContainText('23:58');
    await expect(first.getByRole('listitem').nth(1)).toContainText('00:03');
    await expect(first).not.toContainText('hora de llegada');
    // La sesión es del día en que se empezó (ayer), aunque una serie sea de hoy.
    await expect(alex.getByText(/\(3 días antes\)/)).toBeVisible();
    await trainer.close();
  });

  test('A-10 · el reloj del móvil marca una hora anterior a la publicación: se guarda la de llegada y el entrenador lo ve', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const { url } = await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    const sessionId = url.split('/').at(-1)!;
    // La sesión se acaba de publicar, pero el móvil cree que es hace dos días.
    await page.clock.setFixedTime(new Date(`${addDays(todayInMadrid(), -2)}T10:00:00+01:00`));
    await enterAs(page, 'Lucía, clienta');
    await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
    await startTraining(page);
    await logVisibleSet(page);
    await expect(page.getByText('Confirmada')).toHaveCount(1);

    const trainer = await browser.newContext({ baseURL, timezoneId: 'Europe/Madrid' });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(url);
    const goblet = alex
      .getByRole('region', { name: 'Sentadilla goblet' })
      .filter({ hasText: 'Previsto' });
    await expect(goblet.getByRole('listitem').nth(0)).toContainText(
      'hora de llegada (el reloj del móvil marcaba una hora imposible, anterior)',
    );
    await expect(goblet.getByRole('listitem').nth(0)).toContainText('Autodeclarado');
    await trainer.close();
  });

  test('A-08 · móvil compartido: lo pendiente de Marta nunca se envía como de Lucía y se envía al volver Marta', async ({
    page,
    space,
    baseURL,
  }) => {
    expect(space).toBeTruthy();
    // Registro de todas las peticiones de comandos, con la identidad de la cookie y del comando.
    const sent: { cookieClient: string; commandClient: string }[] = [];
    page.on('request', (r) => {
      if (!r.url().includes('/comandos') || r.method() !== 'POST') return;
      const cookie = /trainpro-cliente=([^;]+)/.exec(r.headers()['cookie'] ?? '')?.[1] ?? 'c-marta';
      sent.push({
        cookieClient: cookie,
        commandClient: (r.postDataJSON() as { clientId: string }).clientId,
      });
    });
    await enterAs(page, 'Marta, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    const sessionId = new URL(page.url()).pathname.split('/')[3]!;
    // Sin conexión con el servidor: la serie de Marta queda pendiente en el móvil.
    await page.route('**/api/cliente/sesiones/*/comandos', (r) => r.abort('failed'));
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Pendiente de envío').first()).toBeVisible();

    // Se cambia a Lucía y vuelve la conexión: la cola se procesa.
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar como Lucía, clienta' }).click();
    await page.waitForURL(/\/cliente$/);
    await page.unroute('**/api/cliente/sesiones/*/comandos');
    await page.reload();
    await expect(
      page.getByRole('note').filter({ hasText: 'de otra persona en este dispositivo' }),
    ).toBeVisible();
    await expect(page.getByText(/pendientes? de envío en este móvil/)).toHaveCount(0);
    await page.waitForTimeout(1500);
    // Ningún comando de Marta ha salido con la identidad de Lucía.
    expect(
      sent.filter((s) => s.cookieClient === 'c-lucia' && s.commandClient === 'c-marta'),
    ).toEqual([]);
    const state = async () =>
      (await (
        await page.request.get(`${baseURL}/api/cliente/sesiones/${sessionId}/estado`, {
          headers: { cookie: `trainpro-cliente=c-marta; trainpro-espacio=${space}` },
        })
      ).json()) as { state: { sets: unknown[] } };
    expect((await state()).state.sets).toHaveLength(0);

    // Marta vuelve: su serie se envía sola, una vez, como suya.
    await enterAs(page, 'Marta, clienta');
    await expect.poll(async () => (await state()).state.sets.length, { timeout: 15_000 }).toBe(1);
    await expect(page.getByRole('note').filter({ hasText: 'de otra persona' })).toHaveCount(0);
  });

  test('A-09 · un error recuperable se reintenta con «Reintentar»: una sola serie, confirmada', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    // El servidor responde un error recuperable (la sesión no está disponible un momento).
    await page.route('**/api/cliente/sesiones/*/comandos', async (route) => {
      if (route.request().postDataJSON()?.type !== 'log_set') return route.continue();
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'not_found',
          message: 'La sesión no existe o no es tuya.',
        }),
      });
    });
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Error de envío').first()).toBeVisible();
    await expect(page.getByText(/1 registro con error de envío/)).toBeVisible();
    // Se recupera el servicio y se pulsa «Reintentar»: mismo identificador, una sola vez.
    await page.unroute('**/api/cliente/sesiones/*/comandos');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Confirmada')).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    const sessionId = new URL(page.url()).pathname.split('/')[3]!;
    const state = (await (
      await page.request.get(`${baseURL}/api/cliente/sesiones/${sessionId}/estado`)
    ).json()) as { state: { sets: unknown[] } };
    expect(state.state.sets).toHaveLength(1);
  });

  test('E2E-21 · sin conexión, registrar, cerrar la página y abrir otra: lo pendiente se envía solo', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const { url } = await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    await page.context().setOffline(true);
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Pendiente de envío').first()).toBeVisible();
    const context = page.context();
    await page.close();
    await context.setOffline(false);

    // Otra página del mismo navegador (el mismo almacén local): Hoy envía lo pendiente.
    const again = await context.newPage();
    await again.goto('/cliente');
    await expect(
      again.getByRole('link', { name: /Continuar entrenamiento · 1 de 5 series/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(again.getByText(/pendientes? de envío en este móvil/)).toHaveCount(0);

    const trainer = await browser.newContext({ baseURL });
    await joinSpace(trainer, space, baseURL!);
    const alex = await trainer.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(url);
    await expect(alex.getByText('1 de 5 series').first()).toBeVisible();
    await trainer.close();
  });

  test('E2E-22 · el servidor falla dos veces (503): se reintenta solo y queda una serie', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    await publishForLucia(browser, space, baseURL!, { date: todayInMadrid() });
    await enterAs(page, 'Lucía, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(page);
    let failures = 0;
    let attempts = 0;
    await page.route('**/api/cliente/sesiones/*/comandos', async (route) => {
      if (route.request().postDataJSON()?.type !== 'log_set') return route.continue();
      attempts += 1;
      if (failures < 2) {
        failures += 1;
        return route.fulfill({ status: 503, body: 'no disponible' });
      }
      return route.continue();
    });
    await logVisibleSet(page, { waitForServer: false });
    await expect(page.getByText('Pendiente de envío').first()).toBeVisible();
    await expect(page.getByText('Confirmada')).toHaveCount(0);
    // Reintentos automáticos a los 2 y 4 s, con el mismo identificador.
    await expect(page.getByText('Confirmada')).toHaveCount(1, { timeout: 20_000 });
    expect(failures).toBe(2);
    expect(attempts).toBe(3);
    const state = await page.evaluate(async () => {
      const id = location.pathname.split('/').at(-2);
      return (await (await fetch(`/api/cliente/sesiones/${id}/estado`)).json()) as {
        state: { sets: unknown[] };
      };
    });
    expect(state.state.sets).toHaveLength(1);
  });
});
