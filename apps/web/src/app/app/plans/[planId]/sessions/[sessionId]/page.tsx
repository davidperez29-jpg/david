import Link from 'next/link';
import { getSession } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { AddBlock, AddExercise, BlockActions, ExerciseRow, SessionMetaForm } from '../../../forms';

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
      </div>
      {s.plan.status === 'active' ? (
        <p className="rounded-md border border-warn p-2 text-xs">
          Plan activo: tus cambios se aplican y quedan auditados. Guarda una revisión del plan
          cuando termines.
        </p>
      ) : null}
      {editable ? (
        <Card title="Sesión">
          <SessionMetaForm s={s} />
        </Card>
      ) : null}
      {s.blocks.length === 0 ? <EmptyState>Sesión vacía: añade un bloque.</EmptyState> : null}
      {s.blocks.map((b) => (
        <Card
          key={b.id}
          title={`${b.label ?? label('blockType', b.type)} · ${label('blockOrganization', b.organization)}${b.rounds ? ` · ${b.rounds} vueltas` : ''}`}
          actions={editable ? <BlockActions blockId={b.id} /> : undefined}
        >
          {b.exercises.length === 0 ? <p className="text-sm text-muted">Sin ejercicios.</p> : null}
          <ul>
            {b.exercises.map((e) => (
              <ExerciseRow key={`${e.id}-${e.version}`} e={e} editable={editable} />
            ))}
          </ul>
          {editable ? <AddExercise blockId={b.id} /> : null}
        </Card>
      ))}
      {editable ? (
        <Card title="Nuevo bloque">
          <AddBlock sessionId={s.id} />
        </Card>
      ) : null}
    </div>
  );
}
