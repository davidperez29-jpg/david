import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { PendingFeature } from '@/features/shared/pending-feature';
import { PrescriptionChips } from '@/features/shared/prescription';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Card, CardHeader } from '@/ui/card';
import { cn } from '@/ui/cn';
import { getTrainerContext } from '@/server/context';
import { getClientPlan } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Planificación' };

export default async function ClientPlanTab(
  props: PageProps<'/entrenador/clientes/[clientId]/planificacion'>,
) {
  const { clientId } = await props.params;
  const ctx = await getTrainerContext();
  const plan = await getClientPlan(ctx, clientId);
  if (!plan) notFound();
  const next = plan.nextSession;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader as="h2" title={`Semana del ${formatDate(plan.weekStart, 'dayMonth')}`} />
        <ol className="grid gap-2 md:grid-cols-7">
          {plan.days.map((day) => {
            const sessions = plan.weekSessions.filter((s) => s.date === day);
            const isToday = day === ctx.today;
            return (
              <li
                key={day}
                className={cn(
                  'min-h-20 rounded-2xl p-2.5',
                  isToday ? 'bg-sun-100 ring-2 ring-sun-400' : 'bg-cream-50 ring-1 ring-line',
                  sessions.length === 0 && 'hidden md:block',
                )}
              >
                <p className="text-xs font-bold text-ink-500 capitalize">
                  {formatDate(day, 'weekdayShort')} {formatDate(day, 'short').split(' ')[0]}
                </p>
                {sessions.map((s) => (
                  <div key={s.id} className="mt-1.5">
                    <p className="text-sm leading-snug font-semibold text-ink-900">{s.title}</p>
                    <div className="mt-1">
                      <SessionStatusBadge status={s.status} />
                    </div>
                  </div>
                ))}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader
          as="h2"
          title="Próxima sesión"
          description={
            next
              ? `${formatRelativeDay(next.date, ctx.today)} · ${next.title} · ${next.estimatedMinutes} min`
              : 'No hay sesiones pendientes en los próximos días.'
          }
          action={next ? <SessionStatusBadge status={next.status} /> : undefined}
        />
        {next ? (
          <ol className="space-y-3">
            {next.exercises.map((exercise) => (
              <li
                key={exercise.prescriptionId}
                className="flex gap-3 rounded-2xl bg-cream-50 p-3 ring-1 ring-line"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-line">
                  <ExercisePictogram silhouette={exercise.silhouette} className="size-11" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink-900">
                    <span className="mr-1.5 text-sun-700">{exercise.slot}</span>
                    {exercise.name}
                  </p>
                  <PrescriptionChips exercise={exercise} className="mt-2" />
                  {exercise.notes ? (
                    <p className="mt-2 text-sm text-ink-500">{exercise.notes}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
      <PendingFeature
        title="Editor de planes"
        phase="Fase 6"
        items={[
          'Planes, semanas y sesiones desde cero',
          'Series, repeticiones, tiempo, distancia, carga, descanso, tempo, RPE/RIR y carácter del esfuerzo',
          'Añadir ejercicios desde la biblioteca',
          'Métodos distintos sin estructuras rígidas',
        ]}
      />
    </div>
  );
}
