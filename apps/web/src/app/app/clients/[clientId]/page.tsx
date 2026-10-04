import Link from 'next/link';
import {
  clientMonitoring,
  clientSummary,
  getMonitoringRules,
  clientSessionReview,
  clientAssessmentProgress,
  getClient,
  defaultReportPeriod,
  listClientReports,
  getDecision,
  listAdjustments,
  listPlanProposals,
  listAssessmentTests,
  listBatteries,
  listClientAssessments,
  listClientPlans,
  listPlanTemplates,
  proposeAssessmentBattery,
  listCatalog,
  listClientAudit,
  listConsents,
  listExternalMeasurements,
  listClientPrivacyRequests,
  listExerciseTolerances,
  listHealthDeclarations,
  listLibraryTaxonomies,
  listTrainers,
} from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ProgressView } from '@/components/assessment/progress';
import { VisibleMetricsPicker } from '@/components/assessment/visible-metrics';
import { ReferralBanner } from '@/components/referral-banner';
import {
  AlertActions,
  RefreshAlertsButton,
  RuleOverrideToggle,
} from '@/components/monitoring/actions';
import { WeeklyLoadChart } from '@/components/monitoring/charts';
import { SeverityBadge } from '@/components/monitoring/severity';
import { NewAssessmentForm } from '../../assessments/forms';
import { NewPlanForm } from '../../plans/forms';
import { ExportForm, GenerateReportForm } from '@/components/reports/actions';
import { AdjustmentsCard } from '@/components/programming/adjustments-card';
import { GenerateProposalForm } from '@/components/programming/actions';
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
import { DecisionTab } from './decision-tab';
import { ExternalImportForm } from '@/components/integrations/external-import';
import { SubjectRightsPanel } from '@/components/privacy/erase';
import { PrivacyStatusBadge, rightName, type PrivacyRequestRow } from '@/components/privacy/labels';

