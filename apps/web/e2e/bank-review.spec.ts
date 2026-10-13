import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** «Sin nivel (720)» → 720. */
const count = async (text: Promise<string | null>) =>
  Number(/\((\d+)\)/.exec((await text) ?? '')![1]);

test('bank review: filter what is missing, change many at once, review one by one', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Ejercicios', exact: true }).click();
  await page.getByRole('link', { name: /^Revisión del banco/ }).click();
  await expect(page.getByRole('heading', { name: 'Revisión del banco', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/^Revisión del banco · /);
  await expect(page.getByRole('progressbar', { name: /^Completados: \d+ de \d+$/ })).toBeVisible();

  // What is missing, as filters with their counts.
  const gaps = page.getByRole('navigation', { name: 'Qué falta' });
  const noLevel = gaps.getByRole('link', { name: /^Sin nivel \(\d+\)$/ });
  const n = await count(noLevel.textContent());
  expect(n).toBeGreaterThan(2);
  await noLevel.click();
  await expect(noLevel).toHaveAttribute('aria-current', 'page');
  const heading = page.locator('#cola-titulo');
  await expect(heading).toHaveText(`${n} ejercicios en la cola: sin nivel`);

  // «Aplicar» says what is missing and takes the focus there (phase 21, A-BR-6).
  const applyNone = page.getByRole('button', { name: 'Aplicar a 0 ejercicios' });
  await applyNone.click();
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'Marca al menos un ejercicio en la tabla.',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' }),
  ).toBeFocused();
  // Another page starts with nothing selected (A-BR-1): nothing unseen can be changed.
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .check();
  await expect(page.getByRole('group', { name: 'Cambiar los seleccionados (1)' })).toBeVisible();
  await page.getByRole('link', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText(/^51–100 de \d+$/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Cambiar los seleccionados (0)' })).toBeVisible();
  await page.getByRole('link', { name: 'Anterior', exact: true }).click();
  await expect(page.getByText(/^1–50 de \d+$/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Cambiar los seleccionados (0)' })).toBeVisible();
  // The archive confirmation names what and how many; Escape returns to «Aplicar» (A-BR-2).
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .check();
  await page.getByLabel('Cambio').selectOption('archive');
  await page.getByRole('button', { name: 'Aplicar a 1 ejercicio' }).click();
  const confirm = page.getByRole('group', { name: 'Confirmar: archivar 1 ejercicio' });
  await expect(confirm.getByRole('button', { name: 'Sí, archivar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aplicar a 1 ejercicio' })).toBeFocused();
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .uncheck();
  // A change that needs a value says so and focuses it.
  await page.getByLabel('Cambio').selectOption('set_level');
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .check();
  await page.getByRole('button', { name: 'Aplicar a 1 ejercicio' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'Elige un valor para el cambio.',
  );
  await expect(page.getByLabel('Valor')).toBeFocused();
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .uncheck();

  // One change for two exercises: each is versioned and audited; the queue shrinks.
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .nth(0)
    .check();
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .nth(1)
    .check();
  await page.getByLabel('Cambio').selectOption('set_level');
  await page.getByLabel('Valor').selectOption('beginner');
  await page.getByRole('button', { name: 'Aplicar a 2 ejercicios' }).click();
  await expect(page.getByText('2 cambiados · 0 ya estaban así · 0 sin cambiar')).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(heading).toHaveText(`${n - 2} ejercicios en la cola: sin nivel`);
  await expect(noLevel).toHaveText(`Sin nivel (${n - 2})`);
  await expect(page.getByTestId('announcer')).toContainText('2 cambiados');

  // One by one: the exercise page keeps the queue, says what is missing and links the next one.
  await page
    .getByRole('link', { name: /^Revisar «/ })
    .first()
    .click();
  const bar = page.getByRole('navigation', { name: 'Revisión del banco' });
  await expect(bar).toContainText('Le falta:');
  await expect(bar).toContainText('Sin nivel');
  await expect(bar).toContainText(`Quedan ${n - 3} en la cola después de este.`);
  const first = page.url();
  const next = bar.getByRole('link', { name: /^Siguiente: / });
  const nextName = (await next.textContent())!.replace(/^Siguiente: /, '').replace(/ →$/, '');
  await next.click();
  await expect(page).not.toHaveURL(first);
  await expect(page.getByRole('heading', { name: nextName, level: 1 })).toBeVisible();
  // The title names the exercise, so the move is announced (A-BR-4).
  await expect(page).toHaveTitle(`${nextName} · Plataforma de entrenamiento`);
  await expect(bar).toContainText(`Quedan ${n - 4} en la cola después de este.`);
  await bar.getByRole('link', { name: 'Volver a la cola' }).click();
  await expect(heading).toHaveText(`${n - 2} ejercicios en la cola: sin nivel`);
});

test('bank review: videos are verified by a person, one at a time', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/library/revision');
  const link = page.getByRole('link', { name: /^Verificar vídeos \(\d+\)$/ });
  const n = await count(link.textContent());
  await link.click();
  await expect(page.getByRole('heading', { name: 'Verificar vídeos', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/^Verificar vídeos · /);
  await expect(page.getByText(`Quedan ${n} vídeos sin verificar.`)).toBeVisible();

  const title = page.locator('#video-titulo');
  const firstName = await title.textContent();
  await expect(page.locator('iframe').first()).toHaveAttribute('title', `Vídeo de «${firstName}»`);
  // Skipping leaves it pending; marking one as broken takes it out of the queue.
  await page.getByRole('link', { name: 'Saltar' }).click();
  await expect(title).not.toHaveText(firstName!);
  const secondName = await title.textContent();
  // The video that takes its place is announced (A-BR-3).
  await expect(page.getByTestId('announcer')).toHaveText(`Ahora: vídeo de «${secondName}».`);
  await page.getByRole('button', { name: 'Está roto o no corresponde' }).click();
  await expect(page.getByText(`Quedan ${n - 1} vídeos sin verificar.`)).toBeVisible();
  await expect(title).toBeFocused();
  // The verdict and the next video, in one message.
  const thirdName = await title.textContent();
  await expect(page.getByTestId('announcer')).toHaveText(
    `Vídeo de «${secondName}» marcado como roto. Ahora: vídeo de «${thirdName}».`,
  );
});

test('bank review fits a 320 px wide screen, confirmation open (reflow, A-BR-7)', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/app/library/revision');
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .check();
  await page.getByLabel('Cambio').selectOption('archive');
  await page.getByRole('button', { name: 'Aplicar a 1 ejercicio' }).click();
  await expect(page.getByRole('button', { name: 'Sí, archivar' })).toBeVisible();
  // Only the table scrolls sideways (inside its own region), never the page.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
