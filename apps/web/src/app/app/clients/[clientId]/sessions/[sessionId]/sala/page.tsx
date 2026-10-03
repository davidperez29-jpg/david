import { getPlayerSession } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Player } from '@/components/sessions/player';
import { requireStaff } from '@/server/session';

/** Room mode (§9.6): the trainer logs the session on behalf of the client, same player. */
export default async function RoomModePage({
  params,
}: {
  params: Promise<{ clientId: string; sessionId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, sessionId } = await params;
  const s = await getPlayerSession(ctx, sessionId).catch((e) => {
    if (e instanceof DomainError && (e.code === 'not_found' || e.code === 'validation')) notFound();
    throw e;
  });
  if (s.clientId !== clientId) notFound();
  return (
    <div className="mx-auto max-w-lg">
      <Player
        session={s}
        mode="trainer"
        backHref={`/app/clients/${clientId}/sessions/${sessionId}`}
      />
    </div>
  );
}
