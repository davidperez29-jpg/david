import { ArrowLeft, HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/domain/format';
import { CLIENT_STATUS_LABELS } from '@/domain/people';
import { ClientTabs } from '@/features/trainer/client-tabs';
import { Avatar } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { getTrainerContext } from '@/server/context';
import { getClientProfile } from '@/server/services/client-file';

export default async function ClientFileLayout(
  props: LayoutProps<'/entrenador/clientes/[clientId]'>,
) {
  const { clientId } = await props.params;
  const profile = await getClientProfile(await getTrainerContext(), clientId);
  if (!profile) notFound();
  const { client } = profile;

  return (
    <>
      <Link
        href="/entrenador/clientes"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Clientes
      </Link>
      <header className="flex flex-col gap-5 rounded-[2rem] bg-sun-400 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
        <Avatar initials={client.initials} seed={client.id} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold text-ink-900">{client.name}</h1>
            <Badge tone={client.status === 'active' ? 'leaf' : 'neutral'}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
            {profile.hasActiveRehab ? (
              <Badge tone="plum" icon={<HeartPulse />}>
                Readaptación activa
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-ink-700">{client.goal}</p>
          <p className="mt-2 text-sm text-ink-700">
            {client.populationLabel}
            {client.sport ? ` · ${client.sport}` : ''} · Cliente desde el{' '}
            {formatDate(client.startedOn, 'dayMonth')}
          </p>
        </div>
      </header>
      <div className="mt-5">
        <ClientTabs clientId={client.id} />
      </div>
      <div className="pt-6">{props.children}</div>
    </>
  );
}
