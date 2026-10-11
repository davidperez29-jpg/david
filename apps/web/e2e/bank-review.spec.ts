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
  await expect(page.getByText(`Quedan ${n} vídeos sin verificar.`)).toBeVisible();

  const title = page.locator('#video-titulo');
  const firstName = await title.textContent();
  await expect(page.locator('iframe').first()).toHaveAttribute('title', `Vídeo de «${firstName}»`);
  // Skipping leaves it pending; marking one as broken takes it out of the queue.
  await page.getByRole('link', { name: 'Saltar' }).click();
  await expect(title).not.toHaveText(firstName!);
  const secondName = await title.textContent();
  await page.getByRole('button', { name: 'Está roto o no corresponde' }).click();
  await expect(page.getByText(`Quedan ${n - 1} vídeos sin verificar.`)).toBeVisible();
  await expect(title).toBeFocused();
  await expect(page.getByTestId('announcer')).toContainText(
    `Vídeo de «${secondName}» marcado como roto`,
  );
});
