import { listCatalog, listProgrammingProfiles, listTrainers } from '@tp/application';
import { requireStaff } from '@/server/session';
import { QuickClientForm } from './quick-form';

export default async function NewClientPage() {
  const ctx = await requireStaff();
  const isAdmin = ctx.actor.roles.includes('ADMIN');
  const [catalog, profiles, trainers] = await Promise.all([
    listCatalog(ctx),
    listProgrammingProfiles(ctx),
    isAdmin ? listTrainers(ctx) : Promise.resolve([]),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      <QuickClientForm
        catalog={catalog}
        profiles={profiles}
        trainers={trainers}
        defaultTrainerId={ctx.actor.trainerId ?? null}
      />
    </div>
  );
}
