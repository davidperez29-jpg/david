import { listCatalog, listTrainers } from '@tp/application';
import { requireStaff } from '@/server/session';
import { NewClientWizard } from './wizard';

export default async function NewClientPage() {
  const ctx = await requireStaff();
  const [catalog, trainers] = await Promise.all([listCatalog(ctx), listTrainers(ctx)]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      <NewClientWizard
        catalog={catalog}
        trainers={ctx.actor.roles.includes('ADMIN') ? trainers : []}
        defaultTrainerId={ctx.actor.trainerId ?? null}
      />
    </div>
  );
}
