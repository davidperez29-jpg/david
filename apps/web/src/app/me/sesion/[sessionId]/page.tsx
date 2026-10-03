import { getPlayerSession } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Player } from '@/components/sessions/player';
import { requireClientUser } from '@/server/session';

export default async function ClientSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const ctx = await requireClientUser();
  const { sessionId } = await params;
  const session = await getPlayerSession(ctx, sessionId).catch((e) => {
    if (e instanceof DomainError && (e.code === 'not_found' || e.code === 'validation')) notFound();
    throw e;
  });
  return <Player session={session} mode="client" backHref="/me" />;
}
