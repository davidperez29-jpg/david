import Link from 'next/link';
import { listClients } from '@tp/application';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; offset?: string }>;
}) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const page = await listClients(ctx, {
    q: sp.q || undefined,
    status: sp.status || undefined,
    offset: sp.offset ?? 0,
    limit: 25,
  });
  const next = page.offset + page.limit < page.total ? page.offset + page.limit : null;
  const prev = page.offset > 0 ? Math.max(0, page.offset - page.limit) : null;
  const qs = (offset: number) =>
    `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), offset: String(offset) })}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Link
          href="/app/clients/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Nuevo cliente
        </Link>
      </div>
      <form className="flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Buscar por nombre o email"
          aria-label="Buscar"
          className="h-10 min-w-60 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          aria-label="Estado"
          className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
        >
          <option value="">Activos, potenciales y en pausa</option>
          {(['active', 'lead', 'paused', 'archived'] as const).map((s) => (
            <option key={s} value={s}>
              {label('status', s)}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md border border-border bg-bg px-4 text-sm">Filtrar</button>
      </form>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState>No hay clientes que coincidan.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted uppercase">
                <tr>
                  <th className="py-2">Cliente</th>
                  <th>Edad</th>
                  <th>Objetivo principal</th>
                  <th>Modalidad</th>
                  <th>Entrenador/a</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">
                      <Link className="font-medium hover:underline" href={`/app/clients/${c.id}`}>
                        {c.lastName}, {c.firstName}
                      </Link>
                    </td>
                    <td className="tabular-nums">{c.age ?? '—'}</td>
                    <td>{c.primaryGoal ?? <span className="text-muted">Sin definir</span>}</td>
                    <td>{label('modality', c.modality)}</td>
                    <td className="text-muted">{c.trainers.join(', ')}</td>
                    <td>
                      <Badge tone={c.status === 'active' ? 'ok' : 'neutral'}>
                        {label('status', c.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>{page.total} cliente(s)</span>
          <span className="flex gap-3">
            {prev !== null ? (
              <Link href={qs(prev)} className="underline">
                Anterior
              </Link>
            ) : null}
            {next !== null ? (
              <Link href={qs(next)} className="underline">
                Siguiente
              </Link>
            ) : null}
          </span>
        </div>
      </Card>
    </div>
  );
}
