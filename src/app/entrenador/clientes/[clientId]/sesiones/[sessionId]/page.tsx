import { ArrowLeft, Clock, MessageCircle } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/domain/format';
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

      <section aria-labelledby="prescripcion" className="mt-6">
        <h2 id="prescripcion" className="text-lg font-bold text-ink-900">
          Prescripción
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
            'Análisis de la sesión: prescrito frente a realizado',
          ]}
        >
          El modelo ya guarda cada versión publicada sin modificarla; la interfaz para editarlas
          llega en los bloques siguientes.
        </PendingFeature>
      </div>
    </>
  );
}
