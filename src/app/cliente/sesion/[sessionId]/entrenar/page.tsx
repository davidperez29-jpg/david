import { ArrowLeft, Clock, FlaskConical, MessageCircle } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRelativeDay } from '@/domain/format';
import { SessionPlayer } from '@/features/client/session-player';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Notice } from '@/ui/notice';
import { getClientContext } from '@/server/context';
import { getClientSession } from '@/server/services/client';

export const metadata: Metadata = { title: 'Entrenar' };

/**
 * Reproductor de la Fase 1, que se mantiene en el bloque 1 (V1_SPEC §9.1 E). TODAVÍA NO GUARDA:
 * el registro guardado y el reproductor por pasos llegan en el bloque 2.
 */
export default async function ClientTrainPage(
  props: PageProps<'/cliente/sesion/[sessionId]/entrenar'>,
) {
  const { sessionId } = await props.params;
  const ctx = await getClientContext();
  // Devuelve null tanto si no existe como si es de otro cliente: no se revela cuál de las dos.
  const session = await getClientSession(ctx, sessionId);
  if (!session) notFound();

  return (
    <main id="contenido" className="px-4 pt-4 pb-32">
      <Link
        href={`/cliente/sesion/${session.id}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-2xl pr-3 text-sm font-semibold text-ink-700 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Detalle de la sesión
      </Link>
      <Notice
        tone="sun"
        icon={<FlaskConical />}
        title="Lo que marques aquí todavía no se guarda"
        className="mt-2"
      >
        Puedes probar el registro, pero al salir o recargar se pierde. El registro guardado, con
        cada serie confirmada por el servidor, llega en la próxima entrega.
      </Notice>
      <header className="mt-2">
        <p className="text-sm font-semibold text-sun-700">
          {formatRelativeDay(session.date, ctx.today)}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-extrabold text-ink-900">{session.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <span>{session.focus}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-4" /> {session.estimatedMinutes} min
          </span>
          {session.status !== 'pending' ? <SessionStatusBadge status={session.status} /> : null}
        </div>
      </header>
      {session.coachNote ? (
        <div className="mt-4 flex gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
          <p className="text-sm text-ink-700">
            <span className="font-bold text-ink-900">Nota de tu entrenador: </span>
            {session.coachNote}
          </p>
        </div>
      ) : null}
      <div className="mt-2">
        <SessionPlayer session={session} />
      </div>
    </main>
  );
}
