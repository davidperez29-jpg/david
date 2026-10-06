import Link from 'next/link';
import {
  clientMonitoring,
  getMonitoringRules,
  clientSessionReview,
  clientAssessmentProgress,
  getClient,
  defaultReportPeriod,
  clientComparison,
  listClientReports,
  getDecision,
  getSession,
  programView,
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
  listProgrammingProfiles,
  listTrainers,
  injuryCaseCount,
  estimatedStrength,
} from '@tp/application';
import { DomainError, REPORT_KINDS } from '@tp/domain';
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
import { CopyWeekButton, NewPlanForm } from '../../plans/forms';
import { SessionTable } from '../../plans/session-table';
import { PublishButton } from '@/components/sessions/publish-button';
import { ExportForm, GenerateReportForm } from '@/components/reports/actions';
import { AdjustmentsCard } from '@/components/programming/adjustments-card';
import { GenerateProposalForm } from '@/components/programming/actions';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatDateTime, label } from '@/lib/labels';
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
  ProgrammingPanel,
  TolerancesPanel,
} from './panels';
import { DecisionTab } from './decision-tab';
import { InjuryTab } from './injury-tab';
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

/**
 * Client page (docs/UX_FLOW.md §2.2): five tabs. Readaptación joins them (restructure phase 7)
 * when the client has an injury case; Ficha → Salud links to it to open the first one. The decision engine («necesidades») and the change history («historial»)
 * open from links, not tabs. Old tab names still work.
 */