function ClientRequestsCard({ requests }: { requests: PrivacyRequestRow[] }) {
  return (
    <Card
      title="Solicitudes de derechos"
      actions={
        <Link className="text-sm text-accent underline" href="/app/admin/privacidad">
          Bandeja
        </Link>
      }
    >
      {requests.length === 0 ? (
        <EmptyState>Sin solicitudes.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{rightName(r.type)}</span>
              <PrivacyStatusBadge status={r.status} />
              <span className="ml-auto text-muted">
                {formatDate(r.createdAt)} · plazo {formatDate(r.dueOn)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const TABS = [
  ['resumen', 'Resumen'],
  ['perfil', 'Perfil'],
  ['objetivos', 'Objetivos'],
  ['evaluaciones', 'Evaluaciones'],
  ['necesidades', 'Necesidades'],
  ['planificacion', 'Planificación'],
  ['sesiones', 'Sesiones'],
  ['seguimiento', 'Seguimiento'],
  ['salud', 'Salud declarada'],
  ['privacidad', 'Consentimientos'],
  ['equipo', 'Entrenadores'],
  ['informes', 'Informes'],
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
  const summary = tab === 'resumen' ? await clientSummary(ctx, client.id) : null;

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

      {summary ? <SummaryRow clientId={client.id} s={summary} /> : null}

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
          <Card title="Accesos rápidos">
            <ul className="flex flex-col gap-1 text-sm">
              <li>
                <Link href="?tab=seguimiento" className="text-accent underline">
                  Seguimiento: adherencia, carga y alertas
                </Link>
              </li>
              <li>
                <Link href="?tab=sesiones" className="text-accent underline">
                  Sesiones registradas
                </Link>
              </li>
              <li>
                <Link href={`/app/calendar?cliente=${client.id}`} className="text-accent underline">
                  Calendario del cliente
                </Link>
              </li>
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

      {tab === 'evaluaciones' ? await assessmentsTab(ctx, client.id, client.progressTestIds) : null}

      {tab === 'necesidades' ? (
        <DecisionTab ctx={ctx} clientId={client.id} isAdmin={isAdmin} />
      ) : null}

      {tab === 'informes' ? await reportsTab(ctx, client.id) : null}

      {tab === 'planificacion' ? await plansTab(ctx, client.id) : null}

      {tab === 'sesiones' ? await sessionsTab(ctx, client.id) : null}

      {tab === 'seguimiento' ? await monitoringTab(ctx, client.id) : null}

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
        <div className="flex flex-col gap-4">
          <ConsentsPanel clientId={client.id} data={await listConsents(ctx, client.id)} />
          {isAdmin ? (
            <>
              <ClientRequestsCard requests={await listClientPrivacyRequests(ctx, client.id)} />
              <SubjectRightsPanel
                clientId={client.id}
                fullName={`${client.firstName} ${client.lastName}`}
                anonymized={client.anonymizedAt != null}
              />
            </>
          ) : null}
        </div>
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

async function assessmentsTab(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  clientId: string,
  visibleIds: string[],
) {
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
        {progress.series.length ? (
          <Card title="Visible para el cliente">
            <VisibleMetricsPicker
              clientId={clientId}
              tests={[
                ...new Map(progress.series.map((x) => [x.test.id, x.test.name])).entries(),
              ].map(([id, name]) => ({ id, name }))}
              selected={visibleIds}
            />
          </Card>
        ) : null}
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
  const [plans, templates, proposals, adjustments, decision] = await Promise.all([
    listClientPlans(ctx, clientId),
    listPlanTemplates(ctx),
    listPlanProposals(ctx, clientId),
    listAdjustments(ctx, clientId),
    getDecision(ctx, clientId),
  ]);
  const proposedSlug = decision.run?.result.planSkeleton?.templateSlug ?? null;
  const proposedTpl = templates.find((t) => t.slug === proposedSlug) ?? null;
  const nextMonday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((8 - (d.getUTCDay() || 7)) % 7 || 7));
    return d.toISOString().slice(0, 10);
  })();
  const open = proposals.filter((p) => p.status === 'proposed');
  return (
    <div className="flex flex-col gap-4">
      {plans.some((p) => p.status === 'active') ? (
        <AdjustmentsCard
          clientId={clientId}
          items={adjustments.items}
          autoApply={adjustments.autoApplyLoadProgressions}
        />
      ) : null}
      <Card title="Propuesta de plan del motor">
        {open.length ? (
          <ul className="mb-3 divide-y divide-border">
            {open.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link href={`/app/plans/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <Badge tone="accent">Propuesta</Badge>
                <span className="text-xs text-muted">
                  {p.startDate ? `desde ${formatDate(p.startDate)}` : ''} · creada{' '}
                  {formatDateTime(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {decision.run ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Parte de una plantilla y la adapta al resultado del motor de decisiones (fase de
              introducción, ejercicios no tolerados o sin material). Se crea como propuesta
              editable: tu plan activo no cambia. Al aceptarla pasa a ser un plan en borrador.
              {proposedTpl ? ` Plantilla propuesta: «${proposedTpl.name}».` : ''}
            </p>
            <GenerateProposalForm
              clientId={clientId}
              proposed={proposedTpl}
              templates={templates}
              defaultStart={nextMonday}
            />
          </>
        ) : (
          <EmptyState>
            Calcula primero las propuestas en{' '}
            <Link href="?tab=necesidades" className="text-accent underline">
              Necesidades
            </Link>
            .
          </EmptyState>
        )}
      </Card>
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

async function reportsTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const list = await listClientReports(ctx, clientId);
  const period = defaultReportPeriod(ctx.now());
  return (
    <div className="flex flex-col gap-4">
      <Card title="Nuevo informe">
        <GenerateReportForm clientId={clientId} defaultFrom={period.from} defaultTo={period.to} />
      </Card>
      <Card title="Informes generados">
        {list.length === 0 ? (
          <EmptyState>Sin informes todavía.</EmptyState>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link
                  href={`/app/clients/${clientId}/informes/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {formatDate(r.parameters.from)} – {formatDate(r.parameters.to)}
                </Link>
                <span className="text-xs text-muted">
                  {formatDateTime(r.createdAt)}
                  {r.by ? ` · ${r.by}` : ''}
                </span>
                {r.sharedAt ? <Badge tone="ok">Compartido</Badge> : null}
                <a
                  className="text-xs text-accent underline"
                  href={`/api/v1/reports/${r.id}/download?format=pdf`}
                >
                  PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Exportar datos de este cliente">
        <ExportForm clients={[]} clientId={clientId} />
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

const pct = (v: number | null) =>
  v == null ? '—' : `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

async function monitoringTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const [m, rules, adj, ext] = await Promise.all([
    clientMonitoring(ctx, clientId),
    getMonitoringRules(ctx),
    listAdjustments(ctx, clientId),
    listExternalMeasurements(ctx, clientId, {}),
  ]);
  const pendingAdj = adj.items.filter((i) => i.status === 'proposed' || i.status === 'postponed');
  return (
    <div className="flex flex-col gap-4">
      {pendingAdj.length ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md border border-accent p-3 text-sm">
          {pendingAdj.length === 1
            ? 'Hay 1 propuesta de ajuste del plan'
            : `Hay ${pendingAdj.length} propuestas de ajuste del plan`}{' '}
          (
          {pendingAdj
            .map((a) => a.title)
            .slice(0, 2)
            .join(' · ')}
          {pendingAdj.length > 2 ? '…' : ''}).
          <Link href="?tab=planificacion#ajustes" className="text-accent underline">
            Ver propuesta de ajuste
          </Link>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Adherencia 4 semanas">
          <p className="text-2xl font-semibold tabular-nums">{pct(m.adherence28.percent)}</p>
          <p className="text-xs text-muted">
            {m.adherence28.done} de {m.adherence28.planned} sesiones realizadas (
            {m.adherence28.partial} parciales, {m.adherence28.missed + m.adherence28.unrecorded} no
            realizadas)
          </p>
        </Card>
        <Card title="Adherencia 12 semanas">
          <p className="text-2xl font-semibold tabular-nums">{pct(m.adherence84.percent)}</p>
          <p className="text-xs text-muted">
            {m.adherence84.done} de {m.adherence84.planned} sesiones
          </p>
        </Card>
        <Card title="Alertas activas" actions={<RefreshAlertsButton clientId={clientId} />}>
          <p className="text-2xl font-semibold tabular-nums">{m.alerts.length}</p>
        </Card>
      </div>

      <Card title="Alertas">
        {m.alerts.length === 0 ? (
          <EmptyState>Sin alertas activas.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {m.alerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-xs text-muted">{formatDateTime(a.updatedAt)}</span>
                  <span className="ml-auto">
                    <AlertActions alertId={a.id} status={a.status} />
                  </span>
                </div>
                <p className="text-sm">{a.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Carga interna semanal (RPE de la sesión × minutos, UA)">
        <div className="grid gap-4 lg:grid-cols-2">
          <WeeklyLoadChart weeks={m.weeks} />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1">Semana</th>
                <th>Sesiones</th>
                <th>Adherencia</th>
                <th>Carga</th>
                <th title="Media / desviación típica de la carga diaria">Monotonía</th>
                <th title="Carga × monotonía">Tensión</th>
              </tr>
            </thead>
            <tbody>
              {m.weeks.map((w) => (
                <tr key={w.weekStart} className="border-t border-border tabular-nums">
                  <td className="py-1">{formatDate(w.weekStart)}</td>
                  <td>
                    {w.adherence.done}/{w.adherence.planned}
                  </td>
                  <td>{pct(w.adherence.percent)}</td>
                  <td>{w.load.toLocaleString('es-ES')}</td>
                  <td>{w.monotony?.toLocaleString('es-ES') ?? '—'}</td>
                  <td>{w.strain?.toLocaleString('es-ES') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Método sRPE: válido y fiable para cuantificar la carga interna en muchos deportes y
          actividades (según PubMed: Foster 2001, PMID 11708692;{' '}
          <a className="underline" href="https://doi.org/10.3389/fnins.2017.00612">
            Haddad 2017
          </a>
          ). La monotonía y la tensión son descriptivas, sin umbrales universales (
          <a className="underline" href="https://doi.org/10.1097/00005768-199807000-00023">
            Foster 1998
          </a>
          ). No se calcula el ratio agudo:crónico (
          <a className="underline" href="https://doi.org/10.1123/ijspp.2019-0864">
            Impellizzeri 2020
          </a>
          ). Solo suman carga las sesiones con RPE y duración.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Últimas sesiones">
          {m.recent.length === 0 ? (
            <EmptyState>Sin sesiones pasadas.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1">Fecha</th>
                  <th>Estado</th>
                  <th>RPE (previsto)</th>
                  <th>Min</th>
                  <th>Carga</th>
                </tr>
              </thead>
              <tbody>
                {m.recent.map((r) => (
                  <tr key={r.id} className="border-t border-border tabular-nums">
                    <td className="py-1">
                      <Link
                        href={`/app/clients/${clientId}/sessions/${r.id}`}
                        className="hover:underline"
                      >
                        {formatDate(r.date)}
                      </Link>
                    </td>
                    <td>{r.status ? label('attendance', r.status) : 'Sin registrar'}</td>
                    <td>
                      {r.sessionRpe ?? '—'}
                      {r.targetRpe != null ? ` (${r.targetRpe})` : ''}
                    </td>
                    <td>{r.durationMin ?? '—'}</td>
                    <td>{r.load ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Bienestar diario (0–10, más alto = mejor)">
          {m.readiness.length === 0 ? (
            <EmptyState>El cliente no ha registrado su bienestar en 14 días.</EmptyState>
          ) : (
            <ul className="text-sm">
              {m.readiness.map((r) => (
                <li key={r.date} className="flex gap-3 tabular-nums">
                  <span className="w-24 text-muted">{formatDate(r.date)}</span>
                  <span className="w-16 font-medium">{r.score ?? '—'}</span>
                  <span className="text-xs text-muted">
                    energía {r.energy ?? '—'} · sueño {r.sleepQuality ?? '—'} · agujetas{' '}
                    {r.soreness ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Reglas de alerta para este cliente">
        <details open={m.disabledRules.length > 0}>
          <summary className="cursor-pointer text-sm text-muted">
            {m.disabledRules.length
              ? `${m.disabledRules.length} reglas desactivadas para este cliente`
              : 'Todas las reglas del centro están activas'}
          </summary>
          <p className="my-2 text-xs text-muted">
            Puedes desactivar una regla solo para este cliente (por ejemplo, durante una pausa
            acordada). Queda auditado.
          </p>
          <ul>
            {rules.rules
              .filter((r) => r.enabled)
              .map((r) => {
                const off = m.disabledRules.find((d) => d.key === r.key);
                return (
                  <RuleOverrideToggle
                    key={r.key}
                    clientId={clientId}
                    ruleKey={r.key}
                    name={r.name}
                    disabled={!!off}
                    reason={off?.reason ?? null}
                  />
                );
              })}
          </ul>
        </details>
      </Card>
      <Card title="Datos de dispositivos">
        <p className="mb-2 text-xs text-muted">
          Mediciones importadas de relojes, apps o dispositivos (CSV o JSON). Frecuencia cardiaca,
          variabilidad y sueño son datos de salud: solo con el consentimiento del cliente. Formato
          en docs/INTEGRATIONS.md.
        </p>
        {ext.length === 0 ? (
          <EmptyState>Sin mediciones importadas.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1">Fecha</th>
                  <th>Medida</th>
                  <th>Valor</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ext.slice(0, 15).map((x) => (
                  <tr key={x.id}>
                    <td className="py-1">{formatDateTime(x.measuredAt)}</td>
                    <td>{x.label}</td>
                    <td>
                      {x.value.toLocaleString('es-ES')} {x.unit}
                    </td>
                    <td className="text-muted">{x.device ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <ExternalImportForm clientId={clientId} />
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({
  clientId,
  s,
}: {
  clientId: string;
  s: Awaited<ReturnType<typeof clientSummary>>;
}) {
  const pctTxt =
    s.adherence28.percent == null ? '—' : `${s.adherence28.percent.toLocaleString('es-ES')} %`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Plan activo">
          {s.plan ? (
            <>
              <Link href={`/app/plans/${s.plan.id}`} className="font-medium hover:underline">
                {s.plan.name}
              </Link>
              <p className="text-sm text-muted">
                {s.plan.current
                  ? `${s.plan.current.phase} · semana ${s.plan.current.weekIndex} de ${s.plan.current.totalWeeks} (${label('weekType', s.plan.current.weekType)})`
                  : 'Fuera de las fechas del plan'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Sin plan activo.</p>
          )}
        </Card>
        <Card title="Próxima sesión">
          {s.next ? (
            <>
              <Link
                href={`/app/clients/${clientId}/sessions/${s.next.id}`}
                className="font-medium hover:underline"
              >
                {s.next.title ?? `Sesión ${s.next.dayLabel}`}
              </Link>
              <p className="text-sm text-muted">
                {s.next.isToday ? 'Hoy' : formatDate(s.next.date)}
                {s.next.published ? '' : ' · no publicada'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Nada programado.</p>
          )}
        </Card>
        <Card title="Adherencia 4 semanas">
          <p className="text-2xl font-semibold tabular-nums">{pctTxt}</p>
          <p className="text-xs text-muted">
            {s.adherence28.done} de {s.adherence28.planned} sesiones
          </p>
        </Card>
        <Card title="Alertas">
          <p className="text-sm">
            🔴 {s.alerts.red} · 🟡 {s.alerts.yellow} · 🟢 {s.alerts.green}
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-xs">
            {s.alerts.top.map((a) => (
              <li key={a.id} className="line-clamp-2">
                {a.message}
              </li>
            ))}
          </ul>
          <Link href="?tab=seguimiento" className="text-xs text-accent underline">
            Seguimiento
          </Link>
        </Card>
      </div>
      {s.keyMetrics.length ? (
        <Card title="Métricas clave">
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {s.keyMetrics.map((m) => (
              <li key={m.testId} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted">{m.name}</p>
                <p className="font-semibold tabular-nums">
                  {m.last.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {m.unit}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(m.last.on)}
                  {m.label ? ` · ${m.label}` : m.points < 2 ? ' · una sola medición' : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
