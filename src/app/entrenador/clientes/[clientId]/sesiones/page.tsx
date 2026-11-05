import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type SessionCardVM } from '@/contracts/shared';
import { formatDate } from '@/domain/format';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Card, CardHeader } from '@/ui/card';
import { getTrainerContext } from '@/server/context';
import { getClientSessions } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Sesiones' };

function SessionList({ sessions, empty }: { sessions: SessionCardVM[]; empty: string }) {
  if (sessions.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{s.title}</p>
            <p className="text-ink-500">
              {formatDate(s.date, 'long')} · {s.exerciseCount} ejercicios · {s.completedSets}/
              {s.plannedSets} series
            </p>
          </div>
          <SessionStatusBadge status={s.status} />
        </li>
      ))}
    </ul>
  );
}

export default async function ClientSessionsTab(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones'>,
) {
  const { clientId } = await props.params;
  const sessions = await getClientSessions(await getTrainerContext(), clientId);
  if (!sessions) notFound();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          as="h2"
          title="Próximas sesiones"
          description="Hoy y las dos próximas semanas."
        />
        <SessionList sessions={sessions.upcoming} empty="Sin sesiones programadas." />
      </Card>
      <Card>
        <CardHeader
          as="h2"
          title="Sesiones anteriores"
          description="Últimas cuatro semanas, con su estado según el registro."
        />
        <SessionList sessions={sessions.past} empty="Sin sesiones anteriores." />
      </Card>
    </div>
  );
}
