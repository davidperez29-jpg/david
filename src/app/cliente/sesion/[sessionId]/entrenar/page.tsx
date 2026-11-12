import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TrainingPlayer } from '@/features/client/player/training-player';
import { getClientContext } from '@/server/context';
import { getPlayer } from '@/server/services/client-execution';

export const metadata: Metadata = { title: 'Entrenar' };

/**
 * Reproductor de entrenamiento (B3–B6, bloque 2). Cada serie se guarda primero en el móvil y
 * después en el servidor; la pantalla distingue lo pendiente de envío de lo confirmado.
 */
export default async function ClientTrainPage(
  props: PageProps<'/cliente/sesion/[sessionId]/entrenar'>,
) {
  const { sessionId } = await props.params;
  // `null` si no existe, no es suya o no está publicada: no se revela cuál.
  const vm = await getPlayer(await getClientContext(), sessionId);
  if (!vm) notFound();
  return (
    <main id="contenido" className="px-4 pt-2">
      <TrainingPlayer vm={vm} />
    </main>
  );
}
