import Link from 'next/link';
import { listAlerts, listPendingAdjustments, type PendingAdjustment } from '@tp/application';
import { AlertActions } from '@/components/monitoring/actions';
import { SeverityBadge } from '@/components/monitoring/severity';
import { PendingAdjustmentItem } from '@/components/programming/adjustments-card';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = { estado?: string; gravedad?: string };

/** Alerts of the trainer's clients, ordered by what requires action (§8.2). */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const { estado = 'activas', gravedad } = await searchParams;
  const severity =
    gravedad === 'red' || gravedad === 'yellow' || gravedad === 'green' ? gravedad : undefined;
  const [rows, adjustments] = await Promise.all([
    listAlerts(ctx, {
      status: estado === 'resueltas' ? 'resolved' : 'live',
      severity,
    }),
    estado === 'resueltas' ? [] : listPendingAdjustments(ctx),
  ]);
  // Pending adjustments grouped by client (restructure phase 12): decided here, next to the alerts.
  const byClient = new Map<string, PendingAdjustment[]>();
  for (const a of adjustments) byClient.set(a.clientId, [...(byClient.get(a.clientId) ?? []), a]);
  const link = (p: SP) => {
    const q = new URLSearchParams({ estado, ...(gravedad ? { gravedad } : {}), ...p } as Record<
      string,
      string
    >);
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `?${q}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Alertas</h1>
        <Link href="/app/settings/alertas" className="ml-auto text-sm text-accent underline">
          Reglas y umbrales
        </Link>
      </div>
      <p className="text-sm text-muted">
        Las alertas describen lo que ha pasado; nunca diagnostican. Tú decides qué hacer. Se
        recalculan al registrar sesiones, valoraciones, bienestar o evaluaciones, y cada día.
      </p>
      <nav aria-label="Filtros de alertas" className="flex flex-wrap gap-2 text-sm">
        {[
          ['activas', 'Activas'],
          ['resueltas', 'Resueltas'],
        ].map(([k, n]) => (
          <Link
            key={k}
            href={link({ estado: k })}
            aria-current={estado === k ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${estado === k ? 'border-accent text-accent' : 'border-border text-muted'}`}
          >
            {n}
          </Link>
        ))}
        <span className="mx-2 text-border">|</span>
        {[
          ['', 'Todas'],
          ['red', '🔴 Rojas'],
          ['yellow', '🟡 Amarillas'],
          ['green', '🟢 Propuestas'],
        ].map(([k, n]) => (
          <Link
            key={k}
            href={link({ gravedad: k })}
            aria-current={(gravedad ?? '') === k ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${(gravedad ?? '') === k ? 'border-accent text-accent' : 'border-border text-muted'}`}
          >
            {n}
          </Link>
        ))}
      </nav>
      {byClient.size ? (
        <Card
          title={
            <span id="ajustes">
              Ajustes propuestos <Badge tone="accent">{adjustments.length}</Badge>
            </span>
          }
        >
          <p className="mb-2 text-xs text-muted">
            Propuestas del motor a partir de lo registrado y de estas alertas. Nada cambia hasta que
            decides: al aceptar se aplican solo a las sesiones futuras sin registrar, con una
            revisión del plan, y se pueden deshacer.
          </p>
          <div className="flex flex-col gap-2">
            {[...byClient.values()].map((list) => (
              <details
                key={list[0]!.clientId}
                className="rounded-md border border-border px-3 py-2"
              >
                <summary className="cursor-pointer">
                  <span className="font-medium">
                    {list[0]!.firstName} {list[0]!.lastName}
                  </span>{' '}
                  <span className="text-sm text-muted">
                    · {list.length} {list.length === 1 ? 'ajuste' : 'ajustes'}
                  </span>
                </summary>
                <ul className="divide-y divide-border">
                  {list.map((a) => (
                    <PendingAdjustmentItem key={a.id} a={a} />
                  ))}
                </ul>
                <Link
                  href={`/app/clients/${list[0]!.clientId}?tab=programa#ajustes`}
                  className="text-xs text-accent underline"
                >
                  Ver el plan de {list[0]!.firstName}
                </Link>
              </details>
            ))}
          </div>
        </Card>
      ) : null}
      <Card>
        {rows.length === 0 ? (
          <EmptyState>
            {estado === 'resueltas' ? 'No hay alertas resueltas.' : 'No hay alertas activas.'}
          </EmptyState>
        ) : (
          <ul aria-label="Lista de alertas" className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <Link
                    href={`/app/clients/${a.clientId}?tab=seguimiento`}
                    className="font-medium hover:underline"
                  >
                    {a.firstName} {a.lastName}
                  </Link>
                  <span className="text-xs text-muted">
                    {a.status === 'seen' ? 'Vista · ' : ''}
                    {formatDateTime(a.updatedAt)}
                  </span>
                  <span className="ml-auto">
                    <AlertActions alertId={a.id} status={a.status} />
                  </span>
                </div>
                <p className="text-sm">{a.message}</p>
                {a.status === 'resolved' ? (
                  <p className="text-xs text-muted">
                    Resuelta {a.resolvedAt ? formatDateTime(a.resolvedAt) : ''}
                    {a.resolutionNote ? ` · ${a.resolutionNote}` : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
