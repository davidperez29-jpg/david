/**
 * Motor de envío de la cola local (docs/EXECUTION.md). Lo usan el reproductor y el aviso de
 * pendientes de las demás pantallas del cliente, con un cerrojo por sesión para que nunca haya
 * dos envíos a la vez de la misma cola (el orden de las operaciones se mantiene).
 */
import { type CommandResponse, type ExecutionStateVM } from '@/contracts/execution';
import { type LocalStore } from './local-store';

const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];
const TIMEOUT_MS = 15_000;
const busy = new Set<string>();

export interface FlushHandlers {
  /** Estado confirmado por el servidor tras un comando. */
  onState?: (state: ExecutionStateVM) => void;
  /** Aviso breve de una reconciliación. */
  onNotice?: (message: string) => void;
  /** La cola ha cambiado (para volver a leerla). */
  onChange?: () => void;
  /** Respuesta (o falta de respuesta) del servidor. */
  onNetwork?: (reachable: boolean) => void;
}

export const commandsUrl = (sessionId: string) =>
  `/api/cliente/sesiones/${encodeURIComponent(sessionId)}/comandos`;
export const stateUrl = (sessionId: string) =>
  `/api/cliente/sesiones/${encodeURIComponent(sessionId)}/estado`;

/**
 * Envía en orden los comandos pendientes de una sesión. Devuelve cuánto esperar antes del
 * siguiente intento (si un fallo de red obliga a esperar), o `null` si no queda nada que enviar
 * ahora (o si otra parte de la app ya está enviando esa cola).
 */
export async function flushSession(
  store: LocalStore,
  sessionId: string,
  handlers: FlushHandlers = {},
): Promise<{ waitMs: number | null }> {
  if (busy.has(sessionId)) return { waitMs: null };
  busy.add(sessionId);
  try {
    for (;;) {
      const next = (await store.list(sessionId)).find((e) => e.status !== 'error');
      if (!next) return { waitMs: null };
      const wait = next.nextAttemptAt - Date.now();
      if (wait > 0) return { waitMs: wait };
      await store.put({ ...next, status: 'sending' });
      handlers.onChange?.();

      let response: Response | null = null;
      try {
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), TIMEOUT_MS);
        response = await fetch(commandsUrl(sessionId), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(next.command),
          signal: controller.signal,
        });
        clearTimeout(abort);
      } catch {
        response = null;
      }

      if (!response || response.status >= 500 || response.status === 408) {
        // Fallo de red o del servidor: sigue en el dispositivo y se reintenta, en orden.
        const attempts = next.attempts + 1;
        const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]!;
        await store.put({ ...next, status: 'queued', attempts, nextAttemptAt: Date.now() + delay });
        handlers.onChange?.();
        handlers.onNetwork?.(false);
        return { waitMs: delay };
      }

      handlers.onNetwork?.(true);
      const body = (await response.json().catch(() => null)) as CommandResponse | null;
      if (body?.ok) {
        await store.remove(next.commandId);
        handlers.onState?.(body.state);
      } else if (body && !body.ok && body.error === 'set_already_logged') {
        // Otro envío (u otro dispositivo) ya registró esa serie: manda lo del servidor.
        await store.remove(next.commandId);
        if (body.state) handlers.onState?.(body.state);
        handlers.onNotice?.(
          'Esa serie ya estaba registrada: se muestra la que guardó el servidor.',
        );
      } else {
        // Rechazo (4xx): no se descarta en silencio; queda visible con el motivo.
        await store.put({
          ...next,
          status: 'error',
          error: {
            code: body && !body.ok ? body.error : `http_${response.status}`,
            message: body && !body.ok ? body.message : 'El servidor no ha aceptado este registro.',
            ...(body && !body.ok && body.issues ? { issues: body.issues } : {}),
          },
        });
        if (body && !body.ok && body.state) handlers.onState?.(body.state);
      }
      handlers.onChange?.();
    }
  } finally {
    busy.delete(sessionId);
  }
}
