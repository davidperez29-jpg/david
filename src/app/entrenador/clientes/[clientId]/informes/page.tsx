import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KettlebellIllustration } from '@/features/brand/illustrations';
import { PendingFeature } from '@/features/shared/pending-feature';
import { EmptyState } from '@/ui/empty-state';
import { getTrainerContext } from '@/server/context';
import { getClientProfile } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Informes' };

export default async function ClientReportsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/informes'>,
) {
  const { clientId } = await props.params;
  if (!(await getClientProfile(await getTrainerContext(), clientId))) notFound();
  return (
    <div className="space-y-6">
      <EmptyState illustration={<KettlebellIllustration />} title="Sin informes todavía">
        Los informes de este cliente se generarán con sus datos reales de evaluación, entrenamiento
        y readaptación.
      </EmptyState>
      <PendingFeature
        title="Informes del cliente"
        phase="Fase 9"
        items={[
          'Evolución individual y comparación entre evaluaciones',
          'Volumen y carga por periodos',
          'Informe de readaptación',
          'Versión para compartir con el cliente, si lo autorizas',
        ]}
      />
    </div>
  );
}
