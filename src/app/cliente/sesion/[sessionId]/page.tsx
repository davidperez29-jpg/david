import { ArrowLeft, ArrowRight, Clock, MessageCircle } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { ExecutionReview, durationText } from '@/features/shared/execution-review';
import { PrescriptionList } from '@/features/shared/prescription-list';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { Badge } from '@/ui/badge';
import { getClientContext } from '@/server/context';
import { readServerEnv } from '@/server/env';
import { getClientSessionDetail } from '@/server/services/client-sessions';

export const metadata: Metadata = { title: 'Sesión' };

const FINISHED = new Set(['completed', 'partial']);

/** B2 · Detalle de una sesión publicada (solo la versión vigente y sin notas privadas). */
export default async function ClientSessionPage(props: PageProps<'/cliente/sesion/[sessionId]'>) {
  const { sessionId } = await props.params;
  // `null` tanto si no existe como si es de otra persona o no está publicada: no se revela.
  const session = await getClientSessionDetail(await getClientContext(), sessionId);
  if (!session) notFound();
  const { execution } = session;
  const finished = FINISHED.has(execution.status);
  const active =
    execution.status === 'in_progress' ||
    execution.status === 'paused' ||
    execution.status === 'interrupted';
  const review = session.review;
  const timeZone = readServerEnv().timeZone;
  const otherDay = session.plannedDate !== session.today;

  return (
    <main id="contenido" className="px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <Link
        href="/cliente"
        className="inline-flex h-11 items-center gap-1.5 rounded-2xl pr-3 text-sm font-semibold text-ink-700 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Hoy
      </Link>
      <header className="mt-2">
        <p className="text-sm font-semibold text-sun-700 first-letter:uppercase">
          {formatRelativeDay(session.plannedDate, session.today)}
          {session.label ? ` · ${session.label}` : ''}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-extrabold text-ink-900">{session.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <span>{session.focus}</span>
          {session.estimatedMinutes ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-4" /> {session.estimatedMinutes} min
              </span>
            </>
          ) : null}
          {execution.status !== 'planned' && execution.status !== 'overdue' ? (
            <ExecutionStatusBadge status={execution.status} />
          ) : null}
          {session.updatedBy ? (
            <Badge tone="outline">Actualizada por {session.updatedBy}</Badge>
          ) : null}
        </div>
        {execution.startedAt ? (
          <p className="mt-2 text-sm font-semibold text-ink-700">
            {execution.completedSets} de {execution.plannedSets} series hechas
          </p>
        ) : null}
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

      {review ? (
        <section aria-labelledby="resumen" className="mt-6">
          <h2 id="resumen" className="text-lg font-bold text-ink-900">
            {finished
              ? review.completedSets === review.plannedSets
                ? '¡Sesión completada!'
                : 'Sesión terminada parcialmente'
              : 'Lo que llevas'}
          </h2>
          <p className="mt-1 text-sm text-ink-700">
            {review.completedSets} de {review.plannedSets} series hechas
            {review.notDoneSets > 0 ? ` · ${review.notDoneSets} no realizadas` : ''}
            {review.pendingSets > 0 ? ` · ${review.pendingSets} sin registrar` : ''}
            {durationText(review) ? ` · Duración: ${durationText(review)}` : ''}
          </p>
          {review.comment ? (
            <p className="mt-2 text-sm text-ink-700">
              <span className="font-semibold text-ink-900">Tu mensaje: </span>«{review.comment}»
            </p>
          ) : null}
          <div className="mt-3">
            <ExecutionReview review={review} audience="client" timeZone={timeZone} />
          </div>
        </section>
      ) : (
        <section aria-labelledby="ejercicios" className="mt-6">
          <h2 id="ejercicios" className="text-lg font-bold text-ink-900">
            {session.exerciseCount} {session.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
          </h2>
          <PrescriptionList items={session.items} className="mt-3" />
        </section>
      )}

      {finished ? null : (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-cream-100/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-md">
            {otherDay && !active ? (
              <p className="mb-2 text-center text-sm text-ink-700">
                Prevista para el {formatDate(session.plannedDate, 'long')}. ¿Empezar ahora?
              </p>
            ) : null}
            <Link
              href={`/cliente/sesion/${session.id}/entrenar`}
              className="flex h-14 items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 hover:bg-ink-700"
            >
              {active ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
