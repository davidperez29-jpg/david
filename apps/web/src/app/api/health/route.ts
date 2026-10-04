/**
 * Liveness (Phase 15, OPERATIONS.md): the process answers. No database, no data, no auth.
 * Outside /api/v1 on purpose: it is not part of the versioned API.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', version: process.env.APP_VERSION ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
