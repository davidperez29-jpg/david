import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Dumbbell,
  Layers,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { type ClientSessionLineVM } from '@/contracts/sessions';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { RestIllustration } from '@/features/brand/illustrations';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { Badge } from '@/ui/badge';
import { Meter } from '@/ui/meter';
import { getClientContext } from '@/server/context';
import { getClientToday } from '@/server/services/client-sessions';

const ACTION_LABEL = {
  start: 'Empezar entrenamiento',
  continue: 'Continuar entrenamiento',
  summary: 'Ver resumen',
} as const;

const sessionName = (s: Pick<ClientSessionLineVM, 'label' | 'title'>) =>
  s.label ? `${s.label} · ${s.title}` : s.title;

/** B1 · Hoy: el entrenamiento del día es lo primero, y se empieza con un toque. */
export default async function ClientTodayPage() {
  const ctx = await getClientContext();
  const home = await getClientToday(ctx);
  const hero = home.hero;
  const heroHref = hero
    ? hero.action === 'summary'
      ? `/cliente/sesion/${hero.id}`
      : `/cliente/sesion/${hero.id}/entrenar`
    : null;

  return (
    <>
      <p className="text-sm font-semibold text-sun-700 first-letter:uppercase">
        {formatDate(home.today, 'long')}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink-900">Hola, {home.firstName}</h1>

      {hero && heroHref ? (
        <section
          aria-labelledby="sesion-hoy"
          className="mt-5 overflow-hidden rounded-[2rem] bg-sun-400 shadow-lift"
        >
          <div className="relative p-6 pb-5">
            <ExercisePictogram
              silhouette={hero.preview[0]?.silhouette ?? 'squat'}
              className="absolute -top-2 -right-3 size-36 opacity-15"
            />
            <p className="text-sm font-bold tracking-wide text-ink-900/70 uppercase">
              {hero.plannedDate === home.today
                ? hero.label
                  ? `Hoy · ${hero.label}`
                  : 'Hoy toca'
                : `Pendiente · ${formatRelativeDay(hero.plannedDate, home.today)}`}
            </p>
            <h2
              id="sesion-hoy"
              className="mt-1 pr-10 text-[1.9rem] leading-tight font-extrabold text-ink-900"
            >
              {hero.title}
            </h2>
            <p className="mt-1 text-ink-700">{hero.focus}</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-ink-900">
              {hero.estimatedMinutes ? (
                <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                  <Clock aria-hidden className="size-4" /> {hero.estimatedMinutes} min
                </li>
              ) : null}
              <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                <Dumbbell aria-hidden className="size-4" /> {hero.exerciseCount}{' '}
                {hero.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                <Layers aria-hidden className="size-4" /> {hero.execution.plannedSets}{' '}
                {hero.execution.plannedSets === 1 ? 'serie' : 'series'}
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {hero.execution.status !== 'planned' ? (
                <ExecutionStatusBadge status={hero.execution.status} />
              ) : null}
              {hero.updatedBy ? (
                <Badge tone="outline">Actualizada por {hero.updatedBy}</Badge>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 px-4 pb-4">
            <Link
              href={heroHref}
              className="flex min-h-16 items-center justify-center gap-2 rounded-3xl bg-ink-900 px-5 py-3 text-center text-lg leading-snug font-bold text-balance text-cream-50 transition-colors hover:bg-ink-700"
            >
              {ACTION_LABEL[hero.action]}
              {hero.action === 'continue'
                ? ` · ${hero.execution.completedSets} de ${hero.execution.plannedSets} series`
                : ''}
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Link>
            {hero.action !== 'summary' ? (
              <Link
                href={`/cliente/sesion/${hero.id}`}
                className="flex h-12 items-center justify-center rounded-2xl text-sm font-semibold text-ink-900 hover:bg-white/40"
              >
                Ver el detalle de la sesión
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="descanso"
          className="mt-5 flex flex-col items-center rounded-[2rem] bg-white p-6 text-center shadow-soft"
        >
          <RestIllustration />
          <h2 id="descanso" className="mt-2 text-2xl font-extrabold text-ink-900">
            Hoy toca descansar
          </h2>
          <p className="mt-1 text-ink-500">Recuperar también es parte del entrenamiento.</p>
        </section>
      )}

      {hero?.coachNote ? (
        <div className="mt-4 flex gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
          <p className="text-sm text-ink-700">
            <span className="font-bold text-ink-900">Nota de tu entrenador: </span>
            {hero.coachNote}
          </p>
        </div>
      ) : null}

      {home.alsoToday.length > 0 ? (
        <section aria-labelledby="tambien-hoy" className="mt-6">
          <h2 id="tambien-hoy" className="text-lg font-bold text-ink-900">
            También hoy
          </h2>
          <SessionLines sessions={home.alsoToday} today={home.today} />
        </section>
      ) : null}

      {hero && hero.action !== 'summary' ? (
        <section aria-labelledby="en-esta-sesion" className="mt-6">
          <h2 id="en-esta-sesion" className="text-lg font-bold text-ink-900">
            En esta sesión
          </h2>
          <ol className="mt-3 divide-y divide-line rounded-3xl bg-white px-4 shadow-soft">
            {hero.preview.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="font-semibold text-ink-900">{item.name}</span>
                <span className="shrink-0 text-sm font-semibold text-ink-500 tabular-nums">
                  {item.setsAndReps}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {home.earlier.length > 0 ? (
        <details className="group mt-6 rounded-3xl bg-cream-50 ring-1 ring-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-bold text-ink-900">
            <span>
              De días anteriores{' '}
              <span className="font-semibold text-ink-500">({home.earlier.length})</span>
            </span>
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4">
            <p className="text-sm text-ink-500">
              Sesiones de la última semana que no se terminaron. Puedes hacerlas ahora si te va
              bien.
            </p>
            <SessionLines sessions={home.earlier} today={home.today} />
          </div>
        </details>
      ) : null}

      {home.next ? (
        <Link
          href={`/cliente/sesion/${home.next.id}`}
          className="mt-4 block rounded-3xl bg-white p-4 shadow-soft"
        >
          <p className="text-sm font-semibold text-sun-700">
            Próxima sesión · {formatRelativeDay(home.next.plannedDate, home.today)}
          </p>
          <p className="mt-0.5 font-bold text-ink-900">{sessionName(home.next)}</p>
        </Link>
      ) : null}

      <Link
        href="/cliente/semana"
        className="mt-6 flex items-center gap-3 rounded-3xl bg-cream-50 p-4 ring-1 ring-line"
      >
        <CalendarDays aria-hidden className="size-5 shrink-0 text-sun-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">
            Esta semana: {home.week.completed} de {home.week.planned} sesiones
          </span>
          <Meter
            className="mt-2"
            value={home.week.completed}
            max={home.week.planned}
            label="Sesiones completadas esta semana"
            tone="leaf"
          />
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-500" />
      </Link>
    </>
  );
}

function SessionLines({ sessions, today }: { sessions: ClientSessionLineVM[]; today: string }) {
  return (
    <ul className="mt-3 divide-y divide-line rounded-3xl bg-white px-4 shadow-soft">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/cliente/sesion/${session.id}`}
            className="flex min-h-14 items-center justify-between gap-3 py-3"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-ink-900">{sessionName(session)}</span>
              <span className="block text-sm text-ink-500">
                {session.plannedDate === today
                  ? `${session.exerciseCount} ${session.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}`
                  : `Prevista ${formatRelativeDay(session.plannedDate, today).toLowerCase()}`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {session.execution.status !== 'planned' && session.execution.status !== 'overdue' ? (
                <ExecutionStatusBadge status={session.execution.status} />
              ) : null}
              <ArrowRight aria-hidden className="size-4 text-ink-500" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
