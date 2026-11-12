import {
  test as base,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from '@playwright/test';

/**
 * Pruebas que ESCRIBEN datos: cada una trabaja en su propio espacio (un archivo SQLite aparte,
 * sembrado al primer uso), así que pueden ir en paralelo sin pisarse. El espacio va en una
 * cookie que solo se tiene en cuenta con `TRAINPRO_DEMO_SPACES=on` (servidor de pruebas).
 */
export async function joinSpace(context: BrowserContext, space: string, baseURL: string) {
  await context.addCookies([{ name: 'trainpro-espacio', value: space, url: baseURL }]);
}

export const test = base.extend<{ space: string }>({
  space: async ({ context, baseURL }, provide, testInfo) => {
    const space = `p${testInfo.workerIndex}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    await joinSpace(context, space, baseURL!);
    await provide(space);
  },
});

export { expect };

/** «Entrar como…» desde la portada (B0). */
export async function enterAs(
  page: Page,
  who: 'Alex, entrenador' | 'Marta, clienta' | 'Lucía, clienta',
) {
  await page.goto('/');
  await page.getByRole('button', { name: `Entrar como ${who}` }).click();
  await page.waitForURL(who.startsWith('Alex') ? /\/entrenador$/ : /\/cliente$/);
}

/** Fecha AAAA-MM-DD desplazada unos días. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Crea una sesión para Lucía desde la interfaz (A4 → A5): datos, un ejercicio con kg y RIR,
 * y, si se pide, la publica. Devuelve la URL de la sesión (A7 si se publicó; A5 si no).
 */
export async function createSessionForLucia(
  page: Page,
  options: { date: string; label: string; title: string; exercise?: string; publish?: boolean },
) {
  await page.goto(`/entrenador/clientes/c-lucia/sesiones/nueva?fecha=${options.date}`);
  await page.getByLabel('Contexto').fill(options.label);
  await page.getByLabel('Título').fill(options.title);
  await page.getByLabel(/^Objetivo/).fill('Fuerza del tren inferior');
  await page.getByLabel('Duración (min)').fill('45');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await page.waitForURL(/\/editar$/);
  const exercise = options.exercise ?? 'Sentadilla goblet';
  await page.getByRole('searchbox').fill(exercise.split(' ').at(-1)!);
  await page.getByRole('button', { name: `Añadir ${exercise}` }).click();
  await page.getByLabel(`Carga de ${exercise}`).selectOption('external');
  await page.getByLabel(`Kilogramos de ${exercise}`).fill('16');
  await page.getByLabel(`Esfuerzo de ${exercise}`).selectOption('rir');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/^Borrador guardado/)).toBeVisible();
  if (options.publish ?? true) {
    await page.getByRole('button', { name: 'Publicar versión 1' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publicar' }).click();
    await page.waitForURL(/\/sesiones\/[0-9a-f-]{36}$/);
  }
  return page.url();
}

/**
 * Alex (en un contexto de escritorio aparte, en el mismo espacio) publica para Lucía una sesión
 * de hoy: sentadilla goblet 3 × 10 · 16 kg · RIR 2 y plancha lateral 2 series (por defecto,
 * 10 repeticiones con peso corporal y sin objetivo de esfuerzo). Devuelve la URL de A7.
 */
export async function publishForLucia(
  browser: Browser,
  space: string,
  baseURL: string,
  options: { date: string; label?: string; title?: string },
) {
  const context = await browser.newContext({ baseURL });
  await joinSpace(context, space, baseURL);
  const page = await context.newPage();
  await enterAs(page, 'Alex, entrenador');
  await page.goto(`/entrenador/clientes/c-lucia/sesiones/nueva?fecha=${options.date}`);
  await page.getByLabel('Contexto').fill(options.label ?? 'Mañana');
  await page.getByLabel('Título').fill(options.title ?? 'Fuerza · pierna');
  await page.getByLabel(/^Objetivo/).fill('Fuerza del tren inferior');
  await page.getByLabel('Duración (min)').fill('45');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await page.waitForURL(/\/editar$/);
  await page.getByRole('searchbox').fill('goblet');
  await page.getByRole('button', { name: 'Añadir Sentadilla goblet' }).click();
  await page.getByLabel('Carga de Sentadilla goblet').selectOption('external');
  await page.getByLabel('Kilogramos de Sentadilla goblet').fill('16');
  await page.getByLabel('Esfuerzo de Sentadilla goblet').selectOption('rir');
  await page.getByRole('searchbox').fill('plancha lateral');
  await page
    .getByRole('button', { name: /^Añadir Plancha lateral/ })
    .first()
    .click();
  const plank = (await page
    .getByRole('heading', { level: 3, name: /^Plancha lateral/ })
    .first()
    .textContent())!;
  await page.getByRole('button', { name: `Una serie menos de ${plank}` }).click();
  await page.getByLabel(`Carga de ${plank}`).selectOption('bodyweight');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/^Borrador guardado/)).toBeVisible();
  await page.getByRole('button', { name: 'Publicar versión 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar' }).click();
  await page.waitForURL(/\/sesiones\/[0-9a-f-]{36}$/);
  const url = page.url();
  await context.close();
  return { url, plank };
}

const commandResponse = (page: Page, type: string) =>
  page.waitForResponse(
    (r) =>
      r.url().includes('/comandos') &&
      r.request().method() === 'POST' &&
      (r.request().postDataJSON() as { type?: string } | null)?.type === type,
  );

/** Pulsa «Empezar entrenamiento» y espera a que el servidor confirme el inicio. */
export async function startTraining(page: Page) {
  const confirmed = commandResponse(page, 'start');
  await page.getByRole('button', { name: /Empezar (entrenamiento|igualmente)/ }).click();
  expect((await confirmed).status()).toBe(200);
}

/**
 * Desde el reproductor: registra la serie visible con lo que tenga el formulario, espera la
 * respuesta del servidor (salvo que se pida lo contrario, por ejemplo sin conexión) y salta el
 * descanso si aparece.
 */
export async function logVisibleSet(
  page: Page,
  options: { waitForServer?: boolean; skipRest?: boolean } = {},
) {
  const confirmed = options.waitForServer === false ? null : commandResponse(page, 'log_set');
  await page.getByRole('button', { name: 'Serie hecha' }).click();
  if (confirmed) expect((await confirmed).status()).toBe(200);
  if (options.skipRest === false) return;
  const skip = page.getByRole('button', { name: /^(Saltar descanso|Continuar)$/ });
  const resting = await skip
    .waitFor({ timeout: 1_500 })
    .then(() => true)
    .catch(() => false);
  if (resting) await skip.click();
}
