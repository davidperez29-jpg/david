import { getPrivacySettings, listPrivacyRequests } from '@tp/application';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PrivacyStatusBadge, rightName } from '@/components/privacy/labels';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { PrivacySettingsForm, ResolveRequestForm } from './forms';

export default async function AdminPrivacyPage() {
  const ctx = await requireStaff();
  if (!ctx.actor.roles.includes('ADMIN')) redirect('/app');
  const [settings, requests] = await Promise.all([
    getPrivacySettings(ctx),
    listPrivacyRequests(ctx),
  ]);
  const open = requests.filter((r) => r.status === 'pending');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Privacidad y RGPD</h1>
      <Card title={`Solicitudes de derechos (${open.length} en curso)`}>
        {requests.length === 0 ? (
          <EmptyState>No hay solicitudes.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rightName(r.type)}</span>
                  <span>·</span>
                  {r.anonymized ? (
                    <span className="text-muted">{r.client}</span>
                  ) : (
                    <Link
                      className="text-accent underline"
                      href={`/app/clients/${r.clientId}?tab=privacidad`}
                    >
                      {r.client}
                    </Link>
                  )}
                  <PrivacyStatusBadge status={r.status} />
                  {r.overdue ? <Badge tone="danger">Fuera de plazo</Badge> : null}
                  <span className="ml-auto text-muted">
                    {formatDate(r.createdAt)} · plazo {formatDate(r.dueOn)}
                  </span>
                </div>
                {r.details ? <p className="text-muted">«{r.details}»</p> : null}
                {r.response ? <p>Respuesta: {r.response}</p> : null}
                {r.status === 'pending' ? (
                  <ResolveRequestForm id={r.id} type={r.type} clientId={r.clientId} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <PrivacySettingsForm
        initial={{
          retentionMonths: settings.retentionMonths,
          requireAdmin2fa: settings.requireAdmin2fa,
        }}
        archivedNotAnonymized={settings.archivedNotAnonymized}
      />
    </div>
  );
}
