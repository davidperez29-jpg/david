import { ArrowDown, ArrowUp, CalendarPlus, Eye, PencilLine, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  type SessionDayVM,
  type TrainerSessionRowVM,
  type ExecutionVM,
} from '@/contracts/sessions';
import { formatDate } from '@/domain/format';
import { ConfirmSubmit } from '@/features/shared/confirm-submit';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

type FormAction = (form: FormData) => void | Promise<void>;

/** «Hecha el viernes (1 día después)», si se empezó otro día distinto del previsto. */
export function executedOnText(execution: ExecutionVM): string | null {
  if (!execution.executedOn || !execution.daysFromPlanned) return null;
  const days = Math.abs(execution.daysFromPlanned);
  const when = execution.daysFromPlanned > 0 ? 'después' : 'antes';
  return `Hecha el ${formatDate(execution.executedOn, 'weekday')} (${days} ${days === 1 ? 'día' : 'días'} ${when})`;
}

/**
 * A3 · Sesiones de un cliente agrupadas por fecha prevista, cada una con su orden y su contexto
 * en el día, sus insignias de publicación y su estado de ejecución.
 */
export function SessionDays({
  days,
  clientId,
  clientFirstName,
  empty,
  moveAction,
  deleteAction,
}: {
  days: SessionDayVM<TrainerSessionRowVM>[];
  clientId: string;
  clientFirstName: string;
  empty: string;
  moveAction: FormAction;
  deleteAction: FormAction;
}) {
  if (days.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
  const base = `/entrenador/clientes/${clientId}/sesiones`;
  return (
    <ol className="space-y-5">
      {days.map((day) => (
        <li key={day.date} aria-labelledby={`dia-${day.date}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1.5">
            <h3 id={`dia-${day.date}`} className="font-bold text-ink-900 first-letter:uppercase">
              {formatDate(day.date, 'long')}
              <span className="ml-2 text-sm font-semibold text-ink-500">
                {day.sessions.length} {day.sessions.length === 1 ? 'sesión' : 'sesiones'}
              </span>
            </h3>
            <Link
              href={`${base}/nueva?fecha=${day.date}`}
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-sun-800 hover:text-ink-900"
            >
              <CalendarPlus aria-hidden className="size-4" /> Añadir sesión a este día
              <span className="sr-only"> ({formatDate(day.date, 'long')})</span>
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {day.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                base={base}
                clientId={clientId}
                clientFirstName={clientFirstName}
                moveAction={moveAction}
                deleteAction={deleteAction}
              />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function SessionRow({
  session,
  base,
  clientId,
  clientFirstName,
  moveAction,
  deleteAction,
}: {
  session: TrainerSessionRowVM;
  base: string;
  clientId: string;
  clientFirstName: string;
  moveAction: FormAction;
  deleteAction: FormAction;
}) {
  const name = session.label ? `${session.label} · ${session.title}` : session.title;
  const executed = session.execution ? executedOnText(session.execution) : null;
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ink-900">
          <span className="mr-1.5 text-sm text-ink-500 tabular-nums">{session.dayOrder}.</span>
          {session.label ? <span className="text-sun-800">{session.label} · </span> : null}
          {session.title}
        </p>
        <p className="text-sm text-ink-500">
          {session.focus ? `${session.focus} · ` : ''}
          {session.exerciseCount} {session.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
          {session.execution
            ? ` · ${session.execution.completedSets} de ${session.execution.plannedSets} series`
            : ''}
          {executed ? ` · ${executed}` : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {session.publication === 'draft' ? (
            <Badge tone="neutral">Borrador</Badge>
          ) : (
            <Badge tone="leaf">Publicada v{session.version}</Badge>
          )}
          {session.hasUnpublishedChanges ? <Badge tone="sun">Cambios sin publicar</Badge> : null}
          {session.execution ? <ExecutionStatusBadge status={session.execution.status} /> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {session.canMoveUp || session.canMoveDown ? (
          <form action={moveAction} className="flex gap-1">
            <input type="hidden" name="sessionId" value={session.id} />
            <Button
              type="submit"
              name="direction"
              value="up"
              variant="ghost"
              size="sm"
              disabled={!session.canMoveUp}
              aria-label={`Subir «${name}» en el día`}
            >
              <ArrowUp aria-hidden className="size-4" />
            </Button>
            <Button
              type="submit"
              name="direction"
              value="down"
              variant="ghost"
              size="sm"
              disabled={!session.canMoveDown}
              aria-label={`Bajar «${name}» en el día`}
            >
              <ArrowDown aria-hidden className="size-4" />
            </Button>
          </form>
        ) : null}
        {session.publication === 'draft' ? (
          <Link
            href={`${base}/${session.id}/editar`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink-900 hover:border-ink-300"
            aria-label={`Editar «${name}»`}
          >
            <PencilLine aria-hidden className="size-4" /> Editar
          </Link>
        ) : (
          <Link
            href={`${base}/${session.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink-900 hover:border-ink-300"
            aria-label={`Ver «${name}»`}
          >
            <Eye aria-hidden className="size-4" /> Ver
          </Link>
        )}
        {session.canDelete ? (
          <form action={deleteAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="clientId" value={clientId} />
            <ConfirmSubmit
              variant="ghost"
              size="sm"
              message={`¿Eliminar el borrador «${name}»? ${clientFirstName} nunca lo ha visto. No se puede deshacer.`}
              aria-label={`Eliminar el borrador «${name}»`}
            >
              <Trash2 aria-hidden className="size-4" /> Eliminar
            </ConfirmSubmit>
          </form>
        ) : null}
      </div>
    </li>
  );
}
