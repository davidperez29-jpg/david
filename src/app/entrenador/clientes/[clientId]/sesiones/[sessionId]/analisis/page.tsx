import { ArrowLeft } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SessionAnalysisView } from '@/features/trainer/analysis/session-analysis';
import { getTrainerContext } from '@/server/context';
import { getSessionAnalysis, parsePerspective } from '@/server/services/trainer-analysis';

export const metadata: Metadata = { title: 'Análisis de la sesión' };

/**
 * A8 · Análisis de una sesión (B3.1). `?referencia=vigente` compara con la prescripción
 * vigente; sin el parámetro, con la original. Sin acceso o sin la sesión: 404.
 */
export default async function SessionAnalysisPage(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones/[sessionId]/analisis'>,
) {
  const [{ clientId, sessionId }, query] = await Promise.all([props.params, props.searchParams]);
  const vm = await getSessionAnalysis(await getTrainerContext(), {
    clientId,
    sessionId,
    perspective: parsePerspective(query.referencia),
  });
  if (!vm) notFound();
  const base = `/entrenador/clientes/${vm.clientId}/sesiones/${vm.sessionId}`;
  const executedOn = vm.analysis.executedOn;

  return (
    <>
      <Link
        href={base}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Sesión
      </Link>
      <SessionAnalysisView
        vm={vm}
        links={{
          original: `${base}/analisis`,
          current: `${base}/analisis?referencia=vigente`,
          day: executedOn ? `/entrenador/clientes/${vm.clientId}/dia/${executedOn}` : null,
          session: base,
        }}
      />
    </>
  );
}
