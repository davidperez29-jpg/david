'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type CreateSessionOutcome,
  type PublishOutcome,
  type SaveDraftOutcome,
} from '@/contracts/sessions';
import { getTrainerContext } from '@/server/context';
import { runWrite, writeOutcome } from '@/server/write-operations';
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

/**
 * A4 · Crear el borrador y abrir el constructor. Reenviar el formulario no crea otro: el
 * identificador se emite al mostrarlo. Si la base falla, el resultado se devuelve con lo escrito
 * (B3.0), para que el formulario lo conserve y se pueda volver a enviar sin duplicar.
 */
export async function createSessionAction(
  _previous: CreateSessionOutcome | null,
  form: FormData,
): Promise<CreateSessionOutcome> {
  const minutes = text(form, 'estimatedMinutes').trim();
  const values = {
    plannedDate: text(form, 'plannedDate'),
    label: text(form, 'label'),
    title: text(form, 'title'),
    focus: text(form, 'focus'),
    estimatedMinutes: minutes,
  };
  const outcome = await writeOutcome('Crear la sesión', async () =>
    createSessionDraft(await getTrainerContext(), {
      sessionId: text(form, 'sessionId'),
      clientId: text(form, 'clientId'),
      ...values,
      estimatedMinutes: minutes === '' ? null : Number(minutes),
    }),
  );
  if (!outcome.ok) return { ...outcome, values };
  redirect(`${sessionsPath(text(form, 'clientId'))}/${outcome.sessionId}/editar`);
}

/**
 * Un fallo de almacenamiento (o inesperado) al guardar o publicar se DEVUELVE como resultado, no
 * se lanza (A-05): si se lanzara, la página entera pasaría a la de error y se perdería lo que el
 * entrenador tiene en pantalla. Repetir es seguro: guardar y publicar comprueban la revisión.
 */
const safely = writeOutcome;

/** A5 · Guardar el borrador con la revisión esperada. */
export async function saveDraftAction(input: {
  sessionId: string;
  expectedRevision: number;
  content: unknown;
}): Promise<SaveDraftOutcome> {
  return safely('Guardar el borrador', async () =>
    saveSessionDraft(await getTrainerContext(), input),
  );
}

/** A5 · Publicar la versión 1 (guarda antes lo pendiente). */
export async function publishDraftAction(input: {
  sessionId: string;
  expectedRevision: number;
  content: unknown;
}): Promise<PublishOutcome> {
  return safely('Publicar la sesión', async () => publishSession(await getTrainerContext(), input));
}

/**
 * A3/A5 · Eliminar un borrador que nunca se ha publicado. Si la base falla, la página de error lo
 * explica (B3.0). Repetirlo es seguro: un borrador ya borrado no se borra dos veces.
 */
export async function deleteDraftAction(form: FormData) {
  const result = await runWrite('Eliminar el borrador', async () =>
    deleteSessionDraft(await getTrainerContext(), text(form, 'sessionId')),
  );
  if (result === 'deleted') redirect(sessionsPath(text(form, 'clientId')));
  refresh();
}

/** A3 · Subir o bajar un borrador dentro de su día. */
export async function moveDraftAction(form: FormData) {
  const direction = text(form, 'direction') === 'up' ? 'up' : 'down';
  await runWrite('Mover el borrador', async () =>
    reorderSessionDraft(await getTrainerContext(), text(form, 'sessionId'), direction),
  );
  refresh();
}
