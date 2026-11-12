import { type NextRequest } from 'next/server';
import { COMMAND_HTTP_STATUS, type CommandResponse } from '@/contracts/execution';
import { getClientApiContext } from '@/server/context';
import { executeClientCommand } from '@/server/services/client-execution';
import { parseClientCommand } from '@/server/services/command-parser';

/**
 * API de comandos del cliente (V1_SPEC §8.4, docs/EXECUTION.md): un comando por petición, JSON y
 * del mismo origen. Una URL estable para que la cola del reproductor pueda reintentar (las
 * acciones de servidor cambian de identificador al compilar).
 */
const MAX_BYTES = 16 * 1024;

const reply = (
  status: number,
  body: CommandResponse | { ok: false; error: string; message: string },
) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

const error = (status: number, code: string, message: string, extra: object = {}) =>
  reply(status, { ok: false, error: code, message, ...extra } as CommandResponse);

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/cliente/sesiones/[sessionId]/comandos'>,
) {
  // Mismo origen: el navegador siempre envía `Origin` en un POST con fetch.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  let sameOrigin = false;
  try {
    sameOrigin = origin !== null && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return error(403, 'forbidden_origin', 'Origen no permitido.');

  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) {
    return error(413, 'payload_too_large', 'El comando supera 16 KB.');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return error(COMMAND_HTTP_STATUS.bad_request, 'bad_request', 'El cuerpo no es JSON válido.');
  }
  const parsed = parseClientCommand(json);
  if (!parsed.ok) {
    return error(
      COMMAND_HTTP_STATUS.bad_request,
      'bad_request',
      'El comando no tiene la forma esperada.',
      {
        issues: parsed.issues,
      },
    );
  }

  const ctx = await getClientApiContext();
  if (!ctx)
    return error(COMMAND_HTTP_STATUS.not_found, 'not_found', 'La sesión no existe o no es tuya.');
  const { sessionId } = await context.params;
  try {
    const outcome = await executeClientCommand(ctx, sessionId, parsed.command);
    return reply(outcome.status, outcome.body);
  } catch (cause) {
    console.error('Error inesperado al aplicar un comando de ejecución', (cause as Error).message);
    return error(500, 'server_error', 'No se ha podido guardar. Se reintentará.');
  }
}
