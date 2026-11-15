import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExecutionDayView } from '@/features/trainer/analysis/execution-day';
import { getTrainerContext } from '@/server/context';
import { getExecutionDay } from '@/server/services/trainer-analysis';

export const metadata: Metadata = { title: 'Totales del día' };

/** Totales del día de ejecución de un cliente (B3.1). Fecha no válida o sin acceso: 404. */
export default async function ExecutionDayPage(
  props: PageProps<'/entrenador/clientes/[clientId]/dia/[fecha]'>,
) {
  const { clientId, fecha } = await props.params;
  const vm = await getExecutionDay(await getTrainerContext(), { clientId, date: fecha });
  if (!vm) notFound();
  return (
    <ExecutionDayView
      vm={vm}
      sessionHref={(id) => `/entrenador/clientes/${vm.clientId}/sesiones/${id}/analisis`}
      dayHref={(date) => `/entrenador/clientes/${vm.clientId}/dia/${date}`}
    />
  );
}
