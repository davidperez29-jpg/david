import Link from 'next/link';
import { getGroup, listAssessmentTests, listBatteries, listClients } from '@tp/application';
import { DomainError, localDate } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ArchiveGroupButton, GroupAssessmentForm, MembersEditor } from '@/components/groups/forms';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await requireStaff();
  const { groupId } = await params;
  const g = await getGroup(ctx, groupId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const [clients, batteries, tests] = await Promise.all([
    listClients(ctx, { limit: 100, offset: 0 }),
    listBatteries(ctx),
    listAssessmentTests(ctx, {}),
  ]);
  const candidates = [
    ...g.members.map((m) => ({ id: m.clientId, name: m.name })),
    ...clients.items
      .filter((c) => !g.members.some((m) => m.clientId === c.id))
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/groups" className="text-sm text-muted hover:underline">
          ← Grupos
        </Link>
        <h1 className="text-2xl font-semibold">{g.name}</h1>
        <Badge>{g.members.length === 1 ? '1 miembro' : `${g.members.length} miembros`}</Badge>
        {g.archived ? <Badge tone="warn">Archivado</Badge> : null}
        <span className="ml-auto">
          <ArchiveGroupButton groupId={g.id} version={g.version} archived={g.archived} />
        </span>
      </div>

      <Card title="Evaluaciones del grupo">
        {g.sessions.length === 0 ? (
          <EmptyState>Sin evaluaciones todavía.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {g.sessions.map((s) => (
              <li key={s.assessedOn} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{formatDate(s.assessedOn)}</span>
                <span className="text-xs text-muted">{s.assessments} evaluados</span>
                <Link
                  href={`/app/groups/${g.id}/${s.assessedOn}`}
                  className="text-sm text-accent hover:underline"
                >
                  Hoja de intentos
                </Link>
                <Link
                  href={`/app/groups/${g.id}/${s.assessedOn}?vista=informe`}
                  className="text-sm text-accent hover:underline"
                >
                  Informe grupal
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {g.members.length ? (
        <Card title="Nueva evaluación de grupo">
          <GroupAssessmentForm
            groupId={g.id}
            today={localDate(ctx.now())}
            batteries={batteries.map((b) => ({ id: b.id, name: b.name }))}
            tests={tests.map((t) => ({ id: t.id, name: t.name, category: t.category }))}
          />
        </Card>
      ) : null}

      <Card title="Miembros">
        {g.members.length === 0 ? (
          <p className="mb-2 text-sm text-muted">Marca a los clientes que forman el grupo.</p>
        ) : null}
        <MembersEditor
          groupId={g.id}
          members={g.members.map((m) => m.clientId)}
          candidates={candidates}
        />
      </Card>
    </div>
  );
}
