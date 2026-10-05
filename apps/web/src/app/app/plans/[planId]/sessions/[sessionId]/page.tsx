import Link from 'next/link';
import { getSession } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui/card';
import { formatDate, label } from '@/lib/labels';
import { PublishButton } from '@/components/sessions/publish-button';
import { requireStaff } from '@/server/session';
import { AddBlock, BlockActions, SessionMetaForm } from '../../../forms';
import { SessionTable } from '../../../session-table';

export default async function SessionEditorPage({
  params,
}: {
  params: Promise<{ planId: string; sessionId: string }>;
}) {
  const ctx = await requireStaff();
  const { planId, sessionId } = await params;
  const s = await getSession(ctx, sessionId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  if (s.plan.id !== planId) notFound();
  const editable = s.plan.status !== 'archived' && s.plan.status !== 'completed';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/app/plans/${planId}`} className="text-sm text-muted hover:underline">
          ← {s.plan.name}
        </Link>
        <h1 className="text-2xl font-semibold">
          {s.dayLabel} · {s.title}
        </h1>
        <Badge>Semana {s.week.weekIndex}</Badge>
        <Badge tone={s.week.weekType === 'deload' ? 'warn' : 'neutral'}>
          {label('weekType', s.week.weekType)}
        </Badge>
        {s.scheduledDate ? (
          <span className="text-sm text-muted">{formatDate(s.scheduledDate)}</span>
        ) : null}
        {s.published ? <Badge tone="ok">Publicada al cliente</Badge> : <Badge>No publicada</Badge>}
        <PublishButton
          scope="session"
          id={s.id}
          published={s.published}
          disabled={!s.published && s.plan.status !== 'active'}
        />
        {s.plan.clientId ? (
          <Link
            href={`/app/clients/${s.plan.clientId}/sessions/${s.id}`}
            className="text-sm text-accent underline"
          >
            Registro y modo sala
          </Link>
        ) : null}
      </div>
      {s.plan.status === 'active' ? (
        <p className="rounded-md border border-warn p-2 text-xs">
          Plan activo: tus cambios se aplican y quedan auditados. Guarda una revisión del plan
          cuando termines.
        </p>
      ) : null}
      <SessionTable s={s} editable={editable} />
      {editable ? (
        <details className="rounded-lg border border-border bg-bg p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Datos de la sesión y duplicar
          </summary>
          <div className="mt-3">
            <SessionMetaForm s={s} />
          </div>
        </details>
      ) : null}
      {editable ? (
        <details className="rounded-lg border border-border bg-bg p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Bloques ({s.blocks.length}): calentamiento, principal, circuitos…
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-border">
              {s.blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {b.label ?? label('blockType', b.type)} ·{' '}
                    {label('blockOrganization', b.organization)}
                    {b.rounds ? ` · ${b.rounds} vueltas` : ''} ({b.exercises.length} ejercicios)
                  </span>
                  <BlockActions blockId={b.id} />
                </li>
              ))}
            </ul>
            <Card title="Nuevo bloque">
              <AddBlock sessionId={s.id} />
            </Card>
          </div>
        </details>
      ) : null}
    </div>
  );
}
