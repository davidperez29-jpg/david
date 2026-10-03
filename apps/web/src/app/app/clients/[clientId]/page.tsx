import Link from 'next/link';
import {
  getClient,
  listCatalog,
  listClientAudit,
  listConsents,
  listHealthDeclarations,
  listTrainers,
} from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ReferralBanner } from '@/components/referral-banner';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatDateTime, label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import {
  AccountPanel,
  ArchivePanel,
  AssignmentsPanel,
  BasicsPanel,
  ConsentsPanel,
  GoalsPanel,
  HealthPanel,
  HistoryPanel,
  ProfilePanel,
} from './panels';

const TABS = [
  ['resumen', 'Resumen'],
  ['perfil', 'Perfil'],
  ['objetivos', 'Objetivos'],
  ['salud', 'Salud declarada'],
  ['privacidad', 'Consentimientos'],
  ['equipo', 'Entrenadores'],
  ['historial', 'Historial de cambios'],
] as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string; nuevo?: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId } = await params;
  const { tab = 'resumen', nuevo } = await searchParams;
  const client = await getClient(ctx, clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const isAdmin = ctx.actor.roles.includes('ADMIN');
  const catalog = tab === 'perfil' || tab === 'objetivos' ? await listCatalog(ctx) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/clients" className="text-sm text-muted hover:underline">
          ← Clientes
        </Link>
        <h1 className="text-2xl font-semibold">
          {client.firstName} {client.lastName}
        </h1>
        <Badge tone={client.status === 'active' ? 'ok' : 'neutral'}>
          {label('status', client.status)}
        </Badge>
        <Badge>{label('modality', client.modality)}</Badge>
        {client.age !== null ? <span className="text-sm text-muted">{client.age} años</span> : null}
      </div>
      <ReferralBanner text={client.referral.text} />
      {nuevo ? (
        <p className="rounded-md border border-accent p-3 text-sm">
          Cliente creado. Registra ahora el consentimiento para datos de salud y el cribado previo a
          la participación.
        </p>
      ) : null}
      <nav
        className="flex flex-wrap gap-1 border-b border-border"
        aria-label="Secciones del cliente"
      >
        {TABS.map(([key, name]) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-accent font-medium text-text' : 'border-transparent text-muted hover:text-text'}`}
          >
            {name}
          </Link>
        ))}
      </nav>

      {tab === 'resumen' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Objetivo">
            {client.goals.length === 0 ? (
              <EmptyState>Sin objetivos definidos.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {client.goals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2">
                    {g.isPrimary ? (
                      <Badge tone="accent">Principal</Badge>
                    ) : (
                      <Badge>Secundario</Badge>
                    )}
                    <span>{g.name}</span>
                    {g.sportName ? <span className="text-muted">· {g.sportName}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Entrenamiento">
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">Experiencia</dt>
              <dd>{label('experience', client.profile?.experienceLevel)}</dd>
              <dt className="text-muted">Años</dt>
              <dd>{client.profile?.yearsTraining ?? '—'}</dd>
              <dt className="text-muted">Sesiones/sem</dt>
              <dd>{client.profile?.sessionsPerWeek ?? '—'}</dd>
              <dt className="text-muted">Duración</dt>
              <dd>
                {client.profile?.sessionDurationMin
                  ? `${client.profile.sessionDurationMin} min`
                  : '—'}
              </dd>
              <dt className="text-muted">Días</dt>
              <dd>
                {client.availability
                  .map((a) => LABELS.weekday[a.weekday]?.slice(0, 3))
                  .join(', ') || '—'}
              </dd>
            </dl>
          </Card>
          <Card title="Próximos pasos">
            <ul className="list-inside list-disc text-sm text-muted">
              <li>Evaluación inicial — Fase 5</li>
              <li>Programa — Fase 6</li>
              <li>Seguimiento y adherencia — Fase 8</li>
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'perfil' && catalog ? (
        <div className="flex flex-col gap-4">
          <BasicsPanel client={client} />
          <ProfilePanel client={client} catalog={catalog} />
          <AccountPanel clientId={client.id} hasAccount={client.hasAccount} email={client.email} />
          <ArchivePanel clientId={client.id} archived={client.status === 'archived'} />
        </div>
      ) : null}

      {tab === 'objetivos' && catalog ? <GoalsPanel client={client} catalog={catalog} /> : null}

      {tab === 'salud' ? (
        <HealthPanel
          clientId={client.id}
          data={await listHealthDeclarations(ctx, client.id)}
          consents={await listConsents(ctx, client.id)}
        />
      ) : null}

      {tab === 'privacidad' ? (
        <ConsentsPanel clientId={client.id} data={await listConsents(ctx, client.id)} />
      ) : null}

      {tab === 'equipo' ? (
        <div className="flex flex-col gap-4">
          <AssignmentsPanel
            clientId={client.id}
            assignments={client.assignments}
            trainers={isAdmin ? await listTrainers(ctx) : []}
            canManage={isAdmin}
          />
          <HistoryPanel
            clientId={client.id}
            history={client.history.map((h) => ({
              id: h.id,
              kind: h.kind,
              periodStart: h.periodStart,
              periodEnd: h.periodEnd,
              description: h.description,
            }))}
          />
        </div>
      ) : null}

      {tab === 'historial' ? (
        <Card title="Historial de cambios">
          <ol className="divide-y divide-border text-sm">
            {(await listClientAudit(ctx, client.id)).map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex flex-wrap gap-2">
                  <span className="tabular-nums text-muted">{formatDateTime(a.occurredAt)}</span>
                  <span className="font-medium">{a.actor ?? 'Sistema'}</span>
                  <span>
                    {label('audit', a.action)} · {label('entity', a.entityType)}
                  </span>
                </div>
                {Array.isArray(a.changes) ? (
                  <ul className="mt-1 text-muted">
                    {(a.changes as { field: string; before: unknown; after: unknown }[]).map(
                      (c, i) => (
                        <li key={i}>
                          {label('field', c.field)}: {fmt(c.before)} → {fmt(c.after)}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
                {a.reason ? <p className="mt-1 text-muted">Motivo: {a.reason}</p> : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      <p className="text-xs text-muted">Alta: {formatDate(client.joinedAt)}</p>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
