import { type NextRequest } from 'next/server';
import { COMMAND_HTTP_STATUS } from '@/contracts/execution';
import { getClientApiContext } from '@/server/context';
import { commandErrorMessage, getClientExecutionState } from '@/server/services/client-execution';
import { classifyStorageError, RETRY_AFTER_SECONDS } from '@/server/storage-errors';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Estado confirmado de la ejecución (al volver a la pestaña y al recuperar la conexión). Es una
 * lectura: si la base falla, responde con el error tipado (B3.0) en lugar de un 500 genérico, y
 * sin datos de nadie. El móvil conserva lo que tenga y lo vuelve a pedir más tarde.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/cliente/sesiones/[sessionId]/estado'>,
) {
  try {
    const ctx = await getClientApiContext();
    const { sessionId } = await context.params;
    const state = ctx ? await getClientExecutionState(ctx, sessionId) : null;
    return state
      ? Response.json({ ok: true, state }, { headers: NO_STORE })
      : Response.json(
          { ok: false, error: 'not_found', message: 'La sesión no existe o no es tuya.' },
          { status: 404, headers: NO_STORE },
        );
  } catch (cause) {
    const failure = classifyStorageError(cause);
    if (failure) {
      console.error(`Estado de la ejecución no disponible (${failure}):`, (cause as Error).message);
      const retryAfter = RETRY_AFTER_SECONDS[failure];
      return Response.json(
        { ok: false, error: failure, message: commandErrorMessage(failure) },
        {
          status: COMMAND_HTTP_STATUS[failure],
          headers: { ...NO_STORE, ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}) },
        },
      );
    }
    console.error('Error inesperado al leer el estado de la ejecución', (cause as Error).message);
    return Response.json(
      { ok: false, error: 'server_error', message: 'No se ha podido leer el estado.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
