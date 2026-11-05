import { CalendarClock, HeartPulse, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { CLIENT_STATUS_LABELS } from '@/domain/people';
import { PendingFeature } from '@/features/shared/pending-feature';
import { Card, CardHeader } from '@/ui/card';
import { Meter } from '@/ui/meter';
import { Notice } from '@/ui/notice';
import { getTrainerContext } from '@/server/context';
import { getClientProfile } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Información' };

export default async function ClientInfoTab(props: PageProps<'/entrenador/clientes/[clientId]'>) {
  const { clientId } = await props.params;
  const ctx = await getTrainerContext();
  const profile = await getClientProfile(ctx, clientId);
  if (!profile) notFound();
  const { client } = profile;
  const rows: [string, string][] = [
    ['Nombre', client.name],
    ['Estado', CLIENT_STATUS_LABELS[client.status]],
    ['Población de referencia', client.populationLabel],
    ['Deporte', client.sport ?? '—'],
    ['Cliente desde', formatDate(client.startedOn, 'dayMonth')],
    ['Objetivo principal', client.goal],
  ];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader as="h2" title="Información del cliente" />
        <dl className="divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="text-ink-500">{label}</dt>
              <dd className="text-right font-semibold text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
        <Notice className="mt-4" icon={<ShieldCheck />}>
          Minimización de datos: la ficha solo guarda lo necesario para entrenar. Los datos de salud
          están aparte, en la pestaña «Salud y readaptación», con acceso restringido.
        </Notice>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader as="h2" icon={<CalendarClock className="size-5" />} title="Próxima sesión" />
          {client.nextSession ? (
            <p className="text-sm text-ink-700">
              <span className="font-bold text-ink-900">
                {formatRelativeDay(client.nextSession.date, ctx.today)}
              </span>{' '}
              · {client.nextSession.title}
            </p>
          ) : (
            <p className="text-sm text-ink-500">Sin sesiones programadas.</p>
          )}
          <p className="mt-4 text-sm font-semibold text-ink-700">
            Últimos 7 días: {client.last7Days.completed} de {client.last7Days.planned} sesiones
            completadas
          </p>
          <Meter
            className="mt-2"
            value={client.last7Days.completed}
            max={client.last7Days.planned}
            label="Sesiones completadas en los últimos 7 días"
            tone="leaf"
          />
        </Card>
        {profile.hasActiveRehab ? (
          <Link
            href={`/entrenador/clientes/${client.id}/salud`}
            className="flex items-center gap-3 rounded-3xl bg-plum-100 p-4 text-sm font-semibold text-plum-700"
          >
            <HeartPulse aria-hidden className="size-5" /> Tiene un proceso de readaptación activo
          </Link>
        ) : null}
        <PendingFeature title="Métricas visibles según población y objetivo" phase="Fases 3 y 5">
          El entrenador podrá elegir qué métricas se siguen y se muestran para cada cliente,
          partiendo de su población y sus objetivos. No se aplicará ningún preajuste «normativo» sin
          fuente verificada.
        </PendingFeature>
      </div>
    </div>
  );
}
