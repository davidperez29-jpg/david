import { test as base, type BrowserContext, expect, type Page } from '@playwright/test';

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