const TABS = [
  ['programa', 'Programa'],
  ['evaluacion', 'Evaluación'],
  ['seguimiento', 'Seguimiento'],
  ['informes', 'Informes'],
  ['ficha', 'Ficha'],
] as const;
const ALIASES: Record<string, string> = {
  resumen: 'programa',
  planificacion: 'programa',
  sesiones: 'seguimiento',
  evaluaciones: 'evaluacion',
  perfil: 'ficha',
  objetivos: 'ficha',
  salud: 'ficha',
  privacidad: 'ficha',
  equipo: 'ficha',
};
const LINKED = ['necesidades', 'historial', 'readaptacion'];

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    tab?: string;
    nuevo?: string;
    plan?: string;
    semana?: string;
    sesion?: string;
  }>;
}) {
  const ctx = await requireStaff();
  const { clientId } = await params;
  const sp = await searchParams;
  const requested = ALIASES[sp.tab ?? ''] ?? sp.tab ?? 'programa';
  const tab =
    TABS.some(([k]) => k === requested) || LINKED.includes(requested) ? requested : 'programa';
  const client = await getClient(ctx, clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const isAdmin = ctx.actor.roles.includes('ADMIN');
  // Readaptación appears only when the client has an injury case (or it was asked for).
  const injuryCases = await injuryCaseCount(ctx, client.id);
  const tabs: (readonly [string, string])[] =
    injuryCases.total || tab === 'readaptacion'
      ? [...TABS.slice(0, 3), ['readaptacion', 'Readaptación'], ...TABS.slice(3)]
      : [...TABS];
  const primaryGoal = client.goals.find((g) => g.isPrimary) ?? null;
  const facts = [
    client.programmingProfile
      ? `${client.programmingProfile.name} · Nivel ${client.programmingLevel ?? 1}`
      : null,
    client.profile?.sessionsPerWeek ? `${client.profile.sessionsPerWeek} días/semana` : null,
    primaryGoal ? `Objetivo: ${primaryGoal.name}` : null,
    client.sport?.name ?? null,
    client.age !== null ? `${client.age} años` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/app" className="text-sm text-muted hover:underline">
          ← Mis clientes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {client.firstName} {client.lastName}
          </h1>
          <Badge tone={client.status === 'active' ? 'ok' : 'neutral'}>
            {label('status', client.status)}
          </Badge>
          <Badge>{label('modality', client.modality)}</Badge>
        </div>
        <p className="text-sm text-muted">
          {facts.join(' · ')}
          {client.programmingProfile ? null : (
            <>
              {facts.length ? ' · ' : ''}
              <Link href="?tab=ficha#perfil" className="text-accent underline">
                Elegir perfil principal
              </Link>
            </>
          )}
        </p>
      </div>
      <ReferralBanner text={client.referral.text} />
      {sp.nuevo ? (
        <p className="rounded-md border border-accent p-3 text-sm">
          Cliente creado. Antes de entrenar, registra el consentimiento para datos de salud y el
          cribado previo a la participación en{' '}
          <a href="#salud" className="text-accent underline">
            Salud
          </a>
          . Después crea su programa en{' '}
          <Link href="?tab=programa" className="text-accent underline">
            Programa
          </Link>
          .
        </p>
      ) : null}
      <nav
        className="flex flex-wrap gap-1 border-b border-border"
        aria-label="Secciones del cliente"
      >
        {tabs.map(([key, name]) => (
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

      {tab === 'programa' ? await programTab(ctx, client.id, sp) : null}

      {tab === 'evaluacion' ? await assessmentsTab(ctx, client.id, client.progressTestIds) : null}

      {tab === 'necesidades' ? (
        <DecisionTab ctx={ctx} clientId={client.id} isAdmin={isAdmin} />
      ) : null}

      {tab === 'seguimiento' ? (
        <div className="flex flex-col gap-4">
          {/* Alerts and load first (what needs attention), then the log of every session. */}
          {await monitoringTab(ctx, client.id)}
          <div id="sesiones" className="scroll-mt-4">
            {await sessionsTab(ctx, client.id)}
          </div>
        </div>
      ) : null}

      {tab === 'readaptacion' ? <InjuryTab ctx={ctx} clientId={client.id} /> : null}

      {tab === 'informes' ? await reportsTab(ctx, client.id) : null}

      {tab === 'ficha' ? await fichaTab(ctx, client, isAdmin) : null}

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

type Ctx = Awaited<ReturnType<typeof requireStaff>>;
type Client = Awaited<ReturnType<typeof getClient>>;

const FICHA_SECTIONS = [
  ['perfil', 'Perfil y nivel'],
  ['datos', 'Datos personales'],
  ['objetivos', 'Objetivos'],
  ['entrenamiento', 'Entrenamiento y material'],
  ['salud', 'Salud'],
  ['privacidad', 'Consentimientos'],
  ['equipo', 'Entrenadores'],
  ['acceso', 'Acceso a la app'],
] as const;

/** Everything about the client that is not training: one page with an index (no sub-tabs). */
async function fichaTab(ctx: Ctx, client: Client, isAdmin: boolean) {
  const [catalog, profiles, health, consents, tolerances, taxonomies, requests, trainers] =
    await Promise.all([
      listCatalog(ctx),
      listProgrammingProfiles(ctx),
      listHealthDeclarations(ctx, client.id),
      listConsents(ctx, client.id),
      listExerciseTolerances(ctx, client.id),
      listLibraryTaxonomies(ctx),
      isAdmin ? listClientPrivacyRequests(ctx, client.id) : Promise.resolve([]),
      isAdmin ? listTrainers(ctx) : Promise.resolve([]),
    ]);
  const healthConsent = consents.status.find((s) => s.purpose === 'health_data')?.active ?? false;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Apartados de la ficha" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {FICHA_SECTIONS.map(([id, name]) => (
          <a key={id} href={`#${id}`} className="text-accent underline">
            {name}
          </a>
        ))}
        <Link href="?tab=historial" className="text-accent underline">
          Historial de cambios
        </Link>
      </nav>
      <div id="perfil" className="scroll-mt-4">
        <ProgrammingPanel client={client} profiles={profiles} catalog={catalog} />
      </div>
      <div id="datos" className="scroll-mt-4">
        <BasicsPanel client={client} />
      </div>
      <div id="objetivos" className="scroll-mt-4">
        <GoalsPanel client={client} catalog={catalog} />
      </div>
      <div id="entrenamiento" className="flex scroll-mt-4 flex-col gap-4">
        <ProfilePanel client={client} catalog={catalog} />
      </div>
      <div id="salud" className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Salud</h2>
          <Link href="?tab=readaptacion" className="text-sm text-accent underline">
            Lesiones y readaptación →
          </Link>
        </div>
        <HealthPanel clientId={client.id} data={health} consents={consents} />
        <TolerancesPanel
          clientId={client.id}
          rows={tolerances}
          patterns={taxonomies.patterns}
          hasConsent={healthConsent}
        />
      </div>
      <div id="privacidad" className="flex scroll-mt-4 flex-col gap-4">
        <ConsentsPanel clientId={client.id} data={consents} />
        {isAdmin ? (
          <>
            <ClientRequestsCard requests={requests} />
            <SubjectRightsPanel
              clientId={client.id}
              fullName={`${client.firstName} ${client.lastName}`}
              anonymized={client.anonymizedAt != null}
            />
          </>
        ) : null}
      </div>
      <div id="equipo" className="flex scroll-mt-4 flex-col gap-4">
        <AssignmentsPanel
          clientId={client.id}
          assignments={client.assignments}
          trainers={trainers}
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
      <div id="acceso" className="flex scroll-mt-4 flex-col gap-4">
        <AccountPanel clientId={client.id} hasAccount={client.hasAccount} email={client.email} />
        <ArchivePanel clientId={client.id} archived={client.status === 'archived'} />
      </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Progreso</h2>
          {progress.series.length ? (
            <Link
              href={`/app/clients/${clientId}/assessments/comparativa`}
              className="inline-flex h-10 items-center rounded-md border border-border bg-bg px-4 text-sm font-medium hover:bg-surface"
            >
              Comparativa y radar
            </Link>
          ) : null}
        </div>
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

type ProgramParams = { plan?: string; semana?: string; sesion?: string };

const WEEKDAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthName = (key: string) => {
  if (!key) return 'Sin fechas';
  const t = MONTH.format(new Date(`${key}-15T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const chip = (on: boolean) =>
  `inline-flex min-h-9 items-center gap-1 rounded-md border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-bg hover:bg-surface'}`;

/**
 * Programa (docs/UX_FLOW.md §2.2): the plan as MES → SEMANA → SESIÓN and, below, the table of the
 * chosen session. Opens on the active plan, the current week and the next session to do.
 */
async function programTab(ctx: Ctx, clientId: string, sp: ProgramParams) {
  const view = await programView(ctx, clientId, {
    plan: sp.plan,
    week: sp.semana,
    session: sp.sesion,
  });
  const [session, extras] = await Promise.all([
    view.selectedSessionId ? getSession(ctx, view.selectedSessionId) : Promise.resolve(null),
    plansTab(
      ctx,
      clientId,
      view.plans.some((p) => p.status === 'active'),
    ),
  ]);
  if (!view.plan)
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
          Este cliente aún no tiene plan. Crea uno desde una plantilla o en blanco; el análisis de{' '}
          <Link href="?tab=necesidades" className="text-accent underline">
            necesidades
          </Link>{' '}
          puede proponer uno.
        </p>
        {extras}
      </div>
    );
  const href = (q: Record<string, string | null | undefined>) =>
    `?${new URLSearchParams(
      Object.entries({ tab: 'programa', plan: sp.plan, ...q }).filter(
        (e): e is [string, string] => !!e[1],
      ),
    )}`;
  const week = view.weeks.find((w) => w.id === view.selectedWeekId) ?? null;
  const monthWeeks = view.weeks.filter((w) => w.month === (week?.month ?? ''));
  const editable = view.plan.status !== 'archived' && view.plan.status !== 'completed';
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{view.plan.name}</h2>
            <Badge tone={view.plan.status === 'active' ? 'ok' : 'neutral'}>
              {label('planStatus', view.plan.status)}
            </Badge>
            <span className="text-sm text-muted">
              {view.plan.weeks} semanas · {view.plan.sessionsPerWeek} días/semana
              {view.plan.currentWeekIndex
                ? ` · ahora en la semana ${view.plan.currentWeekIndex}`
                : ''}
            </span>
            <span className="ml-auto flex flex-wrap gap-3 text-sm">
              <Link href="?tab=necesidades" className="text-accent underline">
                Necesidades
              </Link>
              <Link href={`/app/plans/${view.plan.id}`} className="text-accent underline">
                Plan completo
              </Link>
              <a
                href={`/api/v1/plans/${view.plan.id}/pdf?version=client`}
                className="text-accent underline"
              >
                PDF
              </a>
            </span>
          </div>
          <nav aria-label="Meses del plan" className="flex flex-wrap gap-2">
            {view.months.map((m) => (
              <Link
                key={m.key}
                href={href({ semana: m.firstWeekId })}
                aria-current={m.key === week?.month ? 'true' : undefined}
                className={chip(m.key === week?.month)}
              >
                {monthName(m.key)}
              </Link>
            ))}
          </nav>
          <nav aria-label="Semanas del mes" className="flex flex-wrap gap-2">
            {monthWeeks.map((w) => (
              <Link
                key={w.id}
                href={href({ semana: w.id })}
                aria-current={w.id === week?.id ? 'true' : undefined}
                className={chip(w.id === week?.id)}
              >
                Sem {w.weekIndex}
                {w.isCurrent ? (
                  <span title="Semana actual">
                    <span aria-hidden="true">●</span>
                    <span className="sr-only">(semana actual)</span>
                  </span>
                ) : null}
                {w.total > 0 && w.done === w.total ? (
                  <span title="Todas las sesiones registradas">
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">(hecha)</span>
                  </span>
                ) : null}
                {w.weekType === 'deload' ? <span className="text-xs">descarga</span> : null}
              </Link>
            ))}
          </nav>
          {week ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">
                Semana {week.weekIndex} · {week.phase} · {label('weekType', week.weekType)}
                {week.start ? ` · desde ${formatDate(week.start)}` : ''}
              </span>
              {editable ? (
                <span className="ml-auto">
                  <CopyWeekButton
                    microcycleId={week.id}
                    weeks={view.weeks.map((w) => ({ id: w.id, weekIndex: w.weekIndex }))}
                  />
                </span>
              ) : null}
            </div>
          ) : null}
          <nav aria-label="Sesiones de la semana" className="flex flex-wrap gap-2">
            {view.sessions.length === 0 ? (
              <span className="text-sm text-muted">Semana sin sesiones.</span>
            ) : null}
            {view.sessions.map((x) => (
              <Link
                key={x.id}
                href={href({ semana: week?.id, sesion: x.id })}
                aria-current={x.id === view.selectedSessionId ? 'true' : undefined}
                className={chip(x.id === view.selectedSessionId)}
              >
                {x.scheduledDate
                  ? `${WEEKDAY.format(new Date(`${x.scheduledDate}T00:00:00Z`))} · `
                  : ''}
                {x.dayLabel} · {x.title ?? 'Sesión'}
                {x.status ? (
                  <span className="text-xs">({label('attendance', x.status)})</span>
                ) : x.published ? null : (
                  <span className="text-xs">(sin publicar)</span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </Card>
      {session ? (
        <section aria-labelledby="sesion-actual" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="sesion-actual" className="text-lg font-semibold">
              {session.dayLabel} · {session.title}
            </h2>
            {session.scheduledDate ? (
              <span className="text-sm text-muted">{formatDate(session.scheduledDate)}</span>
            ) : null}
            {session.published ? <Badge tone="ok">Publicada</Badge> : <Badge>No publicada</Badge>}
            <PublishButton
              scope="session"
              id={session.id}
              published={session.published}
              disabled={!session.published && session.plan.status !== 'active'}
            />
            <span className="ml-auto flex flex-wrap gap-3 text-sm">
              <Link
                href={`/app/plans/${session.plan.id}/sessions/${session.id}`}
                className="text-accent underline"
              >
                Abrir sesión
              </Link>
              <Link
                href={`/app/clients/${clientId}/sessions/${session.id}`}
                className="text-accent underline"
              >
                Registro y modo sala
              </Link>
            </span>
          </div>
          <SessionTable s={session} editable={editable} />
        </section>
      ) : null}
      {extras}
    </div>
  );
}

/** Adjustments of the active plan, the engine's proposal, the client's plans and a new plan. */
async function plansTab(ctx: Ctx, clientId: string, hasActive: boolean) {
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
  const newPlan = (
    <Card title="Nuevo plan">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/app/plans?client=${clientId}`}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
          >
            Usar plantilla
          </Link>
          <span className="text-xs text-muted">
            Primero las que encajan con su perfil, nivel y días por semana.
          </span>
        </div>
        <details>
          <summary className="cursor-pointer text-sm">O crear un plan en blanco</summary>
          <div className="mt-3">
            <NewPlanForm clientId={clientId} />
          </div>
        </details>
      </div>
    </Card>
  );
  const rest = (
    <>
      <Card
        title="Propuesta de plan del motor"
        actions={
          decision.run ? (
            <Link href="?tab=necesidades" className="text-sm text-accent underline">
              Ver necesidades
            </Link>
          ) : null
        }
      >
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
                <Link href={`?tab=programa&plan=${p.id}`} className="font-medium hover:underline">
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
                <Link href={`/app/plans/${p.id}`} className="ml-auto text-xs text-accent underline">
                  Gestionar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
  if (!hasActive)
    return (
      <div className="flex flex-col gap-4">
        {newPlan}
        {rest}
      </div>
    );
  const adjustmentsCard = (
    <AdjustmentsCard
      clientId={clientId}
      items={adjustments.items}
      autoApply={adjustments.autoApplyLoadProgressions}
    />
  );
  // Pending or recent adjustments are shown; with none, the card (and its setting) waits below.
  return (
    <div className="flex flex-col gap-4">
      {adjustments.items.length ? adjustmentsCard : null}
      <details open={open.length > 0} className="rounded-lg border border-border bg-bg p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Otros planes, propuesta del motor y nuevo plan
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {adjustments.items.length ? null : adjustmentsCard}
          {rest}
          {newPlan}
        </div>
      </details>
    </div>
  );
}

async function reportsTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const [list, comparison] = await Promise.all([
    listClientReports(ctx, clientId),
    clientComparison(ctx, clientId, {}),
  ]);
  const period = defaultReportPeriod(ctx.now());
  const kinds = Object.entries(REPORT_KINDS)
    .filter(([k]) => k !== 'performance')
    .map(([value, k]) => ({ value, label: k.label, description: k.description }));
  return (
    <div className="flex flex-col gap-4">
      <Card title="Nuevo informe">
        <GenerateReportForm
          clientId={clientId}
          defaultFrom={period.from}
          defaultTo={period.to}
          kinds={kinds}
          assessments={comparison.assessments
            .filter((x) => x.hasResults)
            .map((x) => ({
              id: x.id,
              label: `${formatDate(x.assessedOn)}${x.context ? ` · ${x.context}` : ''}`,
            }))}
        />
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
                  {r.kindLabel}
                  {r.parameters.from
                    ? ` · ${formatDate(r.parameters.from)} – ${formatDate(r.parameters.to)}`
                    : ''}
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

const kg = (v: number) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;

async function monitoringTab(ctx: Awaited<ReturnType<typeof requireStaff>>, clientId: string) {
  const [m, rules, adj, ext, strength] = await Promise.all([
    clientMonitoring(ctx, clientId),
    getMonitoringRules(ctx),
    listAdjustments(ctx, clientId),
    listExternalMeasurements(ctx, clientId, {}),
    // Roles without decision:read simply do not see the card.
    estimatedStrength(ctx, clientId).catch(() => null),
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
          <Link href="?tab=programa#ajustes" className="text-accent underline">
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

      {strength ? (
        <Card title="Fuerza estimada (1RM orientativo)">
          {strength.items.length === 0 ? (
            <EmptyState>
              Sin series con RIR informado y 10 repeticiones o menos hasta el fallo en los últimos 4
              meses.
            </EmptyState>
          ) : (
            <table className="w-full text-sm" aria-label="Fuerza estimada por ejercicio">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1">Ejercicio</th>
                  <th className="py-1">1RM estimado</th>
                  <th className="py-1">Cambio (≥ 3 semanas)</th>
                </tr>
              </thead>
              <tbody>
                {strength.items.map((e) => (
                  <tr key={e.exerciseId} className="border-t border-border">
                    <td className="py-1">{e.name}</td>
                    <td className="py-1 tabular-nums">
                      {kg(e.latest.kg)}{' '}
                      <span className="text-xs text-muted">({formatDate(e.latest.date)})</span>
                    </td>
                    <td className="py-1 tabular-nums">
                      {e.changeKg == null ? '—' : `${e.changeKg > 0 ? '+' : ''}${kg(e.changeKg)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted">
            Orientativo: ecuación práctica con series de 10 repeticiones o menos hasta el fallo y
            RIR informado. No sustituye un 1RM medido; las cargas en %1RM siguen usando la
            valoración.
          </p>
        </Card>
      ) : null}

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
