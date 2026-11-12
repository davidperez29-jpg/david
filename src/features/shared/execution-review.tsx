import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  Clock,
  PencilLine,
  TriangleAlert,
} from 'lucide-react';
import { type ExecutionReviewSetVM, type ExecutionReviewVM } from '@/contracts/execution';
import { formatSeconds } from '@/domain/format';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { cn } from '@/ui/cn';

const STATUS = {
  done: { icon: CircleCheck, label: 'Hecha', tone: 'text-leaf-700' },
  not_done: { icon: CircleMinus, label: 'No realizada', tone: 'text-coral-700' },
  pending: { icon: CircleDashed, label: 'Sin registrar', tone: 'text-ink-500' },
} as const;

const time = (instant: string, timeZone: string) =>
  new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(instant),
  );

/** Duración de inicio a fin; si hubo pausas, también sin ellas. */
export function durationText(review: Pick<ExecutionReviewVM, 'elapsedSeconds' | 'pausedSeconds'>) {
  if (review.elapsedSeconds === null) return null;
  const total = formatSeconds(review.elapsedSeconds);
  return review.pausedSeconds > 0
    ? `${total} (${formatSeconds(Math.max(0, review.elapsedSeconds - review.pausedSeconds))} sin las pausas)`
    : total;
}

function SetRow({
  set,
  audience,
  timeZone,
}: {
  set: ExecutionReviewSetVM;
  audience: 'client' | 'trainer';
  timeZone: string;
}) {
  const status = STATUS[set.status];
  const Icon = status.icon;
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-2.5 py-2.5 text-sm">
      <Icon aria-hidden className={cn('mt-0.5 size-5', status.tone)} />
      <div className="min-w-0">
        <p className="font-semibold text-ink-900">
          Serie {set.setNumber}
          <span className="sr-only">: {status.label}</span>
          {audience === 'trainer' ? (
            <span className="ml-2 text-xs font-semibold text-ink-500">v{set.versionNumber}</span>
          ) : null}
          {set.corrected ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-plum-700">
              <PencilLine aria-hidden className="size-3.5" /> corregida
            </span>
          ) : null}
        </p>
        <dl className="mt-0.5 grid grid-cols-[4.5rem_1fr] gap-x-2 text-ink-700">
          <dt className="text-ink-500">Previsto</dt>
          <dd>{set.prescribed}</dd>
          <dt className="text-ink-500">Hecho</dt>
          <dd
            className={cn(
              'font-semibold',
              set.status === 'pending' ? 'text-ink-500' : 'text-ink-900',
            )}
          >
            {set.performed ?? 'Sin registrar'}
          </dd>
        </dl>
        {set.differences.length > 0 ? (
          <p className="mt-1 inline-flex flex-wrap items-center gap-1 rounded-lg bg-sun-100 px-2 py-0.5 text-xs font-semibold text-sun-800">
            <span aria-hidden>≠</span> {set.differences.join(' · ')}
          </p>
        ) : null}
        {set.previous.length > 0 ? (
          <p className="mt-1 text-xs text-ink-500">Antes: {set.previous.join(' → ')}</p>
        ) : null}
        {set.note ? <p className="mt-1 text-xs text-ink-700">«{set.note}»</p> : null}
        {audience === 'trainer' && set.performedAt ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
            <Clock aria-hidden className="size-3.5" /> {time(set.performedAt, timeZone)}
            {set.clockAdjusted ? ' · hora ajustada (el reloj del móvil iba adelantado)' : ''}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Prescrito frente a realizado, ejercicio a ejercicio y serie a serie. Sin porcentajes ni
 * tonelaje: solo lo previsto, lo hecho y las diferencias en lenguaje claro.
 */
export function ExecutionReview({
  review,
  audience,
  timeZone,
}: {
  review: ExecutionReviewVM;
  audience: 'client' | 'trainer';
  timeZone: string;
}) {
  return (
    <div className="space-y-3">
      {review.items.map((item) => (
        <section
          key={item.id}
          aria-labelledby={`revision-${item.id}`}
          className="rounded-3xl bg-white p-4 shadow-soft"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sun-200 font-display font-extrabold text-sun-800">
              {item.slot}
            </span>
            <ExercisePictogram silhouette={item.silhouette} className="size-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 id={`revision-${item.id}`} className="font-bold text-ink-900">
                {item.name}
              </h3>
              <p className="text-sm text-ink-700">
                <span className="text-ink-500">Prescrito: </span>
                {item.prescribed}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                item.doneSets === item.plannedSets
                  ? 'bg-leaf-100 text-leaf-700'
                  : 'bg-cream-200 text-ink-700',
              )}
            >
              {item.doneSets}/{item.plannedSets}
            </span>
          </div>
          <ol className="mt-2 divide-y divide-line">
            {item.sets.map((set) => (
              <SetRow key={set.setNumber} set={set} audience={audience} timeZone={timeZone} />
            ))}
          </ol>
        </section>
      ))}
      {review.outsideCurrentVersion.length > 0 ? (
        <p className="flex gap-2 rounded-2xl border border-sun-300 bg-sun-100 p-3 text-sm text-ink-700">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-800" />
          <span>
            <span className="font-bold text-ink-900">Fuera de la versión vigente: </span>
            {review.outsideCurrentVersion
              .map((s) => `serie ${s.setNumber} (${s.performed})`)
              .join(', ')}
            . Se registraron con una versión anterior y cuentan como hechas.
          </span>
        </p>
      ) : null}
    </div>
  );
}
