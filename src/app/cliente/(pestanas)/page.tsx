import { ArrowRight, CalendarDays, Clock, Dumbbell, Layers, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { PatternPictogram } from '@/features/brand/pictogram';
import { RestIllustration } from '@/features/brand/illustrations';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Meter } from '@/ui/meter';
import { getClientContext } from '@/server/context';
import { getClientHome } from '@/server/services/client';

export default async function ClientTodayPage() {
  const home = await getClientHome(await getClientContext());
  const session = home.todaySession;

  return (
    <>
      <p className="text-sm font-semibold text-sun-700 first-letter:uppercase">
        {formatDate(home.today, 'long')}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink-900">Hola, {home.firstName}</h1>

      {session ? (
        <section
          aria-labelledby="sesion-hoy"
          className="mt-5 overflow-hidden rounded-[2rem] bg-sun-400 shadow-lift"
        >
          <div className="relative p-6 pb-5">
            <PatternPictogram
              pattern={session.preview[0]?.pattern ?? 'squat'}
              className="absolute -top-2 -right-3 size-36 opacity-15"
            />
            <p className="text-sm font-bold tracking-wide text-ink-900/70 uppercase">Hoy toca</p>
            <h2
              id="sesion-hoy"
              className="mt-1 pr-10 text-[1.9rem] leading-tight font-extrabold text-ink-900"
            >
              {session.title}
            </h2>
            <p className="mt-1 text-ink-700">{session.focus}</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-ink-900">
              <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                <Clock aria-hidden className="size-4" /> {session.estimatedMinutes} min
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                <Dumbbell aria-hidden className="size-4" /> {session.exerciseCount} ejercicios
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5">
                <Layers aria-hidden className="size-4" /> {session.plannedSets} series
              </li>
            </ul>
            {session.status !== 'pending' ? (
              <div className="mt-3">
                <SessionStatusBadge status={session.status} />
              </div>
            ) : null}
          </div>
          <div className="px-4 pb-4">
            <Link
              href={`/cliente/sesion/${session.id}`}
              className="flex h-16 items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 transition-colors hover:bg-ink-700"
            >
              {session.status === 'completed' ? 'Ver la sesión' : 'Empezar sesión'}
              <ArrowRight aria-hidden className="size-5" />
            </Link>
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

      {session?.coachNote ? (
        <div className="mt-4 flex gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <MessageCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
          <p className="text-sm text-ink-700">
            <span className="font-bold text-ink-900">Nota de tu entrenador: </span>
            {session.coachNote}
          </p>
        </div>
      ) : null}

      {session ? (
        <section aria-labelledby="en-esta-sesion" className="mt-6">
          <h2 id="en-esta-sesion" className="text-lg font-bold text-ink-900">
            En esta sesión
          </h2>
          <ol className="mt-3 divide-y divide-line rounded-3xl bg-white px-4 shadow-soft">
            {session.preview.map((item, index) => (
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

      {!session && home.nextSession ? (
        <Link
          href={`/cliente/sesion/${home.nextSession.id}`}
          className="mt-4 block rounded-3xl bg-white p-4 shadow-soft"
        >
          <p className="text-sm font-semibold text-sun-700">
            Próxima sesión · {formatRelativeDay(home.nextSession.date, home.today)}
          </p>
          <p className="mt-0.5 font-bold text-ink-900">{home.nextSession.title}</p>
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
