import { type Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@/domain/format';
import { PendingFeature } from '@/features/shared/pending-feature';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Avatar } from '@/ui/avatar';
import { cn } from '@/ui/cn';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { getPlanningOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Planificación' };

export default async function PlanningPage() {
  const ctx = await getTrainerContext();
  const planning = await getPlanningOverview(ctx);
  const weekEnd = planning.days.at(-1)!;

  return (
    <>
      <PageHeader
        eyebrow={`Semana del ${formatDate(planning.weekStart, 'dayMonth')} al ${formatDate(weekEnd, 'dayMonth')}`}
        title="Planificación"
        description="Sesiones programadas esta semana para tus clientes activos."
      />

      <div className="space-y-5">
        {planning.clients.map((client) => (
          <section
            key={client.id}
            aria-labelledby={`plan-${client.id}`}
            className="rounded-3xl border border-line/70 bg-white p-5 shadow-soft"
          >
            <div className="mb-4 flex items-center gap-3">
              <Avatar initials={client.initials} seed={client.id} size="sm" />
              <h2 id={`plan-${client.id}`} className="text-lg font-bold text-ink-900">
                <Link href={`/entrenador/clientes/${client.id}`} className="hover:underline">
                  {client.name}
                </Link>
              </h2>
            </div>
            <ol className="grid gap-2 md:grid-cols-7">
              {planning.days.map((day) => {
                const sessions = client.sessions.filter((s) => s.date === day);
                const isToday = day === ctx.today;
                return (
                  <li
                    key={day}
                    className={cn(
                      'min-h-24 rounded-2xl p-2.5',
                      isToday ? 'bg-sun-100 ring-2 ring-sun-400' : 'bg-cream-50 ring-1 ring-line',
                      sessions.length === 0 && 'hidden md:block',
                    )}
                  >
                    <p
                      className={cn(
                        'text-xs font-bold capitalize',
                        isToday ? 'text-ink-900' : 'text-ink-500',
                      )}
                    >
                      {formatDate(day, 'weekdayShort')} {formatDate(day, 'short').split(' ')[0]}
                      {isToday ? ' · hoy' : ''}
                    </p>
                    {sessions.map((session) => (
                      <div key={session.id} className="mt-2">
                        <p className="text-sm leading-snug font-semibold text-ink-900">
                          {session.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {session.exerciseCount} ejercicios · {session.plannedSets} series
                        </p>
                        <div className="mt-1.5">
                          <SessionStatusBadge status={session.status} />
                        </div>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-8">
        <PendingFeature
          title="Editor de planes"
          phase="fase de planificación"
          items={[
            'Crear mesociclos, semanas y sesiones',
            'Prescribir series, repeticiones, carga, descanso, tempo y RPE/RIR',
            'Plantillas reutilizables y duplicado de semanas',
            'Progresiones y ajustes a partir de los registros',
          ]}
        >
          Ahora mismo el plan se puede consultar, pero no editar.
        </PendingFeature>
      </div>
    </>
  );
}
