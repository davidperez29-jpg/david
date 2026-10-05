import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';
import { TimedTask } from './ux-tasks';

/** Restructure phase 2: the session table (docs/UX_FLOW.md §2.3) and its acceptance criteria. */

const grid = (page: Page) => page.getByRole('grid', { name: 'Ejercicios de la sesión' });
/** Data rows (block headers and the add row have no checkbox). */
const rows = (page: Page) =>
  grid(page)
    .getByRole('row')
    .filter({ has: page.getByRole('checkbox') });
/** Cell of a row by column: 0 #, 1 exercise, 2 category, 3 sets, 4 reps, 5 load, 6 RIR, 7 RPE, 8 rest, 9 notes. */
const cell = (page: Page, row: number, col: number) => rows(page).nth(row).locator('td').nth(col);

async function openClient(page: Page, name: string) {
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

test('UX 4 · from the home, a load is changed with two clicks and typing', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  const t = new TimedTask(page, 'Cambiar una carga desde el inicio');
  // The client opens on Programa: current week and next session, with its table.
  await t.step(() => page.getByRole('link', { name: 'Villalba, Marcos' }).click());
  const row = () => rows(page).filter({ hasText: '8-12' }).first();
  await t.step(() => row().locator('td').nth(5).click());
  await t.step(() => page.keyboard.type('62,5'));
  await t.step(() => page.keyboard.press('Enter'));
  await expect(row().locator('td').nth(5)).toHaveText('62,5 kg');
  const r = t.done();
  expect(r.interactions).toBeLessThanOrEqual(4);
  expect(r.ms).toBeLessThan(20_000);
  await page.reload();
  await expect(row().locator('td').nth(5)).toHaveText('62,5 kg');
});

test('notation errors stay in the cell; RIR and RPE exclude each other; Ctrl+Z undoes', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await openClient(page, 'Ocaña, Javier');
  const before = await cell(page, 0, 4).innerText();
  // A wrong value is not saved: the cell keeps editing and explains the notation.
  await cell(page, 0, 4).click();
  await page.keyboard.type('muchas');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Escribe repeticiones \(8 o 6-8\)/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cell(page, 0, 4)).toHaveText(before);
  // RPE in a row with RIR replaces the RIR (one or the other).
  const rir = await rows(page).locator('td:nth-child(7)').allInnerTexts();
  const i = rir.findIndex((t) => /\d/.test(t));
  if (i >= 0) {
    await cell(page, i, 7).click();
    await page.keyboard.type('8');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Se ha quitado el RIR: usa RIR o RPE, no los dos.')).toBeVisible();
    await expect(cell(page, i, 6)).toHaveText('·');
    await expect(cell(page, i, 7)).toHaveText('8');
  }
  // Ctrl+Z restores the previous value of the last edit.
  await cell(page, 0, 3).click();
  const sets = (await cell(page, 0, 3).innerText()).trim();
  const other = sets === '7' ? '6' : '7';
  await page.keyboard.type(other);
  await page.keyboard.press('Enter'); // saves and moves down: the table keeps the focus
  await expect(cell(page, 0, 3)).toHaveText(other);
  await page.keyboard.press('Control+z');
  await expect(page.getByText(/^Deshecho: series de /)).toBeVisible();
  await expect(cell(page, 0, 3)).toHaveText(sets);
});

test('the row options open with the keyboard: Tab from the last cell, then Enter', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await openClient(page, 'Ocaña, Javier');
  await cell(page, 0, 9).click(); // notes, the last cell of the row
  await page.keyboard.press('Tab');
  const more = rows(page)
    .first()
    .getByRole('button', { name: /^Más opciones de / });
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter'); // the table does not take the key from the button
  await expect(more).toHaveAttribute('aria-expanded', 'true');
});

test('five rows pasted from Excel become five exercises, recognized by name', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await openClient(page, 'Ocaña, Javier');
  const before = await rows(page).count();
  await page.getByRole('button', { name: 'Pegar desde Excel' }).click();
  await page
    .getByLabel(/Pega aquí las filas/)
    .fill(
      [
        'EJERCICIO\tSERIES\tREPS\tCARGA\tRIR\tDESC.\tNOTAS',
        'sentadilla trasera con barra\t4\t6-8\t80 kg\t2\t2:30\tbajar controlado',
        'Curl nordico\t3\t5\tPC\t\t2 min\t',
        'Prensa 45\t3\t10-12\t120\t1-2\t90\t',
        'Plancha frontal\t3\t30 s\t\t\t60\t',
        'Sentadilla goblet con KB\t2\t12\t16 kg\t3\t60\t',
      ].join('\n'),
    );
  const panel = page.getByRole('region', { name: 'Pegar filas desde Excel' });
  await expect(panel.getByText('Curl nórdico')).toBeVisible();
  await expect(panel.getByText('reconocido')).toHaveCount(5);
  await panel.getByRole('button', { name: 'Añadir 5 ejercicios' }).click();
  await expect(rows(page)).toHaveCount(before + 5);
  const last = rows(page).nth(before);
  await expect(last.locator('td').nth(1)).toContainText('Sentadilla trasera con barra');
  await expect(last.locator('td').nth(5)).toHaveText('80 kg');
  await expect(last.locator('td').nth(8)).toHaveText('2:30');
  await expect(last.locator('td').nth(9)).toHaveText('bajar controlado');
  await expect(
    rows(page)
      .nth(before + 1)
      .locator('td')
      .nth(5),
  ).toHaveText('Peso corporal');
  // Undo removes the five pasted rows.
  await rows(page).first().locator('td').nth(3).click();
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(before);
});

test('two trainers editing the same row: nothing is overwritten, the second one is told', async ({
  browser,
}) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  for (const p of [a, b]) {
    await login(p, 'lucia.moreno@example.com');
    await openClient(p, 'Ocaña, Javier');
  }
  // A changes the load; B, with the page loaded before, changes the rest of the same row.
  await cell(a, 0, 5).click();
  await a.keyboard.type('41');
  await a.keyboard.press('Enter');
  await expect(cell(a, 0, 5)).toHaveText('41 kg');
  await cell(b, 0, 8).click();
  await b.keyboard.type('75');
  await b.keyboard.press('Enter');
  await expect(
    b.getByText(/Otra persona ha cambiado .* no se ha guardado tu cambio/),
  ).toBeVisible();
  // B now sees A's change and can write its own again.
  await expect(cell(b, 0, 5)).toHaveText('41 kg');
  await cell(b, 0, 8).click();
  await b.keyboard.type('75');
  await b.keyboard.press('Enter');
  await expect(cell(b, 0, 8)).toHaveText('1:15');
  await a.reload();
  await expect(cell(a, 0, 5)).toHaveText('41 kg');
  await expect(cell(a, 0, 8)).toHaveText('1:15');
  await a.close();
  await b.close();
});
