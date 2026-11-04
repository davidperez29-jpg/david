import { type Metadata } from 'next';
import { isoWeekKey } from '@/domain/time';
import { VolumeBoard } from '@/features/shared/volume';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { PageHeader } from '@/ui/page-header';
import { PendingFeature } from '@/features/shared/pending-feature';
import { getTrainerContext } from '@/server/context';
import { getLoadOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Carga y volumen' };

export default async function LoadPage() {
  const ctx = await getTrainerContext();
  const load = await getLoadOverview(ctx);

  return (
    <>
      <PageHeader
        title="Carga y volumen"
        description="Volumen semanal de las últimas cuatro semanas, calculado con las series que registra cada cliente."
      />

      <VolumeBoard clients={load.clients} currentWeek={isoWeekKey(ctx.today)} />

      <section aria-labelledby="definiciones" className="mt-10">
        <Card>
          <CardHeader
            as="h2"
            title={<span id="definiciones">Cómo se calcula</span>}
            description="Definiciones operativas registradas y versionadas. Cada cifra indica qué definición la produjo."
          />
          <ul className="grid gap-4 lg:grid-cols-3">
            {load.formulas.map((formula) => (
              <li key={formula.id} className="rounded-2xl bg-cream-50 p-4 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink-900">{formula.name}</h3>
                  <Badge tone="sky">v{formula.version}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-500">{formula.id}</p>
                <p className="mt-2 text-sm text-ink-700">{formula.expression}</p>
                <p className="mt-3 text-xs font-bold tracking-wide text-ink-500 uppercase">
                  Limitaciones
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-500">
                  {formula.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="mt-8">
        <PendingFeature
          title="Carga interna y alertas"
          phase="fase de seguimiento de carga"
          items={[
            'Esfuerzo percibido de la sesión y carga interna',
            'Comparación entre semanas y entre bloques',
            'Volumen por patrón de movimiento y grupo muscular',
            'Datos importados de dispositivos, con su procedencia',
          ]}
        >
          Cada indicador nuevo se añadirá solo con una definición documentada y, si procede, con su
          referencia científica verificada.
        </PendingFeature>
      </div>
    </>
  );
}
