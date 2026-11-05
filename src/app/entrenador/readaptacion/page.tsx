import { ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@/domain/format';
import { HealthDataNotice, RehabTimeline } from '@/features/shared/rehab';
import { Notice } from '@/ui/notice';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { getRehabOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Readaptación' };

export default async function RehabPage() {
  const cases = await getRehabOverview(await getTrainerContext());
  return (
    <>
      <PageHeader
        title="Readaptación"
        description="Procesos de readaptación y retorno al deporte organizados por fases y criterios de progresión."
        actions={<HealthDataNotice />}
      />

      <Notice tone="plum" icon={<ShieldCheck />} title="Criterios definidos por profesionales">
        TrainPro no propone criterios clínicos por su cuenta: cada fase y cada criterio los define
        el profesional responsable (entrenador o fisioterapeuta), y la herramienta registra si se
        cumplen. El caso que ves es ficticio y no constituye una recomendación clínica.
      </Notice>

      <div className="mt-8 space-y-10">
        {cases.map((rehab) => (
          <section key={rehab.id} aria-labelledby={`caso-${rehab.id}`}>
            <h2 id={`caso-${rehab.id}`} className="text-2xl font-bold text-ink-900">
              <Link
                href={`/entrenador/clientes/${rehab.clientId}/salud`}
                className="hover:underline"
              >
                {rehab.clientName}
              </Link>
            </h2>
            <p className="mt-1 mb-4 text-ink-500">
              {rehab.title} · desde el {formatDate(rehab.startedOn, 'dayMonth')}
            </p>
            <RehabTimeline rehab={rehab} />
          </section>
        ))}
      </div>
    </>
  );
}
