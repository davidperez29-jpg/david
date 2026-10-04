import { readiness } from '@tp/application';
import { baseContext } from '@/server/context';

/**
 * Readiness (Phase 15, OPERATIONS.md): the database answers and its schema is migrated. A load
 * balancer stops sending traffic while this returns 503. Reveals no data, only counts and timing.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(
      { status: 'ready', ...(await readiness(baseContext())) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
