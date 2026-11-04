import { ArrowLeft, CircleCheck, CircleMinus, Eye, Info } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ClientOverviewVM } from '@/contracts/trainer';
import { findAssessmentTest } from '@/domain/assessment';
import { formatDate, formatRelativeDay } from '@/domain/format';
import { CLIENT_STATUS_LABELS } from '@/domain/people';
import { isoWeekKey } from '@/domain/time';
import { PatternPictogram } from '@/features/brand/pictogram';
import { AssessmentSeriesList } from '@/features/shared/assessments';
import { PrescriptionChips } from '@/features/shared/prescription';
import { HealthDataNotice, RehabTimeline } from '@/features/shared/rehab';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { VolumePanel } from '@/features/shared/volume';
import { Avatar } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { Notice } from '@/ui/notice';
import { getTrainerContext } from '@/server/context';
import { getClientOverview } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Ficha de cliente' };

const SECTIONS = [
  ['plan', 'Plan'],
  ['carga', 'Carga'],
  ['evaluaciones', 'Evaluaciones'],
  ['readaptacion', 'Readaptación'],
  ['compartido', 'Compartido'],
] as const;

export default async function ClientOverviewPage(
  props: PageProps<'/entrenador/clientes/[clientId]'>,
) {
  const { clientId } = await props.params;
  const ctx = await getTrainerContext();
  const overview = await getClientOverview(ctx, clientId);
  if (!overview) notFound();
  const { client } = overview;

  return (
    <>
      <Link
        href="/entrenador/clientes"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Clientes
      </Link>

      <header className="flex flex-col gap-5 rounded-[2rem] bg-sun-400 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
        <Avatar initials={client.initials} seed={client.id} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold text-ink-900">{client.name}</h1>
            <Badge tone={client.status === 'active' ? 'leaf' : 'neutral'}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
          </div>
          <p className="mt-1 text-ink-700">{client.goal}</p>
          <p className="mt-2 text-sm text-ink-700">
            {client.populationLabel}
            {client.sport ? ` · ${client.sport}` : ''} · Cliente desde el{' '}
            {formatDate(client.startedOn, 'dayMonth')}
          </p>
        </div>
      </header>

      <nav
        aria-label="Secciones de la ficha"
        className="sticky top-0 z-10 -mx-4 mt-4 overflow-x-auto bg-cream-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-ink-700 hover:border-ink-300 hover:text-ink-900"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 space-y-8">
        <PlanSection overview={overview} today={ctx.today} />

        <section id="carga" aria-labelledby="carga-titulo" className="scroll-mt-20">
          <Card>
            <CardHeader
              as="h2"
              title={<span id="carga-titulo">Carga y volumen</span>}
              description="Últimas cuatro semanas, calculado a partir de las series registradas."
            />
            <VolumePanel weeks={overview.weeklyVolume} currentWeek={isoWeekKey(ctx.today)} />
          </Card>
        </section>

        <section id="evaluaciones" aria-labelledby="evaluaciones-titulo" className="scroll-mt-20">
          <h2 id="evaluaciones-titulo" className="mb-4 text-2xl font-bold text-ink-900">
            Evaluaciones
          </h2>
          {overview.assessments.length > 0 ? (
            <AssessmentSeriesList series={overview.assessments} />
          ) : (
            <p className="rounded-3xl bg-cream-50 p-6 text-sm text-ink-500 ring-1 ring-line">
              Todavía no hay evaluaciones registradas.
            </p>
          )}
        </section>

        <section id="readaptacion" aria-labelledby="readaptacion-titulo" className="scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="readaptacion-titulo" className="text-2xl font-bold text-ink-900">
              Readaptación
            </h2>
            {overview.rehab ? <HealthDataNotice /> : null}
          </div>
          {overview.rehab ? (
            <>
              <p className="mb-4 font-semibold text-ink-700">
                {overview.rehab.title} · desde el {formatDate(overview.rehab.startedOn, 'dayMonth')}
              </p>
              <RehabTimeline rehab={overview.rehab} />
            </>
          ) : (
            <p className="rounded-3xl bg-cream-50 p-6 text-sm text-ink-500 ring-1 ring-line">
              Sin procesos de readaptación activos.
            </p>
          )}
        </section>

        <SharingSection sharing={overview.sharing} />
      </div>
    </>
  );
}

