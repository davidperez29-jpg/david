import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { PendingFeature } from '@/features/shared/pending-feature';
import { getTrainerContext } from '@/server/context';
import { getClientEvaluations } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Evaluaciones' };

export default async function ClientEvaluationsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/evaluaciones'>,
) {
  const { clientId } = await props.params;
  const series = await getClientEvaluations(await getTrainerContext(), clientId);
  if (!series) notFound();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink-900">Historial de evaluaciones</h2>
      {series.length ? (
        <AssessmentSeriesList series={series} />
      ) : (
        <p className="rounded-3xl bg-cream-50 p-6 text-sm text-ink-500 ring-1 ring-line">
          Todavía no hay evaluaciones registradas.
        </p>
      )}
      <PendingFeature
        title="Registrar evaluaciones"
        phase="Fase 5"
        items={[
          'Registro de intentos y elección de mejor intento o promedio',
          'Protocolos configurables por población y objetivo',
          'Importación manual de archivos con su procedencia',
          'Comparación con referencias, solo si son válidas y verificables',
        ]}
      />
    </div>
  );
}
