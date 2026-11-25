import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExerciseEvolutionView } from '@/features/trainer/analysis/exercise-evolution';
import { hrefWith, periodState } from '@/features/trainer/analysis/analysis-links';
import { getTrainerContext } from '@/server/context';
import { getExerciseEvolution, parsePerspective } from '@/server/services/trainer-analysis';

export const metadata: Metadata = { title: 'Evolución del ejercicio' };

/** A10 · Evolución de un ejercicio (B3.2). Por defecto, las últimas 12 semanas. Sin acceso: 404. */
export default async function ExerciseEvolutionPage(
  props: PageProps<'/entrenador/clientes/[clientId]/analisis/ejercicios/[variantId]'>,
) {
  const [{ clientId, variantId }, query] = await Promise.all([props.params, props.searchParams]);
  const vm = await getExerciseEvolution(await getTrainerContext(), {
    clientId,
    variantId: decodeURIComponent(variantId),
    query,
    perspective: parsePerspective(query.referencia),
  });
  if (!vm) notFound();
  const analysis = `/entrenador/clientes/${vm.clientId}/analisis`;
  const referencia = vm.perspective === 'current' ? '?referencia=vigente' : '';
  return (
    <ExerciseEvolutionView
      vm={vm}
      base={`${analysis}/ejercicios/${encodeURIComponent(vm.variantId)}`}
      backHref={hrefWith(analysis, periodState(vm.period, vm.perspective, vm.today))}
      sessionHref={(id) =>
        `/entrenador/clientes/${vm.clientId}/sesiones/${id}/analisis${referencia}`
      }
    />
  );
}
