import { type Browser, devices, type Page } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues, mondayOf, todayInMadrid } from './helpers';
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
 * B3.2 · A9 (análisis del cliente por periodos), A10 (evolución de un ejercicio) y las vistas
 * corregidas (P-106), sobre la compilación de producción. La clienta registra en un móvil
 * (Pixel 7) y el entrenador analiza en el escritorio.
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

/** Semana ISO de una fecha: número y año. */
function isoWeek(date: string): { year: number; week: number } {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

const weekRow = (page: Page, date: string) => {
  const { year, week } = isoWeek(date);
  return page
    .getByRole('table', { name: /Semana a semana/ })
    .getByRole('row', { name: new RegExp(`^Semana ${week} de ${year}\\b`) });
};

async function loadButtons(page: Page) {
  await page.goto('/entrenador/carga');
  const lucia = page.getByRole('region', { name: /^Lucía/ });
  const labels = await lucia
    .getByRole('button', { name: /^Semana del / })
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  const sessions = (label: string) => Number(/, (\d+) sesiones$/.exec(label)?.[1] ?? NaN);
  return { current: sessions(labels.at(-1)!), previous: sessions(labels.at(-2)!), labels };
}

test.describe('análisis por periodos (B3.2)', () => {
  test('AC-B3-19 · prevista la semana pasada y hecha hoy: aparece en las dos semanas, cada una con su papel; filtros, magnitud, A10 y «Carga» por fecha de ejecución', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    test.setTimeout(150_000);
    const errors = collectErrors(page);
    const today = todayInMadrid();
    const lastWeek = addDays(today, -7);
    expect(mondayOf(lastWeek)).not.toBe(mondayOf(today));

    await enterAs(page, 'Alex, entrenador');
    const before = await loadButtons(page);
    expect(before.labels.at(-1)).toContain('(en curso)');

    const { url } = await publishForLucia(browser, space, baseURL!, {
      date: lastWeek,
      title: 'De la semana pasada',
    });
    const phone = await luciaPhone(browser, space, baseURL!);
    await phone.page.goto(`/cliente/sesion/${url.split('/').at(-1)}/entrenar`);
    await startTraining(phone.page);
    await logVisibleSet(phone.page);
    await phone.context.close();

    // P-106 · «Carga»: la sesión cuenta en la semana en que se hizo, no en la prevista.
    const after = await loadButtons(page);
    expect(after.current).toBe(before.current + 1);
    expect(after.previous).toBe(before.previous);

    // A9 desde la pestaña «Análisis» de la ficha.
    await page.goto('/entrenador/clientes/c-lucia');
    await page.getByRole('link', { name: 'Análisis', exact: true }).click();
    await page.waitForURL(/\/entrenador\/clientes\/c-lucia\/analisis$/);
    await expect(page.getByRole('heading', { level: 2, name: /^4 semanas:/ })).toBeVisible();
    await expect(weekRow(page, lastWeek)).toContainText(
      `De la semana pasada: prevista aquí, hecha el`,
    );
    await expect(weekRow(page, today)).toContainText(
      'De la semana pasada: hecha aquí, prevista el',
    );
    await expect(
      page.getByRole('table', { name: /Sesiones del periodo/ }).getByRole('row', {
        name: /De la semana pasada/,
      }),
    ).toContainText('trasladada');
    await expectNoSeriousA11yIssues(page);
    expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);

    // Magnitud: repeticiones; la semana de hoy registra las 10 de la serie hecha.
    await page
      .getByRole('navigation', { name: 'Magnitud' })
      .getByRole('link', { name: 'Repeticiones' })
      .click();
    await page.waitForURL(/magnitud=repeticiones/);
    await expect(page.getByText('Repeticiones por semana (rep.)')).toBeVisible();
    await expect(weekRow(page, today)).toContainText('10 rep.');

    // Teclado: cada columna del gráfico se enfoca y muestra su detalle.
    const { week } = isoWeek(today);
    await page.getByRole('img', { name: new RegExp(`^Semana ${week} · `) }).focus();
    await expect(page.getByRole('status').filter({ hasText: 'Unidad: rep.' })).toContainText(
      'registrado 10 rep.',
    );

    // Filtros (GET): un ejercicio; la URL conserva la magnitud.
    await page
      .getByLabel('Ejercicio', { exact: true })
      .selectOption({ label: 'Sentadilla goblet' });
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await page.waitForURL(/ejercicio=ex-goblet-squat/);
    expect(page.url()).toContain('magnitud=repeticiones');
    await expect(page.locator('header').filter({ hasText: 'Análisis por periodos' })).toContainText(
      'Solo «Sentadilla goblet»',
    );

    // Perspectiva vigente: conserva el resto del estado.
    await page.getByRole('link', { name: 'Prescripción vigente' }).click();
    await page.waitForURL(/referencia=vigente/);
    expect(page.url()).toContain('ejercicio=ex-goblet-squat');
    await expect(page.getByRole('link', { name: 'Prescripción vigente' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // A10 desde «Ejercicios».
    await page
      .getByRole('region', { name: 'Ejercicios' })
      .getByRole('link', { name: 'Sentadilla goblet' })
      .click();
    await page.waitForURL(/\/analisis\/ejercicios\/ex-goblet-squat/);
    await expect(page.getByRole('heading', { level: 2, name: 'Sentadilla goblet' })).toBeVisible();
    await expect(page.getByRole('table', { name: /series de Sentadilla goblet/ })).toContainText(
      '10 × 16 kg',
    );
    await expect(page.getByText('kg registrados de cada serie hecha')).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);
    expect(errors).toEqual([]);
  });

  test('AC-B3-14 · la semana 53 de 2026 se rotula «28 dic 2026 – 3 ene 2027»; en la original, lo prescrito de un día que no ha llegado no se determina', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const errors = collectErrors(page);
    await publishForLucia(browser, space, baseURL!, { date: '2027-01-01', title: 'Año nuevo' });
    await enterAs(page, 'Alex, entrenador');
    await page.goto('/entrenador/clientes/c-lucia/analisis?periodo=semana&fecha=2027-01-01');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'Semana 53 de 2026 (ISO): 28 dic 2026 – 3 ene 2027',
    );
    const row = weekRow(page, '2027-01-01');
    await expect(row).toContainText('28 dic 2026 – 3 ene 2027');
    await expect(row).toContainText('no determinado');
    await page.getByRole('link', { name: 'Prescripción vigente' }).click();
    await page.waitForURL(/referencia=vigente/);
    // Sentadilla goblet 3 series y plancha lateral 2.
    await expect(weekRow(page, '2027-01-01')).toContainText('5 series');
    await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });

  test('periodo no válido: se avisa y se muestra el de por defecto; un cliente o un ejercicio que no existen: 404', async ({
    page,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    await page.goto(
      '/entrenador/clientes/c-marta/analisis?periodo=rango&desde=2026-11-30&hasta=2026-11-01',
    );
    await expect(page.getByText('Periodo no válido')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^4 semanas:/ })).toBeVisible();
    const missing = await page.goto('/entrenador/clientes/c-no-existe/analisis');
    expect(missing?.status()).toBe(404);
    const badVariant = await page.goto('/entrenador/clientes/c-marta/analisis/ejercicios/a%2Fb');
    expect(badVariant?.status()).toBe(404);
  });
});
