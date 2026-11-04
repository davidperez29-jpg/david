import { CalendarCheck, ChevronRight, CircleAlert, HeartPulse, Users } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/domain/format';
import { firstName } from '@/domain/text';
import { OriginBadge } from '@/features/shared/provenance';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { Avatar } from '@/ui/avatar';
import { Card, CardHeader } from '@/ui/card';
import { Meter } from '@/ui/meter';
import { PageHeader } from '@/ui/page-header';
import { Stat } from '@/ui/stat';
import { getTrainerContext } from '@/server/context';
import { getTrainerDashboard } from '@/server/services/trainer';

export default async function TrainerDashboardPage() {
  const dashboard = await getTrainerDashboard(await getTrainerContext());
  const { week } = dashboard;

  return (
    <>
      <PageHeader
        eyebrow={formatDate(dashboard.today, 'long')}
        title={`Hola, ${firstName(dashboard.trainerName)}`}
        description="Esto es lo que tienes hoy y cómo va la semana de tus clientes."
      />

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          accent
          label="Sesiones hoy"
          value={dashboard.todaySessions.length}
          icon={<CalendarCheck />}
          hint={
            dashboard.todaySessions.length === 1
              ? '1 cliente entrena hoy'
              : `${dashboard.todaySessions.length} clientes entrenan hoy`
          }
        />
        <Stat
          label="Clientes activos"
          value={dashboard.activeClients}
          icon={<Users />}
          hint={`${dashboard.pausedClients} en pausa`}
        />
        <div className="rounded-3xl border border-line/70 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink-500">Sesiones de la semana</p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-900 tabular-nums">
            {week.completed}
            <span className="text-lg font-semibold text-ink-500"> de {week.planned}</span>
          </p>
          <Meter
            className="mt-3"
            value={week.completed}
            max={week.planned}
            label="Sesiones completadas esta semana"
            tone="leaf"
          />
          <p className="mt-2 text-sm text-ink-500">
            {week.missed} no realizadas · {week.planned - week.completed - week.missed} pendientes o
            a medias
          </p>
        </div>
        <Stat
          label="Readaptaciones activas"
          value={dashboard.activeRehabCases}
          icon={<HeartPulse />}
          hint={
            <Link
              href="/entrenador/readaptacion"
              className="font-semibold text-sun-700 hover:text-ink-900"
            >
              Ver procesos
            </Link>
          }
        />
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Entrenan hoy"
            description="Sesiones programadas para hoy y su estado."
          />
          {dashboard.todaySessions.length === 0 ? (
            <p className="text-sm text-ink-500">Hoy no hay sesiones programadas.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dashboard.todaySessions.map(({ clientId, clientName, initials, session }) => (
                <li key={session.id}>
                  <Link
                    href={`/entrenador/clientes/${clientId}`}
                    className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-cream-50"
                  >
                    <Avatar initials={initials} seed={clientId} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink-900">{clientName}</p>
                      <p className="truncate text-sm text-ink-500">
                        {session.title} · {session.exerciseCount} ejercicios ·{' '}
                        {session.estimatedMinutes} min
                      </p>
                    </div>
                    <SessionStatusBadge status={session.status} />
                    <ChevronRight aria-hidden className="size-4 text-ink-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Requiere atención"
              icon={<CircleAlert className="size-5" />}
              description="Hechos registrados, sin interpretaciones automáticas."
            />
            {dashboard.attention.length === 0 ? (
              <p className="text-sm text-ink-500">Nada pendiente por ahora.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.attention.map((item) => (
                  <li key={item.clientId}>
                    <Link
                      href={`/entrenador/clientes/${item.clientId}`}
                      className="block rounded-2xl bg-coral-100/60 px-4 py-3 text-sm hover:bg-coral-100"
                    >
                      <span className="font-bold text-ink-900">{item.clientName}</span>
                      <span className="block text-coral-700">{item.reason}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Evaluaciones recientes"
              description="Últimos 14 días, con el origen de cada dato."
            />
            <ul className="space-y-3">
              {dashboard.recentAssessments.map((item) => (
                <li
                  key={`${item.clientId}-${item.testName}-${item.date}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{item.testName}</p>
                    <p className="text-ink-500">
                      {item.clientName} · {formatDate(item.date, 'short')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-ink-900 tabular-nums">{item.valueLabel}</span>
                    <OriginBadge origin={item.origin} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