function PlanSection({ overview, today }: { overview: ClientOverviewVM; today: string }) {
  const next = overview.nextSessionDetail;
  return (
    <section
      id="plan"
      aria-labelledby="plan-titulo"
      className="scroll-mt-20 grid gap-6 xl:grid-cols-[1.5fr_1fr] xl:items-start"
    >
      <Card>
        <CardHeader
          as="h2"
          title={<span id="plan-titulo">Próxima sesión</span>}
          description={
            next
              ? `${formatRelativeDay(next.date, today)} · ${next.title} · ${next.estimatedMinutes} min`
              : 'No hay sesiones pendientes en los próximos días.'
          }
          action={next ? <SessionStatusBadge status={next.status} /> : undefined}
        />
        {next ? (
          <ol className="space-y-3">
            {next.exercises.map((exercise) => (
              <li
                key={exercise.prescriptionId}
                className="flex gap-3 rounded-2xl bg-cream-50 p-3 ring-1 ring-line"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-line">
                  <PatternPictogram pattern={exercise.pattern} className="size-11" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink-900">
                    <span className="mr-1.5 text-sun-700">{exercise.slot}</span>
                    {exercise.name}
                  </p>
                  <PrescriptionChips exercise={exercise} className="mt-2" />
                  {exercise.notes ? (
                    <p className="mt-2 text-sm text-ink-500">{exercise.notes}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
      <Card>
        <CardHeader
          as="h3"
          title="Sesiones recientes"
          description="Estado según los registros del cliente."
        />
        <ul className="divide-y divide-line">
          {overview.recent.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{session.title}</p>
                <p className="text-ink-500">
                  {formatDate(session.date, 'long')} · {session.completedSets}/{session.plannedSets}{' '}
                  series
                </p>
              </div>
              <SessionStatusBadge status={session.status} />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function SharingSection({ sharing }: { sharing: ClientOverviewVM['sharing'] }) {
  const rows: [string, boolean, string?][] = [
    ['Plan y sesiones', true, 'Siempre visible: el cliente lo necesita para entrenar.'],
    [
      'Evaluaciones',
      sharing.assessments.enabled,
      sharing.assessments.enabled
        ? `Solo: ${sharing.assessments.testIds.map((id) => findAssessmentTest(id)?.name ?? id).join(', ')}`
        : undefined,
    ],
    ['Carga y volumen', sharing.volume],
    ['Readaptación', sharing.rehab],
    ['Informes', sharing.reports],
    ['Notas privadas del entrenador', false, 'Nunca se comparten.'],
  ];
  return (
    <section id="compartido" aria-labelledby="compartido-titulo" className="scroll-mt-20">
      <Card>
        <CardHeader
          as="h2"
          icon={<Eye className="size-5" />}
          title={<span id="compartido-titulo">Lo que ve el cliente</span>}
          description="El cliente solo ve en su app lo que decidas compartir. Por defecto no se comparte nada."
        />
        <ul className="divide-y divide-line">
          {rows.map(([label, shared, detail]) => (
            <li key={label} className="flex items-start gap-3 py-2.5 text-sm">
              {shared ? (
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf-700" />
              ) : (
                <CircleMinus aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{label}</p>
                {detail ? <p className="text-ink-500">{detail}</p> : null}
              </div>
              <span
                className={
                  shared ? 'shrink-0 font-semibold text-leaf-700' : 'shrink-0 text-ink-500'
                }
              >
                {shared ? 'Compartido' : 'No compartido'}
              </span>
            </li>
          ))}
        </ul>
        <Notice className="mt-4" icon={<Info />}>
          En esta fase la configuración solo se puede consultar. Se podrá cambiar cuando exista la
          base de datos, y está previsto que cada cambio quede registrado.
        </Notice>
      </Card>
    </section>
  );
}
