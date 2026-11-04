import { type Metadata } from 'next';
import { ExerciseLibrary } from '@/features/trainer/exercise-library';
import { PageHeader } from '@/ui/page-header';
import { PendingFeature } from '@/features/shared/pending-feature';
import { getTrainerContext } from '@/server/context';
import { listExerciseLibrary } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Ejercicios' };

export default async function ExercisesPage() {
  const exercises = await listExerciseLibrary(await getTrainerContext());
  return (
    <>
      <PageHeader
        title="Biblioteca de ejercicios"
        description="Explicación, clasificación y puntos clave de cada ejercicio."
      />
      <ExerciseLibrary exercises={exercises} />
      <div className="mt-10">
        <PendingFeature
          title="Ejercicios propios, imágenes y vídeos"
          phase="fase de biblioteca"
          items={[
            'Crear y editar ejercicios propios',
            'Subir imágenes y vídeos, o enlazarlos (solo https)',
            'Clasificación por grupos musculares y objetivos',
            'Variantes y progresiones entre ejercicios',
          ]}
        >
          Mientras un ejercicio no tenga imagen o vídeo propio, se muestra la silueta de su patrón
          de movimiento.
        </PendingFeature>
      </div>
    </>
  );
}
