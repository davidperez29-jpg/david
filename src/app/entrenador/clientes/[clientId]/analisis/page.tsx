import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientAnalysisView } from '@/features/trainer/analysis/client-analysis';
import { hrefWith, periodState } from '@/features/trainer/analysis/analysis-links';
import { getTrainerContext } from '@/server/context';
import { getClientAnalysis, parsePerspective } from '@/server/services/trainer-analysis';

export const metadata: Metadata = { title: 'Análisis del cliente' };

/**
 * A9 · Análisis del cliente por periodos (B3.2). Todo el estado va en la URL: periodo
 * (`periodo`, `fecha`, `desde`, `hasta`), perspectiva (`referencia=vigente`), filtros (`patron`,
 * `patrones`, `ejercicio`), P-104 (`n`, `m`), orden y magnitud. Sin acceso: 404.
 */
export default async function ClientAnalysisPage(
  props: PageProps<'/entrenador/clientes/[clientId]/analisis'>,
) {
  const [{ clientId }, query] = await Promise.all([props.params, props.searchParams]);
  const vm = await getClientAnalysis(await getTrainerContext(), {
    clientId,
    query,
    perspective: parsePerspective(query.referencia),
  });
  if (!vm) notFound();
  const base = `/entrenador/clientes/${vm.clientId}/analisis`;
  const period = periodState(vm.analysis.period, vm.perspective, vm.today);
  const referencia = vm.perspective === 'current' ? '?referencia=vigente' : '';
  return (
    <ClientAnalysisView
      vm={vm}
      base={base}
      sessionHref={(id) =>
        `/entrenador/clientes/${vm.clientId}/sesiones/${id}/analisis${referencia}`
      }
      exerciseHref={(variantId) =>
        hrefWith(`${base}/ejercicios/${encodeURIComponent(variantId)}`, period)
      }
    />
  );
}
