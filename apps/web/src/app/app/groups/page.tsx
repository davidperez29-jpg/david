import Link from 'next/link';
import { listGroups } from '@tp/application';
import { NewGroupForm } from '@/components/groups/forms';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate } from '@/lib/labels';
import { requireStaff } from '@/server/session';

/** Grupos y equipos (restructure phase 4): evaluate a team together and compare it. */
export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const groups = await listGroups(ctx, { archived: sp.archived === 'true' });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Grupos y equipos</h1>
        <Link href="/app" className="text-sm text-muted hover:underline">
          ← Mis clientes
        </Link>
      </div>
      <p className="text-sm text-muted">
        Un grupo reúne a varios clientes para evaluarlos el mismo día con una hoja de intentos y
        compararlos en un informe grupal (media, desviación, mejor, peor y Z frente al grupo). Solo
        lo ve el equipo técnico.
      </p>
      <Card title="Nuevo grupo">
        <NewGroupForm />
      </Card>
      <Card
        title="Grupos"
        actions={
          <Link
            href={sp.archived === 'true' ? '/app/groups' : '/app/groups?archived=true'}
            className="text-sm text-muted hover:underline"
          >
            {sp.archived === 'true' ? 'Ocultar archivados' : 'Ver archivados'}
          </Link>
        }
      >
        {groups.length === 0 ? (
          <EmptyState>Todavía no hay grupos. Crea uno y añade a sus miembros.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/app/groups/${g.id}`} className="font-medium hover:underline">
                  {g.name}
                </Link>
                <Badge>{g.members === 1 ? '1 miembro' : `${g.members} miembros`}</Badge>
                {g.archived ? <Badge tone="warn">Archivado</Badge> : null}
                {g.lastAssessedOn ? (
                  <Link
                    href={`/app/groups/${g.id}/${g.lastAssessedOn}?vista=informe`}
                    className="text-sm text-accent hover:underline"
                  >
                    Último informe: {formatDate(g.lastAssessedOn)}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
