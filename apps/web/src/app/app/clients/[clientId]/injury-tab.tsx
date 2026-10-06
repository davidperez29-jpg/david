import Link from 'next/link';
import {
  listClientInjuries,
  listConsents,
  listInjuryCatalog,
  type RequestContext,
} from '@tp/application';
import { localDate } from '@tp/domain';
import { NewInjuryForm } from '@/components/injury/forms';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate } from '@/lib/labels';

export const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral' | 'accent'> = {
  not_started: 'neutral',
  in_progress: 'accent',
  partial: 'warn',
  ready_for_assessment: 'ok',
  decision_pending: 'ok',
  closed: 'neutral',
};

/**
 * Readaptación (restructure phase 7, docs/INJURY_MODULE.md): the client's injury cases and a
 * form to open one. [SALUD] Staff only, with the explicit health-data consent.
 */
export async function InjuryTab({ ctx, clientId }: { ctx: RequestContext; clientId: string }) {
  const [cases, catalog, consents] = await Promise.all([
    listClientInjuries(ctx, clientId),
    listInjuryCatalog(ctx),
    listConsents(ctx, clientId),
  ]);
  const consent = consents.status.find((s) => s.purpose === 'health_data')?.active ?? false;
  const active = cases.items.filter((c) => c.status !== 'closed');
  const closed = cases.items.filter((c) => c.status === 'closed');
  const row = (c: (typeof cases.items)[number]) => (
    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="flex flex-col">
        <Link
          href={`/app/clients/${clientId}/lesiones/${c.id}`}
          className="font-medium text-accent underline"
        >
          {c.condition}
          {c.side !== 'none' ? ` · ${c.sideLabel.toLowerCase()}` : ''}
        </Link>
        <span className="text-sm text-muted">
          {formatDate(c.occurredOn)}
          {c.phase ? ` · Fase ${c.phaseNumber}/${c.phasesCount}: ${c.phase}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.openAlerts ? <Badge tone="danger">{c.openAlerts} alerta(s) sin revisar</Badge> : null}
        <Badge tone={STATUS_TONE[c.status]}>{c.statusLabel}</Badge>
      </div>
    </li>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Seguimiento de la readaptación por fases y criterios. La plataforma no diagnostica ni decide
        la vuelta al deporte: como mucho muestra «Listo para valoración»; la decisión es del equipo
        responsable.
      </p>
      <Card title="Casos activos">
        {active.length ? (
          <ul className="divide-y divide-border">{active.map(row)}</ul>
        ) : (
          <EmptyState>Sin lesiones activas.</EmptyState>
        )}
      </Card>
      <Card title="Abrir un caso de lesión">
        {consent ? (
          <NewInjuryForm
            clientId={clientId}
            conditions={catalog.conditions}
            sides={catalog.sides}
            today={localDate(new Date())}
          />
        ) : (
          <p className="text-sm">
            Falta el consentimiento explícito para tratar datos de salud. Regístralo en{' '}
            <Link href="?tab=ficha#privacidad" className="text-accent underline">
              Ficha → Consentimientos
            </Link>
            .
          </p>
        )}
      </Card>
      {closed.length ? (
        <Card title="Casos cerrados">
          <ul className="divide-y divide-border">{closed.map(row)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
