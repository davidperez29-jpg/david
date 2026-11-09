'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type CreateSessionOutcome,
  type PublishOutcome,
  type SaveDraftOutcome,
} from '@/contracts/sessions';
import { getTrainerContext } from '@/server/context';
import {
  createSessionDraft,
  deleteSessionDraft,
  publishSession,
  reorderSessionDraft,
  saveSessionDraft,
} from '@/server/services/trainer-sessions';

/**
 * Acciones de las sesiones del entrenador. Cada una obtiene el contexto (y con él el actor) y
 * delega en los casos de uso, que comprueban los permisos: nunca se confía en lo que envía el
 * navegador (identificadores, cliente o contenido).
 */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

const sessionsPath = (clientId: string) => `/entrenador/clientes/${clientId}/sesiones`;

/** A4 · Crear el borrador y abrir el constructor. Reenviar el formulario no crea otro. */
export async function createSessionAction(
  _previous: CreateSessionOutcome | null,
  form: FormData,
): Promise<CreateSessionOutcome> {
  const ctx = await getTrainerContext();
  const minutes = text(form, 'estimatedMinutes').trim();
  const outcome = await createSessionDraft(ctx, {
    sessionId: text(form, 'sessionId'),
    clientId: text(form, 'clientId'),
    plannedDate: text(form, 'plannedDate'),
    label: text(form, 'label'),
    title: text(form, 'title'),
    focus: text(form, 'focus'),
    estimatedMinutes: minutes === '' ? null : Number(minutes),
  });
  if (!outcome.ok) return outcome;
  redirect(`${sessionsPath(text(form, 'clientId'))}/${outcome.sessionId}/editar`);
}

/** A5 · Guardar el borrador con la revisión esperada. */
export async function saveDraftAction(input: {
  sessionId: string;
  expectedRevision: number;
  content: unknown;
}): Promise<SaveDraftOutcome> {
  return saveSessionDraft(await getTrainerContext(), input);
}

/** A5 · Publicar la versión 1 (guarda antes lo pendiente). */
export async function publishDraftAction(input: {
  sessionId: string;
  expectedRevision: number;
  content: unknown;
}): Promise<PublishOutcome> {
  return publishSession(await getTrainerContext(), input);
}

/** A3/A5 · Eliminar un borrador que nunca se ha publicado. */
export async function deleteDraftAction(form: FormData) {
  const ctx = await getTrainerContext();
  const result = await deleteSessionDraft(ctx, text(form, 'sessionId'));
  if (result === 'deleted') redirect(sessionsPath(text(form, 'clientId')));
  refresh();
}

/** A3 · Subir o bajar un borrador dentro de su día. */
export async function moveDraftAction(form: FormData) {
  const ctx = await getTrainerContext();
  const direction = text(form, 'direction') === 'up' ? 'up' : 'down';
  await reorderSessionDraft(ctx, text(form, 'sessionId'), direction);
  refresh();
}
