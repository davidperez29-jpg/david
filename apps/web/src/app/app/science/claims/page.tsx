import Link from 'next/link';
import { listClaims } from '@tp/application';
import { LevelBadge, StatusBadge } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = Record<string, string | undefined>;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  const page = await listClaims(ctx, { ...clean, limit: 50 });
  const qs = (patch: SP) =>
    `?${new URLSearchParams(Object.entries({ ...clean, ...patch }).filter(([, v]) => v) as [string, string][])}`;
  const next = page.offset + page.limit < page.total ? page.offset + page.limit : null;
  const prev = page.offset > 0 ? Math.max(0, page.offset - page.limit) : null;
  const sel = 'h-9 rounded-md border border-border bg-bg px-2 text-sm';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form className="flex flex-1 flex-wrap gap-2" role="search">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Buscar afirmaciones"
            aria-label="Buscar"
            className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
          />
          <select name="level" defaultValue={sp.level ?? ''} aria-label="Nivel" className={sel}>
            <option value="">Todos los niveles</option>
            {Object.entries(LABELS.evidenceLevel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={sp.status ?? ''} aria-label="Estado" className={sel}>
            <option value="">Todos los estados</option>
            {Object.entries(LABELS.scienceStatus).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-border bg-bg px-4 text-sm">
            Filtrar
          </button>
        </form>
        <Link
          href="/app/science/claims/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Nueva afirmación
        </Link>
      </div>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState>No hay afirmaciones que coincidan.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {page.items.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-3">
                <Link href={`/app/science/claims/${c.id}`} className="font-medium hover:underline">
                  {c.statement}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <LevelBadge level={c.evidenceLevel} />
                  <StatusBadge status={c.status} />
                  <span>{label('epistemic', c.epistemicType)}</span>
                  {c.scope ? <span>· {c.scope}</span> : null}
                  <span className="font-mono">· {c.key}</span>
                  {c.isGlobal ? <Badge tone="accent">Global</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>{page.total} afirmación(es)</span>
          <span className="flex gap-3">
            {prev !== null ? (
              <Link href={qs({ offset: String(prev) })} className="underline">
                Anterior
              </Link>
            ) : null}
            {next !== null ? (
              <Link href={qs({ offset: String(next) })} className="underline">
                Siguiente
              </Link>
            ) : null}
          </span>
        </div>
      </Card>
    </div>
  );
}
