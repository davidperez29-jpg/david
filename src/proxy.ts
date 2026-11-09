import { type NextRequest, NextResponse } from 'next/server';
import { isAllowedRequest, parseAllowedHosts } from '@/server/host-guard';

/**
 * Protección del prototipo local (P-87): rechaza con `403` cualquier petición cuyo `Host` no sea
 * uno de los permitidos (`TRAINPRO_ALLOWED_HOSTS`; por defecto, `localhost` y `127.0.0.1`).
 * Se aplica a todas las rutas, también a los archivos estáticos y a las acciones de servidor.
 * No es autenticación: el servidor, además, solo escucha en 127.0.0.1 (`-H 127.0.0.1`).
 */
export function proxy(request: NextRequest) {
  const allowed = parseAllowedHosts(process.env.TRAINPRO_ALLOWED_HOSTS);
  if (!isAllowedRequest(request.headers, allowed)) {
    return new NextResponse('Host no permitido. TrainPro solo atiende en este equipo.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return NextResponse.next();
}
