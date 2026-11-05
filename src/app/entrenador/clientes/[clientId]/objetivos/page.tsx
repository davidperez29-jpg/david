import { Target } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDate } from '@/domain/format';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { PendingFeature } from '@/features/shared/pending-feature';
import { Badge } from '@/ui/badge';
import { getTrainerContext } from '@/server/context';
import { getClientGoals } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Objetivos' };

export default async function ClientGoalsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/objetivos'>,
) {
  const { clientId } = await props.params;
  const goals = await getClientGoals(await getTrainerContext(), clientId);
  if (!goals) notFound();

  return (
    <div className="space-y-5">
      {goals.length === 0 ? <p className="text-sm text-ink-500">Sin objetivos definidos.</p> : null}
      {goals.map((goal) => (
        <section
          key={goal.id}
          aria-labelledby={goal.id}
          className="rounded-3xl border border-line/70 bg-white p-5 shadow-soft sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun-200 text-sun-800"
                aria-hidden
              >
                <Target className="size-5" />
              </span>
              <div>
                <h2 id={goal.id} className="text-lg font-bold text-ink-900">
                  {goal.title}
                </h2>
                <p className="text-sm text-ink-500">
                  {goal.areaLabel} · desde el {formatDate(goal.startedOn, 'dayMonth')}
                  {goal.targetDate
                    ? ` · fecha prevista: ${formatDate(goal.targetDate, 'dayMonth')}`
                    : ''}
                </p>
              </div>
            </div>
            <Badge
              tone={
                goal.status === 'active' ? 'sun' : goal.status === 'achieved' ? 'leaf' : 'neutral'
              }
            >
              {goal.statusLabel}
            </Badge>
          </div>
          {goal.notes ? <p className="mt-3 text-sm text-ink-700">{goal.notes}</p> : null}
          {goal.linkedTests.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-ink-900">Pruebas con las que se sigue</p>
              <AssessmentSeriesList series={goal.linkedTests} compact />
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">Sin pruebas de evaluación enlazadas.</p>
          )}
        </section>
      ))}
      <PendingFeature title="Crear y editar objetivos" phase="Fase 3">
        Los objetivos se podrán crear, editar, cerrar y enlazar con pruebas de evaluación. Si hay
        una meta numérica, la define el profesional; TrainPro no propone valores «normativos».
      </PendingFeature>
    </div>
  );
}
