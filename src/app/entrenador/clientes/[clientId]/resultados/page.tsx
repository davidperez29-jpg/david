import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isoWeekKey } from '@/domain/time';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { VolumePanel } from '@/features/shared/volume';
import { Card, CardHeader } from '@/ui/card';
import { getTrainerContext } from '@/server/context';
import { getClientResults } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Resultados y evolución' };

export default async function ClientResultsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/resultados'>,
) {
  const { clientId } = await props.params;
  const ctx = await getTrainerContext();
  const results = await getClientResults(ctx, clientId);
  if (!results) notFound();
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader
          as="h2"
          title="Volumen semanal"
          description="Últimas cuatro semanas, calculado a partir de las series registradas."
        />
        <VolumePanel weeks={results.weeklyVolume} currentWeek={isoWeekKey(ctx.today)} />
      </Card>
      <section aria-labelledby="evolucion">
        <h2 id="evolucion" className="mb-4 text-2xl font-bold text-ink-900">
          Evolución de las evaluaciones
        </h2>
        {results.assessments.length ? (
          <AssessmentSeriesList series={results.assessments} />
        ) : (
          <p className="rounded-3xl bg-cream-50 p-6 text-sm text-ink-500 ring-1 ring-line">
            Sin evaluaciones que comparar.
          </p>
        )}
      </section>
    </div>
  );
}
