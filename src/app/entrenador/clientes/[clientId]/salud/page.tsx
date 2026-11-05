import { ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDate } from '@/domain/format';
import { HealthDataNotice, RehabTimeline } from '@/features/shared/rehab';
import { PendingFeature } from '@/features/shared/pending-feature';
import { Notice } from '@/ui/notice';
import { getTrainerContext } from '@/server/context';
import { getClientHealth } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Salud y readaptación' };

export default async function ClientHealthTab(
  props: PageProps<'/entrenador/clientes/[clientId]/salud'>,
) {
  const { clientId } = await props.params;
  const health = await getClientHealth(await getTrainerContext(), clientId);
  if (!health) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">Salud y readaptación</h2>
        <HealthDataNotice />
      </div>
      {health.rehab ? (
        <>
          <p className="font-semibold text-ink-700">
            {health.rehab.title} · desde el {formatDate(health.rehab.startedOn, 'dayMonth')}
          </p>
          <RehabTimeline rehab={health.rehab} />
        </>
      ) : (
        <p className="rounded-3xl bg-cream-50 p-6 text-sm text-ink-500 ring-1 ring-line">
          Sin procesos de readaptación activos.
        </p>
      )}
      <Notice tone="plum" icon={<ShieldCheck />}>
        Los criterios los define el profesional responsable. TrainPro no genera protocolos clínicos
        automáticos.
      </Notice>
      <PendingFeature
        title="Lesiones y antecedentes"
        phase="Fase 9"
        items={[
          'Registro de lesiones y antecedentes con consentimiento y permisos reforzados',
          'Región corporal (tobillo, rodilla, cadera, hombro…)',
          'Relación entre evaluaciones, objetivos y fases',
          'Registro de accesos a estos datos',
        ]}
      />
    </div>
  );
}
