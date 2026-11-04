import { ChevronRight, Coffee } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@/domain/format';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { cn } from '@/ui/cn';
import { getClientContext } from '@/server/context';
import { getClientWeek } from '@/server/services/client';

export const metadata: Metadata = { title: 'Mi semana' };

export default async function ClientWeekPage() {
  const week = await getClientWeek(await getClientContext());
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink-900">Mi semana</h1>
      <p className="mt-1 text-ink-500">
        Del {formatDate(week.days[0]!.date, 'dayMonth')} al{' '}
        {formatDate(week.days.at(-1)!.date, 'dayMonth')}
      </p>
      <ol className="mt-5 space-y-2.5">
        {week.days.map((day) => {
          const isToday = day.date === week.today;
          return (
            <li key={day.date} className={cn('rounded-3xl p-1', isToday && 'bg-sun-400')}>
              <div className="flex items-stretch gap-3 rounded-[1.25rem] bg-white p-3 shadow-soft">
                <div
                  className={cn(
                    'grid w-14 shrink-0 place-items-center rounded-2xl py-2 text-center',
                    isToday ? 'bg-ink-900 text-cream-50' : 'bg-cream-100 text-ink-700',
                  )}
                >
                  <span className="text-xs font-semibold capitalize">
                    {formatDate(day.date, 'weekdayShort')}
                  </span>
                  <span className="font-display text-xl font-bold">
                    {formatDate(day.date, 'short').split(' ')[0]}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  {day.sessions.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-ink-500">
                      <Coffee aria-hidden className="size-4" /> Descanso
                    </p>
                  ) : (
                    day.sessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/cliente/sesion/${session.id}`}
                        className="flex items-center gap-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-ink-900">
                            {session.title}
                          </span>
                          <span className="mt-1 block">
                            <SessionStatusBadge status={session.status} />
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-300" />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
