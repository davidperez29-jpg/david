import { ArrowLeft, Clock, MessageCircle } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/domain/format';
import { ExecutionReview, durationText } from '@/features/shared/execution-review';
import { PendingFeature } from '@/features/shared/pending-feature';
import { PrescriptionList } from '@/features/shared/prescription-list';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { executedOnText } from '@/features/trainer/session-days';
import { Badge } from '@/ui/badge';
import { getTrainerContext } from '@/server/context';
import { getPublishedSession } from '@/server/services/trainer-sessions';

export const metadata: Metadata = { title: 'Sesión publicada' };

const instant = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));

/** A7 · Sesión publicada, pestaña Prescripción (solo lectura). */
export default async function PublishedSessionPage(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones/[sessionId]'>,
) {
  const { clientId, sessionId } = await props.params;
  const ctx = await getTrainerContext();
  const vm = await getPublishedSession(ctx, sessionId);
  if (!vm || vm.clientId !== clientId) notFound();
  const executed = executedOnText(vm.execution);

  return (
    <>
      <Link
        href={`/entrenador/clientes/${vm.clientId}/sesiones`}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Sesiones
      </Link>
      <header className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-sun-800 first-letter:uppercase">
          {formatDate(vm.plannedDate, 'long')}
          {vm.label ? ` · ${vm.label}` : ''} · {vm.dayOrder}.ª del día
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink-900">{vm.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-700">
          {vm.focus}
          {vm.estimatedMinutes ? (
            <span className="inline-flex items-center gap-1 text-sm text-ink-500">
              <Clock aria-hidden className="size-4" /> {vm.estimatedMinutes} min
            </span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="leaf">
            Versión vigente {vm.version.number} · {vm.version.publishedBy} ·{' '}
            {instant(vm.version.publishedAt, ctx.timeZone)}
          </Badge>
          <ExecutionStatusBadge status={vm.execution.status} />
          <span className="text-sm text-ink-500">
            {vm.execution.completedSets} de {vm.execution.plannedSets} series
          </span>
          {vm.hasUnpublishedChanges ? <Badge tone="sun">Cambios sin publicar</Badge> : null}
        </div>
        {vm.execution.startedAt ? (
          <p className="mt-2 text-sm text-ink-700">
            Empezada el {instant(vm.execution.startedAt, ctx.timeZone)}
            {vm.execution.finishedAt
              ? ` · terminada el ${instant(vm.execution.finishedAt, ctx.timeZone)}`
              : ''}
            {executed ? ` · ${executed}` : ''}
          </p>
        ) : null}
      </header>

      {vm.coachNote ? (
        <div className="mt-4 flex gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
          <p className="text-sm text-ink-700">
            <span className="font-bold text-ink-900">Nota para {vm.clientFirstName}: </span>
            {vm.coachNote}
          </p>
        </div>
      ) : null}

      {vm.review ? (
        <section aria-labelledby="ejecucion" className="mt-6">
          <h2 id="ejecucion" className="text-lg font-bold text-ink-900">
            Ejecución: prescrito frente a realizado
          </h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-ink-500">Series</dt>
              <dd className="font-semibold text-ink-900">
                {vm.review.completedSets} de {vm.review.plannedSets} hechas
                {vm.review.notDoneSets > 0
                  ? ` · ${vm.review.notDoneSets} no ${vm.review.notDoneSets === 1 ? 'realizada' : 'realizadas'}`
                  : ''}
                {vm.review.pendingSets > 0 ? ` · ${vm.review.pendingSets} sin registrar` : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Versiones</dt>
              <dd className="font-semibold text-ink-900">
                empezada con la v{vm.review.startedVersion}
                {vm.review.versionsUsed.length > 0
                  ? ` · series registradas con ${vm.review.versionsUsed.map((v) => `v${v}`).join(' y ')}`
                  : ''}
              </dd>
            </div>
            {durationText(vm.review) ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Duración</dt>
                <dd className="font-semibold text-ink-900">{durationText(vm.review)}</dd>
              </div>
            ) : null}
            {vm.review.finishReason ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Cierre</dt>
                <dd className="font-semibold text-ink-900">
                  {vm.review.finishReason === 'all_done'
                    ? 'Completada'
                    : 'Cerrada parcialmente por la clienta'}
                </dd>
              </div>
            ) : null}
          </dl>
          {vm.review.finishReason === null ? (
            <p className="mt-2 text-xs text-ink-500">
              Solo se muestra lo confirmado por el servidor. Lo que {vm.clientFirstName} registre
              sin conexión aparecerá aquí cuando su móvil lo envíe.
            </p>
          ) : null}
          {vm.review.comment ? (
            <p className="mt-3 flex gap-3 rounded-3xl bg-white p-4 text-sm text-ink-700 shadow-soft">
              <MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
              <span>
                <span className="font-bold text-ink-900">Mensaje de {vm.clientFirstName}: </span>
                {vm.review.comment}
              </span>
            </p>
          ) : null}
          <div className="mt-3">
            <ExecutionReview review={vm.review} audience="trainer" timeZone={ctx.timeZone} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="prescripcion" className="mt-6">
        <h2 id="prescripcion" className="text-lg font-bold text-ink-900">
          Prescripción (versión vigente)
        </h2>
        <PrescriptionList items={vm.items} className="mt-3" />
      </section>

      <div className="mt-6">
        <PendingFeature
          title="Editar la sesión publicada, versiones y análisis"
          phase="V1 · bloques 3 y 5"
          items={[
            'Editar: borrador de cambios con lo registrado bloqueado y publicar la versión 2',
            'Historial de versiones con el resumen de cambios',
            'Análisis de la sesión: totales por tipo (series, repeticiones y tonelaje) con sus fórmulas',
          ]}
        >
          El modelo ya guarda cada versión publicada sin modificarla y cada serie registrada con su
          versión; la interfaz para editarlas y el análisis llegan en los bloques siguientes.
        </PendingFeature>
      </div>
    </>
  );
}
