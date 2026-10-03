import { listLibraryTaxonomies } from '@tp/application';
import { requireStaff } from '@/server/session';
import { NewExercise } from './new-exercise';

export default async function NewExercisePage() {
  const ctx = await requireStaff();
  const tax = await listLibraryTaxonomies(ctx);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nuevo ejercicio</h1>
      <p className="text-sm text-muted">
        Se crea como borrador. Para publicarlo hacen falta patrón, categoría, músculos principales,
        nivel, explicación para el cliente y perfil de prescripción.
      </p>
      <NewExercise tax={tax} />
    </div>
  );
}
