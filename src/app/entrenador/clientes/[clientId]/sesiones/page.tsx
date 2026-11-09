import { CalendarPlus } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SessionDays } from '@/features/trainer/session-days';
import { ButtonLink } from '@/ui/button';
import { Card, CardHeader } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { getTrainerContext } from '@/server/context';
import { getTrainerSessions } from '@/server/services/trainer-sessions';
import { deleteDraftAction, moveDraftAction } from './actions';

export const metadata: Metadata = { title: 'Ficha · Sesiones' };

/** A3 · Sesiones del cliente, agrupadas por fecha prevista (varias el mismo día). */
export default async function ClientSessionsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones'>,
) {
  const { clientId } = await props.params;
  const vm = await getTrainerSessions(await getTrainerContext(), clientId);
  if (!vm) notFound();
  const newSession = `/entrenador/clientes/${vm.clientId}/sesiones/nueva`;
  const common = {
    clientId: vm.clientId,
    clientFirstName: vm.clientFirstName,
    moveAction: moveDraftAction,
    deleteAction: deleteDraftAction,
  };

  if (vm.upcoming.length === 0 && vm.past.length === 0) {
    return (
      <Card>
        <EmptyState
          title={`Todavía no hay sesiones para ${vm.clientFirstName}`}
          action={
            <ButtonLink href={newSession}>
              <CalendarPlus aria-hidden className="size-4" /> Planificar una sesión
            </ButtonLink>
          }
        >
          Crea la primera: puedes poner varias el mismo día («Mañana», «Tarde»…).
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <ButtonLink href={newSession}>
          <CalendarPlus aria-hidden className="size-4" /> Nueva sesión
        </ButtonLink>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            as="h2"
            title="Próximas sesiones"
            description="Desde hoy, por día y en su orden. Los borradores no los ve el cliente."
          />
          <SessionDays days={vm.upcoming} empty="Sin sesiones programadas." {...common} />
        </Card>
        <Card>
          <CardHeader
            as="h2"
            title="Sesiones anteriores"
            description="Últimas cuatro semanas, con su estado según el registro."
          />
          <SessionDays days={vm.past} empty="Sin sesiones anteriores." {...common} />
        </Card>
      </div>
    </>
  );
}
