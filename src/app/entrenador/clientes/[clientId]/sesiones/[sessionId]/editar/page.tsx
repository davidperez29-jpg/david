import { ArrowLeft } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SessionBuilder } from '@/features/trainer/session-builder';
import { Badge } from '@/ui/badge';
import { getTrainerContext } from '@/server/context';
import { getPublishedSession, getSessionBuilder } from '@/server/services/trainer-sessions';
import { deleteDraftAction, publishDraftAction, saveDraftAction } from '../../actions';

export const metadata: Metadata = { title: 'Constructor de sesión' };

/** A5 · Constructor de un borrador. Una sesión ya publicada se abre en A7 (bloque 5: editarla). */
export default async function SessionBuilderPage(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones/[sessionId]/editar'>,
) {
  const { clientId, sessionId } = await props.params;
  const ctx = await getTrainerContext();
  const vm = await getSessionBuilder(ctx, sessionId);
  if (!vm || vm.clientId !== clientId) {
    const published = await getPublishedSession(ctx, sessionId);
    if (published && published.clientId === clientId) {
      redirect(`/entrenador/clientes/${clientId}/sesiones/${sessionId}`);
    }
    notFound();
  }
  const base = `/entrenador/clientes/${vm.clientId}/sesiones`;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={base}
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft aria-hidden className="size-4" /> Sesiones
        </Link>
        <h2 className="text-xl font-extrabold text-ink-900">Constructor de sesión</h2>
        <Badge tone="neutral">Borrador · {vm.clientFirstName} aún no lo ve</Badge>
      </div>
      <SessionBuilder
        vm={vm}
        saveAction={saveDraftAction}
        publishAction={publishDraftAction}
        deleteAction={deleteDraftAction}
        publishedHref={`${base}/${vm.sessionId}`}
      />
    </>
  );
}
