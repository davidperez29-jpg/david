import { type Metadata } from 'next';
import { KettlebellIllustration } from '@/features/brand/illustrations';
import { PendingFeature } from '@/features/shared/pending-feature';
import { EmptyState } from '@/ui/empty-state';
import { PageHeader } from '@/ui/page-header';

export const metadata: Metadata = { title: 'Informes' };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Informes"
        description="Informes comparativos para ti y, si lo decides, para tus clientes."
      />
      <EmptyState illustration={<KettlebellIllustration />} title="Todavía no hay informes">
        Los informes se construirán sobre los datos reales de evaluación y entrenamiento, cuando
        estén disponibles.
      </EmptyState>
      <div className="mt-8">
        <PendingFeature
          title="Informes y gráficos comparativos"
          phase="fase de informes"
          items={[
            'Evolución de evaluaciones con la procedencia de cada dato',
            'Volumen y carga por periodos',
            'Comparación con referencias, solo si son válidas y verificables',
            'Versión para compartir con el cliente y exportación',
          ]}
        />
      </div>
    </>
  );
}
