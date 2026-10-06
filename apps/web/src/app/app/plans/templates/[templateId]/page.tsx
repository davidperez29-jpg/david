import Link from 'next/link';
import { getClient, getPlanTemplate, listClients, listProgrammingProfiles } from '@tp/application';
import { evidenceCards } from '@tp/application';
import { SourceButton } from '@/components/science/source-button';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import {
  ArchiveTemplateButton,
  DuplicateTemplateButton,
  RestoreVersionButton,
  TemplateDetailsForm,
  UseTemplateForm,
} from '@/components/templates/template-actions';
import { TemplateEditor } from '@/components/templates/template-editor';
import { Badge, Card } from '@/components/ui/card';
import { formatDateTime, KIND_LABELS, label, POPULATION_LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requireStaff();
  const { templateId } = await params;
  const sp = await searchParams;
  const t = await getPlanTemplate(ctx, templateId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const [profiles, page, client] = await Promise.all([
    listProgrammingProfiles(ctx),
    listClients(ctx, { limit: 100 }),
    sp.client ? getClient(ctx, sp.client).catch(() => null) : Promise.resolve(null),
  ]);
  const profile = profiles.find((p) => p.slug === t.profileSlug);
  const back = client ? `/app/plans?client=${client.id}` : '/app/plans';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={back} className="text-sm text-muted hover:underline">
          ← Plantillas
        </Link>
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        {t.isGlobal ? <Badge tone="accent">Plataforma</Badge> : <Badge>Propia</Badge>}
        {profile ? <Badge>{profile.name}</Badge> : null}
        {t.levelN ? <Badge>Nivel {t.levelN}</Badge> : null}
        <Badge>{t.sessionsPerWeek} días/semana</Badge>
        {t.kind !== 'training' ? <Badge tone="accent">{KIND_LABELS[t.kind]}</Badge> : null}
        {t.archived ? <Badge tone="warn">Archivada</Badge> : null}
        <span className="text-xs text-muted">versión {t.templateVersion}</span>
      </div>
      {t.description ? <p className="text-sm text-muted">{t.description}</p> : null}
      <div className="flex flex-wrap items-start gap-2">
        <DuplicateTemplateButton id={t.id} global={t.isGlobal} />
        {t.isGlobal ? null : <ArchiveTemplateButton id={t.id} archived={t.archived} />}
      </div>

      {t.archived ? null : (
        <Card
          title={client ? `Usar con ${client.firstName} ${client.lastName}` : 'Usar con un cliente'}
        >
          <UseTemplateForm
            template={t}
            clientId={client?.id}
            clients={page.items.map((c) => ({ id: c.id, name: `${c.lastName}, ${c.firstName}` }))}
          />
        </Card>
      )}

      <Card title="Estructura">
        <p className="mb-2 text-sm">
          {t.totalWeeks} semanas · {t.sessionsPerWeek} sesiones/semana ·{' '}
          {t.fixedLength
            ? `${t.durationMonths} meses (guardada desde un plan real: solo puede acortarse)`
            : `diseñada para ${t.durationMonths} meses; al usarla eliges 3, 6, 9 o 12 (se toman sus fases en orden)`}
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {t.phases.map((p) => (
            <li key={`${p.name}-${p.startWeek}`}>
              <span className="font-medium">{p.name}</span> (semanas {p.startWeek}–{p.endWeek})
              {p.objective ? ` · ${p.objective}` : ''}
              {p.ownSessions ? (
                <span className="text-xs text-muted"> · sesiones propias de la fase</span>
              ) : null}
              <ul className="ml-4 list-disc text-muted">
                {p.mesocycles.map((m) => (
                  <li key={m.name}>
                    {m.name}
                    {m.focus ? ` · ${m.focus}` : ''}:{' '}
                    {m.weekTypes.map((w) => label('weekType', w)).join(' → ')}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <span className="text-muted">Material: </span>
          {t.equipment.length ? t.equipment.join(', ') : 'sin material especial'}
          {t.population.length ? (
            <>
              <span className="text-muted"> · Población: </span>
              {t.population.map((x) => POPULATION_LABELS[x] ?? x).join(', ')}
            </>
          ) : null}
        </p>
      </Card>

      {t.methods.length ? (
        <Card title="Evidencia de las dosis">
          <ul className="flex flex-wrap gap-3 text-sm">
            {t.methods.map((m) => (
              <li key={m.id}>
                <Link href={`/app/science/methods/${m.id}`} className="text-accent underline">
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <SourceButton
              evidence={await evidenceCards(ctx, { methodIds: t.methods.map((m) => m.id) })}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Las dosis siguen estos métodos; la elección de ejercicios, la ola de RIR y las descargas
            son recomendaciones prácticas (F). Es un punto de partida: adapta el plan al cliente.
          </p>
        </Card>
      ) : null}

      <TemplateEditor t={t} />

      {t.editable ? (
        <details className="rounded-lg border border-border bg-bg p-4">
          <summary className="cursor-pointer text-sm font-semibold">Datos de la plantilla</summary>
          <div className="mt-3">
            <TemplateDetailsForm
              t={t}
              profiles={profiles.map((p) => ({ slug: p.slug, name: p.name }))}
            />
          </div>
        </details>
      ) : null}

      <Card title="Versiones">
        <p className="mb-2 text-xs text-muted">
          Cada edición guardada es una versión; las seguidas de la misma persona se agrupan hasta
          que se crea un plan con ella. Los planes guardan la versión de la que salieron.
        </p>
        <table className="w-full text-sm">
          <caption className="sr-only">Versiones de la plantilla</caption>
          <thead className="text-left text-xs text-muted">
            <tr>
              <th scope="col" className="py-1 pr-2">
                Versión
              </th>
              <th scope="col" className="pr-2">
                Fecha
              </th>
              <th scope="col" className="pr-2">
                Quién
              </th>
              <th scope="col" className="pr-2">
                Nota
              </th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {t.versions.map((v) => (
              <tr key={v.version}>
                <td className="py-1 pr-2 tabular-nums">
                  v{v.version}
                  {v.version === t.templateVersion ? ' (actual)' : ''}
                </td>
                <td className="pr-2">{formatDateTime(v.updatedAt)}</td>
                <td className="pr-2">{v.author ?? (t.isGlobal ? 'Plataforma' : '—')}</td>
                <td className="pr-2">
                  {v.note ?? ''}
                  {v.usedAt ? <span className="text-xs text-muted"> · usada en planes</span> : null}
                </td>
                <td className="text-right">
                  {t.editable && v.version !== t.templateVersion ? (
                    <RestoreVersionButton
                      id={t.id}
                      version={v.version}
                      expectedVersion={t.version}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
