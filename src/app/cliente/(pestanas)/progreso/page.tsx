import { Eye } from 'lucide-react';
import { type Metadata } from 'next';
import { isoWeekKey } from '@/domain/time';
import { KettlebellIllustration } from '@/features/brand/illustrations';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { VolumePanel } from '@/features/shared/volume';
import { EmptyState } from '@/ui/empty-state';
import { getClientContext } from '@/server/context';
import { getClientProgress } from '@/server/services/client';

export const metadata: Metadata = { title: 'Mi progreso' };

export default async function ClientProgressPage() {
  const ctx = await getClientContext();
  const progress = await getClientProgress(ctx);
  const nothingShared = !progress.volume && !progress.assessments;

  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink-900">Mi progreso</h1>
      <p className="mt-2 flex items-start gap-2 text-sm text-ink-500">
        <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
        Aquí ves la información que tu entrenador ha decidido compartir contigo.
      </p>

      {nothingShared ? (
        <div className="mt-6">
          <EmptyState illustration={<KettlebellIllustration />} title="Aún no hay nada compartido">
            Cuando tu entrenador comparta tus evaluaciones o tu volumen de entrenamiento, aparecerán
            aquí.
          </EmptyState>
        </div>
      ) : null}

      {progress.volume ? (
        <section aria-labelledby="volumen" className="mt-6 rounded-3xl bg-white p-5 shadow-soft">
          <h2 id="volumen" className="mb-3 text-lg font-bold text-ink-900">
            Volumen semanal
          </h2>
          <VolumePanel
            weeks={progress.volume}
            currentWeek={isoWeekKey(ctx.today)}
            options={['completedSets', 'volumeLoadKg']}
          />
        </section>
      ) : null}

      {progress.assessments ? (
        <section aria-labelledby="evaluaciones" className="mt-6">
          <h2 id="evaluaciones" className="mb-3 text-lg font-bold text-ink-900">
            Mis evaluaciones
          </h2>
          <AssessmentSeriesList series={progress.assessments} compact />
        </section>
      ) : null}
    </>
  );
}
