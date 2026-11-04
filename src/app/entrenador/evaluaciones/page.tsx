import { FlaskConical } from 'lucide-react';
import { type Metadata } from 'next';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { OriginLegend } from '@/features/shared/provenance';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { Notice } from '@/ui/notice';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { getAssessmentsOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Evaluaciones' };

export default async function AssessmentsPage() {
  const overview = await getAssessmentsOverview(await getTrainerContext());
  const categories = [...new Set(overview.catalog.map((test) => test.categoryLabel))];

  return (
    <>
      <PageHeader
        title="Evaluaciones"
        description="Resultados de tus clientes con el origen de cada dato y el catálogo de pruebas previsto."
      />

      <Notice tone="sun" icon={<FlaskConical />} title="Aún no se interpreta ningún resultado">
        Los protocolos, las fórmulas y los valores de referencia de cada prueba se incorporarán uno
        a uno en la fase de evaluación, después de verificar sus fuentes primarias. Hasta entonces,
        TrainPro solo muestra los valores y compara resultados obtenidos con el mismo método e
        instrumento.
      </Notice>

      <section aria-labelledby="resultados" className="mt-8">
        <h2 id="resultados" className="mb-4 text-2xl font-bold text-ink-900">
          Resultados por cliente
        </h2>
        <div className="space-y-8">
          {overview.byClient.map((row) => (
            <div key={row.clientId}>
              <h3 className="mb-3 text-lg font-bold text-ink-700">{row.clientName}</h3>
              <AssessmentSeriesList series={row.series} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="origen" className="mt-10">
        <Card>
          <CardHeader
            as="h2"
            title={<span id="origen">De dónde sale cada dato</span>}
            description="Cada valor de TrainPro lleva una de estas cinco etiquetas."
          />
          <OriginLegend />
        </Card>
      </section>

      <section aria-labelledby="catalogo" className="mt-10">
        <h2 id="catalogo" className="mb-4 text-2xl font-bold text-ink-900">
          Catálogo de pruebas
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {categories.map((category) => (
            <Card key={category}>
              <CardHeader as="h3" title={category} />
              <ul className="divide-y divide-line">
                {overview.catalog
                  .filter((test) => test.categoryLabel === category)
                  .map((test) => (
                    <li
                      key={test.id}
                      className="flex items-start justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">{test.name}</p>
                        <p className="text-ink-500">
                          {test.outcomeName}
                          {test.unit ? ` (${test.unit})` : ''}
                        </p>
                      </div>
                      <Badge tone="outline">Protocolo pendiente</Badge>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
