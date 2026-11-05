import { type Metadata } from 'next';
import { ExerciseLibrary } from '@/features/trainer/exercise-library';
import { PendingFeature } from '@/features/shared/pending-feature';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { getLibrary } from '@/server/services/library';

export const metadata: Metadata = { title: 'Biblioteca de ejercicios' };

export default async function ExercisesPage() {
  const library = await getLibrary(await getTrainerContext());
  return (
    <>
      <PageHeader
        title="Biblioteca de ejercicios"
        description="Clasificación multidimensional: etiquetas, patrones de movimiento, material, región, ejecución, entorno y complejidad. Combina filtros con «Todos» o «Alguno»."
      />
      <ExerciseLibrary library={library} />
      <div className="mt-10">
        <PendingFeature
          title="Gestión de la biblioteca"
          phase="Fase 4"
          items={[
            'Crear y editar ejercicios, variantes y etiquetas propias',
            'Relacionar progresiones y regresiones',
            'Guardar y quitar favoritos',
            'Añadir un ejercicio a una sesión desde los resultados (Fase 6)',
            'Subir imágenes y vídeos o enlazarlos (solo https)',
            'Archivar etiquetas conservando sus identificadores',
          ]}
        >
          En esta fase la biblioteca se puede buscar y consultar con datos de ejemplo. Los favoritos
          que ves están precargados; aún no se pueden cambiar.
        </PendingFeature>
      </div>
    </>
  );
}
