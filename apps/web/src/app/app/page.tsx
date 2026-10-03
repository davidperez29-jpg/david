import Link from 'next/link';
import {
  listAlerts,
  listClients,
  listClientsNeedingReferral,
  monitoringOverview,
  reviewInbox,
} from '@tp/application';
import { AlertActions } from '@/components/monitoring/actions';
import { SeverityBadge } from '@/components/monitoring/severity';
import { label } from '@/lib/labels';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

export default async function TodayPage() {
  const ctx = await requireStaff();
  const page = await listClients(ctx, { limit: 100 });
  const active = page.items.filter((c) => c.status === 'active');
  // Phase 1: attention list = referral flags and clients without a primary goal.
  const referral = await listClientsNeedingReferral(ctx);
  const noGoal = page.items.filter((c) => !c.primaryGoal);
  const noAccount = page.items.filter((c) => !c.hasAccount && c.modality !== 'in_person');
  const [inbox, overview, alerts] = await Promise.all([
    reviewInbox(ctx),
    monitoringOverview(ctx),
    listAlerts(ctx, { status: 'live', limit: 8 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hoy</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clientes activos" value={active.length} />
        <Stat label="Requieren atención" value={referral.length + noGoal.length} />
        <Stat
          label="Sesiones hoy"
          value={inbox.sessionsToday.length}
          hint={`${inbox.sessionsToday.filter((x) => x.attendance).length} registradas`}
        />
        <Stat
          label="Adherencia 28 d"
          value={
            overview.adherence28.percent == null
              ? '—'
              : `${overview.adherence28.percent.toLocaleString('es-ES')} %`
          }
          hint={`${overview.adherence28.done} de ${overview.adherence28.planned} sesiones`}
        />
      </div>
      <Card
        title={`Alertas (${overview.alerts.red} rojas · ${overview.alerts.yellow} amarillas · ${overview.alerts.green} propuestas)`}
        actions={
          <Link href="/app/alerts" className="text-sm text-accent underline">
            Ver todas
          </Link>
        }
      >
        {alerts.length === 0 ? (
          <EmptyState>Sin alertas activas.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <SeverityBadge severity={a.severity} />
                <Link
                  className="font-medium hover:underline"
                  href={`/app/clients/${a.clientId}?tab=seguimiento`}
                >
                  {a.firstName} {a.lastName}
                </Link>
                <span className="min-w-0 flex-1 text-muted">{a.message}</span>
                <AlertActions alertId={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Sesiones de hoy">
          {inbox.sessionsToday.length === 0 ? (
            <EmptyState>No hay sesiones programadas hoy.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {inbox.sessionsToday.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/clients/${x.clientId}/sessions/${x.id}`}
                  >
                    {x.firstName} {x.lastName}
                  </Link>
                  <span className="text-muted">
                    {x.time ? `${x.time.slice(0, 5)} · ` : ''}
                    {x.dayLabel} · {x.title}
                  </span>
                  {x.attendance ? (
                    <Badge tone={x.attendance === 'completed' ? 'ok' : 'warn'}>
                      {label('attendance', x.attendance)}
                    </Badge>
                  ) : x.published ? null : (
                    <Badge>No publicada</Badge>
                  )}
                  <Link
                    className="ml-auto text-xs text-accent underline"
                    href={`/app/clients/${x.clientId}/sessions/${x.id}/sala`}
                  >
                    Modo sala
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Revisión de sesiones">
          {inbox.substitutions.length + inbox.flaggedLogs.length === 0 ? (
            <EmptyState>Nada pendiente de revisar.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {inbox.substitutions.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Badge tone={x.reason === 'pain' ? 'danger' : 'warn'}>
                    {label('substitutionReason', x.reason)}
                  </Badge>
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/clients/${x.clientId}/sessions/${x.sessionId}`}
                  >
                    {x.firstName} {x.lastName}
                  </Link>
                  <span className="text-muted">no pudo hacer {x.exercise}</span>
                </li>
              ))}
              {inbox.flaggedLogs.map((x) => (
                <li key={x.sessionId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Badge tone="warn">Revisar registro</Badge>
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/clients/${x.clientId}/sessions/${x.sessionId}`}
                  >
                    {x.firstName} {x.lastName}
                  </Link>
                  <span className="text-muted">
                    {x.count} series · {x.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Requiere acción">
        {referral.length + noGoal.length + noAccount.length === 0 ? (
          <EmptyState>Nada pendiente.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {referral.map((c) => (
              <li key={`r-${c.id}`} className="flex items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <Badge tone="danger">Atención</Badge>
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/clients/${c.id}?tab=salud`}
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className="text-sm text-muted">
                    Requiere valoración por profesional sanitario
                  </span>
                </span>
              </li>
            ))}
            {noGoal.map((c) => (
              <li key={`g-${c.id}`} className="flex items-center gap-2 py-2">
                <Badge tone="warn">Revisar</Badge>
                <Link
                  className="font-medium hover:underline"
                  href={`/app/clients/${c.id}?tab=objetivos`}
                >
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-sm text-muted">Sin objetivo principal</span>
              </li>
            ))}
            {noAccount.map((c) => (
              <li key={`a-${c.id}`} className="flex items-center gap-2 py-2">
                <Badge tone="neutral">Info</Badge>
                <Link className="font-medium hover:underline" href={`/app/clients/${c.id}`}>
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-sm text-muted">
                  Entrena online sin cuenta en la app: envía la invitación
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
