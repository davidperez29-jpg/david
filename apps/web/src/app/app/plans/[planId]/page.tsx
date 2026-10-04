import Link from 'next/link';
import { getClient, getPlan, listPlanRevisions } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui/card';
import { formatDate, formatDateTime, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { PublishButton } from '@/components/sessions/publish-button';
import { CopyWeekButton, PlanActions, WeekTypeSelect } from '../forms';
import { ProposalActions } from '@/components/programming/actions';

type SP = { view?: string };

function MonthCalendar({
  sessions,
}: {
  sessions: { id: string; date: string; title: string; planId: string }[];
}) {
  const months = [...new Set(sessions.map((s) => s.date.slice(0, 7)))].sort();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {months.map((m) => {
        const first = new Date(`${m}-01T00:00:00Z`);
        const offset = (first.getUTCDay() + 6) % 7;
        const days = new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
        ).getUTCDate();
        const cells = [
          ...Array<null>(offset).fill(null),
          ...Array.from({ length: days }, (_, i) => i + 1),
        ];
        return (
          <Card
            key={m}
            title={new Intl.DateTimeFormat('es-ES', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(first)}
          >
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <div key={d} className="text-center font-medium text-muted">
                  {d}
                </div>
              ))}
              {cells.map((d, i) => {
                const iso = d ? `${m}-${String(d).padStart(2, '0')}` : '';
                const here = sessions.filter((s) => s.date === iso);
                return (
                  <div
                    key={i}
                    className={`min-h-14 rounded border p-1 ${d ? 'border-border' : 'border-transparent'}`}
                  >
                    {d ? <span className="text-muted">{d}</span> : null}
                    {here.map((s) => (
                      <Link
                        key={s.id}
                        href={`/app/plans/${s.planId}/sessions/${s.id}`}
                        className="mt-0.5 block truncate rounded bg-accent/10 px-1 text-accent hover:underline"
                      >
                        {s.title}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<SP>;
}) {
  const ctx = await requireStaff();
  const { planId } = await params;
  const { view = 'semanas' } = await searchParams;
  const p = await getPlan(ctx, planId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const [client, revisions] = await Promise.all([
    getClient(ctx, p.clientId!),
    listPlanRevisions(ctx, planId),
  ]);
  const allWeeks = p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
  const calendar = allWeeks.flatMap((w) =>
    w.sessions
      .filter((s) => s.scheduledDate)
      .map((s) => ({ id: s.id, date: s.scheduledDate!, title: s.title ?? s.dayLabel, planId })),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/clients/${client.id}?tab=planificacion`}
          className="text-sm text-muted hover:underline"
        >
          ← {client.firstName} {client.lastName}
        </Link>
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <Badge tone={p.status === 'active' ? 'ok' : 'neutral'}>
          {label('planStatus', p.status)}
        </Badge>
        <span className="text-sm text-muted">
          {p.durationMonths} meses · {allWeeks.length} semanas · {p.sessionsPerWeek} sesiones/semana
          {p.startDate
            ? ` · ${formatDate(p.startDate)} – ${formatDate(p.endDate)}`
            : ' · sin fecha de inicio'}
          {` · revisión ${p.currentRevision}`}
        </span>
      </div>
      {p.kind === 'PROPOSAL' ? (
        <Card
          title={
            p.status === 'proposed' ? 'Propuesta del motor de programación' : 'Propuesta descartada'
          }
          className="border-accent"
        >
          <p className="text-sm">
            Generada a partir de la última propuesta del motor de decisiones. Revísala y edítala
            como cualquier plan: no se publica ni se activa hasta que la aceptes, y no cambia el
            plan activo del cliente.
          </p>
          {p.generationNotes.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">
              {p.generationNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {p.status === 'proposed' ? (
            <div className="mt-3">
              <ProposalActions planId={planId} clientId={client.id} name={p.name} />
            </div>
          ) : null}
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          {allWeeks.flatMap((w) => w.sessions).filter((s) => s.published).length} de{' '}
          {allWeeks.flatMap((w) => w.sessions).length} sesiones publicadas al cliente
        </span>
        <PublishButton
          scope="plan"
          id={planId}
          published={false}
          disabled={p.status !== 'active'}
          label="Publicar todo el plan"
        />
      </div>
      <p className="text-xs text-muted">
        El sistema no modifica un plan activo por su cuenta: los cambios automáticos llegarán como
        propuestas que aceptas o rechazas. Tus cambios quedan auditados.
      </p>

      <nav className="flex gap-1 border-b border-border" aria-label="Vista del plan">
        {[
          ['semanas', 'Semanas'],
          ['calendario', 'Calendario'],
          ['gestion', 'Gestión y revisiones'],
        ].map(([k, n]) => (
          <Link
            key={k}
            href={`?view=${k}`}
            aria-current={view === k ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === k ? 'border-accent font-medium' : 'border-transparent text-muted'}`}
          >
            {n}
          </Link>
        ))}
      </nav>

      {view === 'semanas'
        ? p.phases.map((ph) => (
            <section key={ph.id} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {ph.name}{' '}
                <span className="text-sm font-normal text-muted">
                  · semanas {ph.startWeek}–{ph.endWeek}
                  {ph.objective ? ` · ${ph.objective}` : ''}
                </span>
              </h2>
              {ph.mesocycles.map((m) => (
                <Card
                  key={m.id}
                  title={`${m.name}${m.focus ? ` · ${m.focus}` : ''}`}
                  actions={
                    m.assessmentPlanned ? (
                      <Badge tone="accent">Reevaluación prevista</Badge>
                    ) : undefined
                  }
                >
                  <ul className="flex flex-col gap-3">
                    {m.weeks.map((w) => (
                      <li
                        key={w.id}
                        className="flex flex-col gap-2 border-b border-border pb-3 last:border-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">Semana {w.weekIndex}</span>
                          <WeekTypeSelect microcycleId={w.id} value={w.weekType} />
                          {w.startDate ? (
                            <span className="text-xs text-muted">
                              desde {formatDate(w.startDate)}
                            </span>
                          ) : null}
                          <CopyWeekButton
                            microcycleId={w.id}
                            weeks={allWeeks.map((x) => ({ id: x.id, weekIndex: x.weekIndex }))}
                          />
                          {w.sessions.length ? (
                            <PublishButton
                              scope="week"
                              id={w.id}
                              published={w.sessions.every((s) => s.published)}
                              disabled={p.status !== 'active'}
                              label={
                                w.sessions.every((s) => s.published)
                                  ? `Retirar semana ${w.weekIndex}`
                                  : `Publicar semana ${w.weekIndex}`
                              }
                            />
                          ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {w.sessions.map((s) => (
                            <Link
                              key={s.id}
                              href={`/app/plans/${planId}/sessions/${s.id}`}
                              className="rounded-md border border-border p-2 text-sm hover:border-accent"
                            >
                              <span className="font-medium">
                                {s.dayLabel} · {s.title}
                              </span>
                              {s.published ? (
                                <span className="ml-1 text-xs text-ok">· publicada</span>
                              ) : null}
                              <span className="block text-xs text-muted">
                                {s.scheduledDate ? formatDate(s.scheduledDate) : 'Sin fecha'} ·{' '}
                                {s.exercises} ejercicios
                                {s.estimatedMinutes
                                  ? ` · ≈${s.estimatedMinutes} min (estimado)`
                                  : ''}
                              </span>
                            </Link>
                          ))}
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted">
                            Indicadores de la semana (descriptivos)
                          </summary>
                          <div className="mt-1 flex flex-col gap-1">
                            <p>
                              Series por grupo muscular (principal 1 · secundario 0,5):{' '}
                              {Object.entries(w.indicators.setsByMuscleGroup)
                                .sort((a, b) => b[1] - a[1])
                                .map(([g, v]) => `${label('muscleGroup', g)} ${v}`)
                                .join(' · ') || '—'}
                            </p>
                            <p>
                              Tracción:empuje {w.indicators.pullPushRatio ?? '—'} · contactos
                              pliométricos {w.indicators.plyoContacts} · metros de sprint{' '}
                              {w.indicators.sprintMetres}
                            </p>
                            {w.indicators.warnings.map((x) => (
                              <p key={x.message} className="text-warn">
                                {x.message} <span className="text-muted">({x.level})</span>
                              </p>
                            ))}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </section>
          ))
        : null}

      {view === 'calendario' ? (
        calendar.length ? (
          <MonthCalendar sessions={calendar} />
        ) : (
          <p className="text-sm text-muted">El plan no tiene fechas: indica una fecha de inicio.</p>
        )
      ) : null}

      {view === 'gestion' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Acciones">
            {p.kind === 'PROPOSAL' ? (
              <p className="text-sm text-muted">
                Es una propuesta: acéptala o descártala desde el aviso de arriba.
              </p>
            ) : (
              <PlanActions planId={planId} status={p.status} />
            )}
          </Card>
          <Card title="Revisiones">
            {revisions.length === 0 ? (
              <p className="text-sm text-muted">Se crea la revisión 1 al activar el plan.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {revisions.map((r) => {
                  const d = (r.diff ?? {}) as {
                    added?: number;
                    removed?: number;
                    changed?: number;
                  };
                  return (
                    <li key={r.id}>
                      <span className="font-medium">Revisión {r.revision}</span> ·{' '}
                      {formatDateTime(r.createdAt)} · {r.reason}
                      <span className="block text-xs text-muted">
                        {d.added ?? 0} ejercicios añadidos · {d.removed ?? 0} quitados ·{' '}
                        {d.changed ?? 0} modificados
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
