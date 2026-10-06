import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 8 (UX_FLOW §2.6): ejercicio → silueta → vídeo → series → reps → carga → RIR →
 * completar → feedback (Fácil · Normal · Difícil · Muy difícil), offline, with fichaje: the first
 * set marks the session «Iniciada».
 */
test('Hoy on a phone: silhouette, sets, ¿Cómo fue? and ¿Molestias?, offline, fichaje', async ({
  page,
  context,
}) => {
  await login(page, 'iker.arrieta@example.com');
  await page.getByRole('link', { name: /^(Empezar|Ver sesión)/ }).click();
  await expect(page).toHaveURL(/\/me\/sesion\//);
  const sessionId = page.url().split('/').pop()!;
  const first = page.getByRole('article').first();
  // The silhouette of the muscles worked is on the card (an accessible image).
  await expect(first.getByRole('img', { name: /Músculos principales/ })).toBeVisible();
  await expect(page.getByText('Planificada', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión/).first()).toBeVisible();
  await first.getByRole('button', { name: /^Registrar serie 1/ }).click();
  await expect(page.getByText('Iniciada', { exact: true })).toBeVisible();

  // One tap each, 48 px targets; «Algo» adds the optional 0–10 and the safety message.
  await first.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await first.getByRole('button', { name: 'Algo', exact: true }).click();
  await expect(first.getByRole('group', { name: '¿Cuánto? (0–10, opcional)' })).toBeVisible();
  await first.getByRole('button', { name: '¿Cuánto? (0–10, opcional): 3' }).click();
  await expect(first.getByText(/consulta con un profesional sanitario/)).toBeVisible();
  const box = await first.getByRole('button', { name: 'Normal', exact: true }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);

  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').selectOption({ label: 'Cansancio' });
  await dialog.getByRole('button', { name: 'Difícil', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión registrada' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Tu entrenador/a ya puede verla.')).toBeVisible({ timeout: 15_000 });
  const s = (await (await page.request.get(`/api/v1/sessions/${sessionId}`)).json()) as {
    tracking: string;
    attendance: { status: string; automatic: boolean } | null;
    feedback: { feel: string | null } | null;
    blocks: {
      exercises: {
        feedback: { feel: string | null; discomfort: string | null } | null;
        logs: unknown[];
      }[];
    }[];
  };
  expect(s.tracking).toBe('Incompleta');
  expect(s.attendance).toMatchObject({ status: 'partial', automatic: false });
  expect(s.feedback?.feel).toBe('hard');
  const ex = s.blocks[0]!.exercises[0]!;
  expect(ex.logs).toHaveLength(1);
  // Iker gave health-data consent in the demo: the discomfort is stored.
  expect(ex.feedback).toEqual({ feel: 'normal', discomfort: 'some' });
});
