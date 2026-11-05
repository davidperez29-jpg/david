import { FlaskConical } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { formatDate, formatNumber } from '@/domain/format';
import { OriginBadge, OriginLegend } from '@/features/shared/provenance';
import { PendingFeature } from '@/features/shared/pending-feature';
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
  const latest = overview.byClient.flatMap((row) =>
    row.series.map((series) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      series,
      point: series.points.at(-1)!,
    })),
  );

  return (
    <>
      <PageHeader
        title="Evaluaciones"
        description="Últimos resultados de tus clientes, con el origen de cada dato, y catálogo de pruebas previsto."
      />

      <Notice tone="sun" icon={<FlaskConical />} title="Aún no se interpreta ningún resultado">
        Los protocolos, las fórmulas y los valores de referencia de cada prueba se incorporarán uno
        a uno en la fase de evaluaciones, tras verificar sus fuentes primarias. TrainPro no deduce
        variables que el instrumento no mide (por ejemplo, fuerza pico, RFD o impulso a partir de
        una altura de salto).
      </Notice>

      <section aria-labelledby="ultimas" className="mt-8">
        <Card>
          <CardHeader
            as="h2"
            title={<span id="ultimas">Últimos resultados</span>}
            description="El análisis de la evolución está en «Análisis de resultados»."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm tabular-nums">
              <thead className="text-xs text-ink-500">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Cliente
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Prueba
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Fecha
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Resultado
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Origen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {latest.map(({ clientId, clientName, series, point }) => (
                  <tr key={`${clientId}-${series.testId}`}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/entrenador/clientes/${clientId}/evaluaciones`}
                        className="font-semibold text-ink-900 hover:underline"
                      >
                        {clientName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-700">{series.testName}</td>
                    <td className="py-2.5 pr-3 text-ink-500">{formatDate(point.date, 'short')}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="font-bold text-ink-900">
                        {formatNumber(point.value, 2)} {series.unit}
                      </span>
                      {point.attempts ? (
                        <span className="block text-xs text-ink-500">
                          {point.aggregationLabel} de {point.attempts.length}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      <OriginBadge origin={point.provenance.origin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section aria-labelledby="origen" className="mt-8">
        <Card>
          <CardHeader
            as="h2"
            title={<span id="origen">De dónde sale cada dato</span>}
            description="Cada valor de TrainPro lleva una de estas cinco etiquetas."
          />
          <OriginLegend />
        </Card>
      </section>

      <section aria-labelledby="catalogo" className="mt-8">
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

      <div className="mt-8">
        <PendingFeature
          title="Registro de evaluaciones"
          phase="Fase 5"
          items={[
            'Pruebas configurables por población y objetivo',
            'Registro de intentos y regla: mejor intento o promedio',
            'Importación manual de archivos con su procedencia',
            'Informes y comparación con referencias verificadas',
          ]}
        />
      </div>
    </>
  );
}
