import Link from 'next/link';
import {
  clientSessionReview,
  clientAssessmentProgress,
  getClient,
  listAssessmentTests,
  listBatteries,
  listClientAssessments,
  listClientPlans,
  listPlanTemplates,
  proposeAssessmentBattery,
  listCatalog,
  listClientAudit,
  listConsents,
  listExerciseTolerances,
  listHealthDeclarations,
  listLibraryTaxonomies,
  listTrainers,
} from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ProgressView } from '@/components/assessment/progress';
import { ReferralBanner } from '@/components/referral-banner';
import { NewAssessmentForm } from '../../assessments/forms';
import { NewPlanForm } from '../../plans/forms';
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
  TolerancesPanel,
} from './panels';

const TABS = [
  ['resumen', 'Resumen'],
  ['perfil', 'Perfil'],
  ['objetivos', 'Objetivos'],
  ['evaluaciones', 'Evaluaciones'],
  ['planificacion', 'Planificación'],
  ['sesiones', 'Sesiones'],
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

      {tab === 'evaluaciones' ? await assessmentsTab(ctx, client.id) : null}

      {tab === 'planificacion' ? await plansTab(ctx, client.id) : null}

      {tab === 'sesiones' ? await sessionsTab(ctx, client.id) : null}

      {tab === 'salud' ? (
        <div className="flex flex-col gap-4">
          <HealthPanel
            clientId={client.id}
            data={await listHealthDeclarations(ctx, client.id)}
            consents={await listConsents(ctx, client.id)}
          />
          <TolerancesPanel
            clientId={client.id}
            rows={await listExerciseTolerances(ctx, client.id)}
            patterns={(await listLibraryTaxonomies(ctx)).patterns}
            hasConsent={
              (await listConsents(ctx, client.id)).status.find((s) => s.purpose === 'health_data')
                ?.active ?? false
            }
          />
        </div>
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

async function assessmentsTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const [list, progress, proposal, batteries, tests] = await Promise.all([
    listClientAssessments(ctx, clientId),
    clientAssessmentProgress(ctx, clientId),
    proposeAssessmentBattery(ctx, clientId),
    listBatteries(ctx),
    listAssessmentTests(ctx),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Evaluaciones">
        {list.length === 0 ? (
          <EmptyState>Sin evaluaciones registradas.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link
                  href={`/app/clients/${clientId}/assessments/${a.id}`}
                  className="font-medium hover:underline"
                >
                  {formatDate(a.assessedOn)}
                </Link>
                {a.battery ? <span className="text-muted">{a.battery}</span> : null}
                {a.context ? <span className="text-muted">· {a.context}</span> : null}
                <Badge
                  tone={
                    a.status === 'completed'
                      ? 'ok'
                      : a.status === 'cancelled'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {label('assessmentStatus', a.status)}
                </Badge>
                <span className="text-xs text-muted">
                  {a.results} resultado(s) de {a.planned} test(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Progreso</h2>
        <ProgressView data={progress} audience="trainer" />
      </section>
      <Card title="Nueva evaluación">
        <div className="mb-3 text-sm">
          <p className="font-medium">
            Propuesta: {proposal.batteryName ?? 'sin batería'}
            {proposal.screening !== 'clear' ? (
              <Badge tone="warn">
                {proposal.screening === 'refer'
                  ? 'Cribado con derivación'
                  : 'Sin cribado registrado'}
              </Badge>
            ) : null}
          </p>
          <ul className="list-inside list-disc text-xs text-muted">
            {proposal.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <NewAssessmentForm
          clientId={clientId}
          proposal={proposal}
          batteries={batteries.map((b) => ({ id: b.id, name: b.name, testIds: b.testIds }))}
          tests={tests.map((t) => ({ id: t.id, name: t.name, category: t.category }))}
        />
      </Card>
    </div>
  );
}

async function plansTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const [plans, templates] = await Promise.all([
    listClientPlans(ctx, clientId),
    listPlanTemplates(ctx),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Planes">
        {plans.length === 0 ? (
          <EmptyState>Sin planes todavía.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link href={`/app/plans/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <Badge tone={p.status === 'active' ? 'ok' : 'neutral'}>
                  {label('planStatus', p.status)}
                </Badge>
                <span className="text-xs text-muted">
                  {p.weeks} semanas · {p.sessionsPerWeek} días/semana
                  {p.startDate ? ` · desde ${formatDate(p.startDate)}` : ''}
                  {p.template ? ` · plantilla «${p.template}»` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Nuevo plan">
        <NewPlanForm clientId={clientId} templates={templates} />
      </Card>
    </div>
  );
}

async function sessionsTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const rows = await clientSessionReview(ctx, clientId);
  return (
    <Card title="Sesiones realizadas y pendientes de registro">
      {rows.length === 0 ? (
        <EmptyState>Sin sesiones publicadas ni registradas todavía.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="w-24 text-muted tabular-nums">
                {r.date ? formatDate(r.date) : '—'}
              </span>
              <Link
                href={`/app/clients/${clientId}/sessions/${r.id}`}
                className="font-medium hover:underline"
              >
                {r.dayLabel} · {r.title}
              </Link>
              {r.status ? (
                <Badge tone={r.status === 'completed' ? 'ok' : 'warn'}>
                  {label('attendance', r.status)}
                </Badge>
              ) : (
                <Badge>Sin registrar</Badge>
              )}
              {r.sessionRpe != null ? (
                <span className="text-xs text-muted">RPE sesión {r.sessionRpe}</span>
              ) : null}
              {r.pain != null ? <Badge tone="warn">Dolor {r.pain}/10</Badge> : null}
              {r.flaggedLogs ? (
                <Badge tone="warn">{r.flaggedLogs} registros a revisar</Badge>
              ) : null}
              {r.pendingSubstitutions ? (
                <Badge tone="danger">{r.pendingSubstitutions} sustituciones pendientes</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
