import { Scale } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { PendingFeature } from '@/features/shared/pending-feature';
import { Notice } from '@/ui/notice';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { getAssessmentsOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Análisis de resultados' };

export default async function AnalysisPage() {
  const overview = await getAssessmentsOverview(await getTrainerContext());
  return (
    <>
      <PageHeader
        title="Análisis de resultados"
        description="Evolución de las evaluaciones de tus clientes y comparación entre la última y la anterior."
      />
      <Notice icon={<Scale />} title="Cómo se compara">
        Solo se comparan resultados de la misma prueba obtenidos con la misma unidad, método,
        instrumento y regla de intentos. Si no coinciden, se indica el motivo. Que una diferencia
        sea relevante exige datos de fiabilidad del protocolo, que se añadirán con su referencia
        verificada.
      </Notice>
      <div className="mt-8 space-y-10">
        {overview.byClient.map((row) => (
          <section key={row.clientId} aria-labelledby={`analisis-${row.clientId}`}>
            <h2 id={`analisis-${row.clientId}`} className="mb-3 text-xl font-bold text-ink-900">
              <Link
                href={`/entrenador/clientes/${row.clientId}/resultados`}
                className="hover:underline"
              >
                {row.clientName}
              </Link>
            </h2>
            <AssessmentSeriesList series={row.series} />
          </section>
        ))}
      </div>
      <div className="mt-10">
        <PendingFeature
          title="Gráficos y comparaciones configurables"
          phase="Fases 5 y 9"
          items={[
            'Gráficos de evolución por prueba y periodo',
            'Comparación entre evaluaciones elegidas',
            'Cambio relevante con datos de fiabilidad verificados',
            'Referencias de población solo con fuentes válidas',
          ]}
        />
      </div>
    </>
  );
}
