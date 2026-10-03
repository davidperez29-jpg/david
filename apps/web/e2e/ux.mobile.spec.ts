import { expect, test } from '@playwright/test';
import { login } from './helpers';
import { TimedTask } from './ux-tasks';

test('UX 3 · client opens the next session and logs the first set', async ({ page }) => {
  await login(page, 'iker.arrieta@example.com');
  const t = new TimedTask(page, 'Abrir la sesión y registrar la primera serie (móvil)');
  await t.step(() => page.getByRole('link', { name: /^(Empezar|Ver sesión)/ }).click());
  const tick = page.getByRole('button', { name: /^Registrar serie 1/ }).first();
  await t.step(() => tick.click());
  await expect(tick).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Guardado').first()).toBeVisible({ timeout: 10_000 });
  const r = t.done();
  expect(r.interactions).toBeLessThanOrEqual(2);
  expect(r.ms).toBeLessThan(20_000);
});
