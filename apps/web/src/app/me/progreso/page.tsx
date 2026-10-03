import { clientAssessmentProgress } from '@tp/application';
import { ProgressView } from '@/components/assessment/progress';
import { requireClientUser } from '@/server/session';

export default async function ClientProgress() {
  const ctx = await requireClientUser();
  const data = await clientAssessmentProgress(ctx, ctx.actor.clientId!);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Tu progreso</h1>
      <p className="text-sm text-muted">
        Comparamos cada resultado con el margen de error del test: así sabemos si un cambio es real.
      </p>
      <ProgressView data={data} audience="client" />
    </div>
  );
}
