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
 * Un suceso que indica que puede haber conexión (abrir la app, recuperar la red, volver a la
 * pestaña o «Reintentar») anula la espera entre reintentos: lo pendiente se intenta ya. La espera
 * creciente solo separa los fallos seguidos mientras nada cambia.
 */
export async function resetBackoff(
  store: LocalStore,
  owner: string,
  sessionId: string,
): Promise<void> {
  for (const entry of await store.list(owner, sessionId)) {
    if (entry.status === 'queued' && entry.nextAttemptAt > 0) {
      await store.put({ ...entry, nextAttemptAt: 0 });
    }
  }
}

/**
 * Errores que pueden resolverse reintentando el MISMO comando (mismo identificador: si ya se
 * hubiera aplicado, el servidor responde «ya aplicado»). Los demás (datos no válidos, sesión
 * cerrada, serie inexistente…) necesitan que la persona decida: descartar y volver a registrar.
 */
const RECOVERABLE_ERRORS = new Set([
  'not_found',
  'not_started',
  'server_error',
  'storage_busy',
  'storage_unavailable',
  'http_404',
  'http_408',
  'http_429',
]);
export const isRecoverableError = (code: string | undefined) =>
  code !== undefined && RECOVERABLE_ERRORS.has(code);

/**
 * «Reintentar» (A-09): los comandos con un error recuperable vuelven a la cola, con su
 * identificador original. Los no recuperables se quedan como están (nunca se borran sin que la
 * persona lo decida). Devuelve cuántos se han vuelto a poner en cola.
 */
export async function retryRecoverable(
  store: LocalStore,
  owner: string,
  sessionId: string,
): Promise<number> {
  let n = 0;
  for (const entry of await store.list(owner, sessionId)) {
    if (entry.status === 'error' && isRecoverableError(entry.error?.code)) {
      const { error: _previous, ...rest } = entry;
      await store.put({ ...rest, status: 'queued', attempts: 0, nextAttemptAt: 0 });
      n += 1;
    }
  }
  return n;
}

/**
 * Envía en orden los comandos pendientes de `owner` en una sesión (nunca los de otra persona: la
 * consulta del almacén ya los excluye, y el servidor rechaza un comando de otra identidad).
 * Devuelve cuánto esperar antes del siguiente intento (si un fallo de red obliga a esperar), o
 * `null` si no queda nada que enviar ahora (o si otra parte de la app ya está enviando esa cola).
 */
export async function flushSession(
  store: LocalStore,
  owner: string,
  sessionId: string,
  handlers: FlushHandlers = {},
): Promise<{ waitMs: number | null }> {
  const key = `${owner}:${sessionId}`;
  if (busy.has(key)) return { waitMs: null };
  busy.add(key);
  try {
    for (;;) {
      const next = (await store.list(owner, sessionId)).find((e) => e.status !== 'error');
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
      } else if (body && !body.ok && body.error === 'identity_mismatch') {
        // La identidad del navegador ya no es la que creó el comando (se cambió en otra pestaña):
        // no se aplica a nadie y sigue guardado, a la espera de su titular.
        await store.put({ ...next, status: 'queued', nextAttemptAt: Date.now() + 30_000 });
        handlers.onChange?.();
        handlers.onNotice?.(
          'Hay registros de otra persona en este dispositivo: se enviarán cuando vuelva a entrar.',
        );
        return { waitMs: 30_000 };
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
    busy.delete(key);
  }
}
