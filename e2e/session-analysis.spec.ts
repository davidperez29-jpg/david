import { renameSync } from 'node:fs';
import { type Browser, devices, type Page } from '@playwright/test';
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

/**
 * B3.1 · Análisis de la sesión (A8), totales del día y panel, sobre la compilación de producción.
 * La clienta registra en un móvil (Pixel 7) y el entrenador analiza en el escritorio. Los casos
 * que necesitan horas concretas fijan el reloj del navegador (ADR-32); los que el reloj real del
 * servidor no permite (huecos de días, semana 53) están en las pruebas de integración.
 */
const FORBIDDEN =
  /incumpl|no cumplid|más exigente|menos exigente|\bmedid[oa]s?\b|verificad[oa]|carga medida|diagnóstic/i;

async function luciaPhone(browser: Browser, space: string, baseURL: string) {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  await joinSpace(context, space, baseURL);
  const page = await context.newPage();
  await enterAs(page, 'Lucía, clienta');
  return { context, page };
}

async function expectNoForbiddenWords(page: Page) {
  expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);
}

test.describe('análisis de la sesión (B3.1)', () => {
  test('AC-B3-01 · Lucía entrena en el móvil y Alex ve prescrito frente a registrado, diferencias, valores propuestos, totales del día y el panel', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    const today = todayInMadrid();
    const { url: a7, plank } = await publishForLucia(browser, space, baseURL!, { date: today });

    // Lucía: goblet 10/RIR 2, 10/RIR 1 y 8/RIR 0; la plancha, tal como se propone.
    const phone = await luciaPhone(browser, space, baseURL!);
    const lucia = phone.page;
    await lucia.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await startTraining(lucia);
    await lucia.getByRole('button', { name: '2', exact: true }).click();
    await logVisibleSet(lucia);
    await lucia.getByRole('button', { name: '1', exact: true }).click();
    await logVisibleSet(lucia);
    await lucia.getByLabel(/^Repeticiones$/).fill('8');
    await lucia.getByRole('button', { name: '0', exact: true }).click();
    await logVisibleSet(lucia);
    await expect(lucia.getByRole('heading', { level: 1, name: plank })).toBeVisible();
    await logVisibleSet(lucia);
    await lucia.getByRole('button', { name: 'Serie hecha' }).click();
    const finish = lucia.getByRole('dialog', { name: 'Terminar la sesión' });
    await finish.getByLabel(/Mensaje para Alex/).fill('Bien, la última costó.');
    await finish.getByRole('button', { name: 'Terminar sesión' }).click();
    await expect(lucia.getByRole('heading', { name: '¡Sesión completada!' })).toBeVisible();
    await expect(
      lucia.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();
    await phone.context.close();

    // Alex: de A7 al análisis.
    await enterAs(page, 'Alex, entrenador');
    await page.goto(a7);
    await page.getByRole('link', { name: 'Análisis de la sesión' }).click();
    await expect(page).toHaveURL(/\/analisis$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Fuerza · pierna' })).toBeVisible();
    const header = page.locator('header').filter({ hasText: 'Análisis de la sesión' });
    await expect(header).toContainText('Completada');
    await expect(header).toContainText('(en su día)');
    await expect(header).toContainText(
      'vigente v1 · empezada con la v1 · series registradas con v1',
    );

    const summary = page.getByRole('region', { name: 'Resumen' });
    await expect(summary).toContainText('5 de 5 series hechas · 0 no realizadas · 0 sin registrar');
    await expect(summary).toContainText(
      'Repeticiones 48 de 50 prescritas: 4 de 5 series coinciden · 1 distinta',
    );
    await expect(summary).toContainText('Carga: 3 de 3 series coinciden');
    await expect(summary).toContainText('RIR: 1 de 3 series coincide · 2 distintas');
    await expect(summary).toContainText(
      '4 de 5 series hechas con los valores iguales a lo propuesto · 1 con algún valor distinto',
    );
    await expect(summary).toContainText('puede haberse aceptado sin revisarlo');
    await expect(summary).toContainText('No hay puntuación global');

    const volume = page.getByRole('table', { name: /Volumen prescrito y registrado/ });
    await expect(volume.getByRole('row', { name: /Repeticiones/ }).first()).toContainText('50');
    await expect(volume.getByRole('row', { name: /Repeticiones/ }).first()).toContainText('48');
    await expect(volume.getByRole('row', { name: /Tonelaje externo/ })).toContainText('480 kg');
    await expect(volume.getByRole('row', { name: /Tonelaje externo/ })).toContainText('448 kg');
    // La insignia de la fórmula se despliega con su definición y sus limitaciones.
    const badge = volume
      .getByRole('row', { name: /Tonelaje externo/ })
      .getByText('training.volume-load 2.0.0');
    await badge.click();
    await expect(
      volume.getByText(/no la carga realmente desplazada ni el trabajo mecánico/).first(),
    ).toBeVisible();

    const differences = page.getByRole('region', { name: 'Diferencias respecto a lo prescrito' });
    await expect(differences).toContainText(
      'A1 · Sentadilla goblet · serie 2: RIR: distinto de lo prescrito (RIR −1)',
    );
    await expect(differences).toContainText(
      'A1 · Sentadilla goblet · serie 3: Repeticiones: distinto de lo prescrito (−2 rep.) · RIR: distinto de lo prescrito (RIR −2)',
    );
    await expect(page.getByRole('region', { name: 'Datos ausentes y advertencias' })).toContainText(
      'Ninguno.',
    );
    const detail = page.getByRole('region', { name: 'Detalle por ejercicio y serie' });
    const goblet = detail.getByRole('table', { name: /Series de Sentadilla goblet/ });
    await expect(goblet.getByRole('row')).toHaveCount(4);
    await expect(goblet.getByRole('row').nth(3)).toContainText('8 × 16 kg · RIR 0');
    await expect(goblet.getByRole('row').nth(3)).toContainText('distinto de lo propuesto');
    await expect(goblet.getByRole('row').nth(1)).toContainText('igual a lo propuesto');
    await expect(page.getByRole('region', { name: 'Observaciones' })).toContainText(
      'Bien, la última costó.',
    );
    await expect(
      page.getByRole('region', { name: 'Qué se puede concluir y qué no' }),
    ).toContainText(
      '«Serie hecha» confirma el registro de la serie, no una medición independiente de cada valor',
    );
    await expectNoForbiddenWords(page);
    await expectNoSeriousA11yIssues(page);

    // Vigente: con una sola versión, las mismas cifras.
    await page.getByRole('link', { name: 'Prescripción vigente' }).click();
    await expect(page).toHaveURL(/referencia=vigente/);
    await expect(page.getByRole('link', { name: 'Prescripción vigente' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('region', { name: 'Resumen' })).toContainText(
      'Repeticiones 48 de 50 prescritas',
    );

    // Totales del día de ejecución.
    await page.getByRole('link', { name: /Totales del .* \(día de ejecución\)/ }).click();
    await expect(page).toHaveURL(new RegExp(`/dia/${today}$`));
    const executed = page.getByRole('table', { name: /Lo registrado en cada sesión del día/ });
    const total = executed.getByRole('row', { name: /Total del día/ });
    await expect(total).toContainText('48');
    await expect(total).toContainText('448 kg');
    await expect(page.getByRole('region', { name: /Previsto para este día/ })).toContainText(
      'Fuerza · pierna',
    );
    await expectNoSeriousA11yIssues(page);

    // Panel: la sesión, con acceso a su análisis.
    await page.goto('/entrenador');
    await expect(
      page.getByRole('heading', { name: 'Sesiones de los últimos 7 días' }),
    ).toBeVisible();
    await page.getByRole('link', { name: /^Lucía.* · Mañana · Fuerza · pierna$/ }).click();
    await expect(page).toHaveURL(/\/analisis$/);
    expect(errors).toEqual([]);
  });

  test('sin empezar: lo dice, no inventa nada y la referencia original no se fija hasta que termina el día', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const { url } = await publishForLucia(browser, space, baseURL!, {
      date: addDays(todayInMadrid(), 1),
      title: 'Mañana toca',
    });
    await enterAs(page, 'Alex, entrenador');
    await page.goto(`${url}/analisis`);
    await expect(page.locator('header').filter({ hasText: 'Análisis de la sesión' })).toContainText(
      'Sin empezar',
    );
    await expect(
      page
        .getByText('Referencia histórica no determinada: El día previsto aún no ha terminado.')
        .first(),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Prescripción vigente' }).click();
    await expect(page.getByText('Lucía aún no ha empezado esta sesión.')).toBeVisible();
    const goblet = page.getByRole('table', { name: /Series de Sentadilla goblet/ });
    await expect(goblet.getByRole('row').nth(1)).toContainText('Sin registrar');
    await expect(page.getByRole('region', { name: 'Resumen' })).toContainText(
      '0 de 5 series hechas',
    );
    await expect(page.getByRole('region', { name: 'Resumen' })).toContainText(
      'Sin duración: la sesión no se ha empezado.',
    );
    await expectNoForbiddenWords(page);
  });

  test('AC-B3-08 · trasladada: prevista ayer y hecha hoy; su carga cuenta hoy y ayer figura solo como prevista', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const today = todayInMadrid();
    const yesterday = addDays(today, -1);
    const { url } = await publishForLucia(browser, space, baseURL!, {
      date: yesterday,
      title: 'De ayer',
    });
    const phone = await luciaPhone(browser, space, baseURL!);
    await phone.page.goto(`/cliente/sesion/${url.split('/').at(-1)}/entrenar`);
    await startTraining(phone.page);
    await logVisibleSet(phone.page);
    await phone.context.close();

    await enterAs(page, 'Alex, entrenador');
    await page.goto(`${url}/analisis`);
    await expect(page.locator('header').filter({ hasText: 'Análisis de la sesión' })).toContainText(
      '(1 día después)',
    );
    await page.goto(`/entrenador/clientes/c-lucia/dia/${today}`);
    await expect(
      page.getByRole('table', { name: /Lo registrado en cada sesión del día/ }),
    ).toContainText('trasladada: prevista el');
    await expect(page.getByRole('row', { name: /Total del día/ })).toContainText('10');
    await page.goto(`/entrenador/clientes/c-lucia/dia/${yesterday}`);
    await expect(page.getByRole('region', { name: /Ejecutado este día/ })).toContainText(
      'Ninguna sesión empezada este día.',
    );
    await expect(page.getByRole('region', { name: /Previsto para este día/ })).toContainText(
      '(1 día después): su carga cuenta ese día',
    );
  });

  test('AC-B3-09 · medianoche: inicio a las 23:50 y series a las 23:58 y 00:03 cuentan en el día de inicio', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    expect(space).toBeTruthy();
    const today = todayInMadrid();
    const yesterday = addDays(today, -1);
    const sessionId = `s-marta-${addDays(today, 2)}`;
    await page.clock.setFixedTime(new Date(`${yesterday}T23:50:00+01:00`));
    await enterAs(page, 'Marta, clienta');
    await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
    await startTraining(page);
    await page.clock.setFixedTime(new Date(`${yesterday}T23:58:00+01:00`));
    await logVisibleSet(page);
    await page.clock.setFixedTime(new Date(`${today}T00:03:00+01:00`));
    await logVisibleSet(page);
    await expect(page.getByText('Confirmada')).toHaveCount(2);

    const desk = await browser.newContext({ baseURL, timezoneId: 'Europe/Madrid' });
    await joinSpace(desk, space, baseURL!);
    const alex = await desk.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(`/entrenador/clientes/c-marta/sesiones/${sessionId}/analisis`);
    await expect(alex.locator('header').filter({ hasText: 'Análisis de la sesión' })).toContainText(
      '(3 días antes)',
    );
    const detail = alex.getByRole('region', { name: 'Detalle por ejercicio y serie' });
    await expect(detail).toContainText('a las 23:58');
    await expect(detail).toContainText('a las 00:03');
    await alex.goto(`/entrenador/clientes/c-marta/dia/${yesterday}`);
    const executed = alex.getByRole('table', { name: /Lo registrado en cada sesión del día/ });
    await expect(executed.getByRole('rowheader').first()).toContainText('Empezada a las 23:50');
    await alex.goto(`/entrenador/clientes/c-marta/dia/${today}`);
    await expect(alex.getByRole('region', { name: /Ejecutado este día/ })).not.toContainText(
      'Empezada a las 23:50',
    );
    await desk.close();
  });

  test('AC-B3-10 · hueco de 9 h sin pausa: advertencia sin descontar nada', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    expect(space).toBeTruthy();
    const sessionId = `s-marta-${addDays(todayInMadrid(), 2)}`;
    const now = Date.now();
    await page.clock.setFixedTime(new Date(now - 10 * 3_600_000));
    await enterAs(page, 'Marta, clienta');
    await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
    await startTraining(page);
    await page.clock.setFixedTime(new Date(now - (9 * 60 + 50) * 60_000));
    await logVisibleSet(page);
    await page.clock.setFixedTime(new Date(now - 45 * 60_000));
    await page.getByRole('button', { name: /tu sesión/i }).click();
    await page
      .getByRole('dialog', { name: 'Tu sesión' })
      .getByRole('button', { name: 'Terminar sesión' })
      .click();
    await page
      .getByRole('dialog', { name: /^Te quedan \d+ series? sin registrar$/ })
      .getByRole('button', { name: 'Terminar igualmente (cierre parcial)' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Sesión terminada parcialmente' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Todo guardado en el servidor' }),
    ).toBeVisible();

    const desk = await browser.newContext({ baseURL, timezoneId: 'Europe/Madrid' });
    await joinSpace(desk, space, baseURL!);
    const alex = await desk.newPage();
    await enterAs(alex, 'Alex, entrenador');
    await alex.goto(`/entrenador/clientes/c-marta/sesiones/${sessionId}/analisis`);
    await expect(alex.locator('header').filter({ hasText: 'Análisis de la sesión' })).toContainText(
      'Parcial',
    );
    await expect(alex.getByRole('region', { name: 'Resumen' })).toContainText(
      'Transcurrida 9 h 15 min · pausas registradas 0 min · calculada 9 h 15 min',
    );
    await expect(alex.getByRole('region', { name: 'Datos ausentes y advertencias' })).toContainText(
      'Advertencia: 9 h 5 min sin actividad registrada',
    );
    await expectNoSeriousA11yIssues(alex);
    await desk.close();
  });

  test('AC-B3-16 · permisos: sesión de otro cliente, sesión inexistente, fecha no válida y cliente ajeno dan 404', async ({
    page,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    const today = todayInMadrid();
    const marta = `s-marta-${addDays(today, 2)}`;
    expect(
      (await page.goto(`/entrenador/clientes/c-lucia/sesiones/${marta}/analisis`))?.status(),
    ).toBe(404);
    expect(
      (await page.goto('/entrenador/clientes/c-marta/sesiones/s-no-existe/analisis'))?.status(),
    ).toBe(404);
    expect((await page.goto('/entrenador/clientes/c-marta/dia/2026-13-45'))?.status()).toBe(404);
    expect((await page.goto(`/entrenador/clientes/c-ajeno/dia/${today}`))?.status()).toBe(404);
    // Con una perspectiva extraña en la URL, la original.
    const ok = await page.goto(
      `/entrenador/clientes/c-marta/sesiones/${marta}/analisis?referencia=%3Cscript%3E`,
    );
    expect(ok?.status()).toBe(200);
    await expect(page.getByRole('link', { name: 'Prescripción original' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('error de la base en A8: la página de B3.0, sin datos ni detalles internos', async ({
    page,
    space,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    const url = `/entrenador/clientes/c-marta/sesiones/s-marta-${addDays(todayInMadrid(), 2)}/analisis`;
    expect((await page.goto(url))?.status()).toBe(200);
    renameSync(`.data/e2e/espacios/${space}.sqlite`, `.data/e2e/espacios/${space}.sqlite.movida`);
    await page.goto(url);
    await expect(page.locator('[data-storage-kind="unavailable"]')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\.sqlite|SQLITE|espacios|Sentadilla/);
  });
});
