import { type NextRequest } from 'next/server';
import { getClientApiContext } from '@/server/context';
import { getClientExecutionState } from '@/server/services/client-execution';

/** Estado confirmado de la ejecución (al volver a la pestaña y al recuperar la conexión). */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/cliente/sesiones/[sessionId]/estado'>,
) {
  const ctx = await getClientApiContext();
  const { sessionId } = await context.params;
  const state = ctx ? await getClientExecutionState(ctx, sessionId) : null;
  return state
    ? Response.json({ ok: true, state }, { headers: { 'cache-control': 'no-store' } })
    : Response.json(
        { ok: false, error: 'not_found', message: 'La sesión no existe o no es tuya.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      );
}
