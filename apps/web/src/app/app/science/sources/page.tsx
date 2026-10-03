import Link from 'next/link';
import { listSources } from '@tp/application';
import { citation, Identifiers, VerificationBadge } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = Record<string, string | undefined>;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  const page = await listSources(ctx, { ...clean, limit: 50 });
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
            placeholder="Título, revista, DOI o PMID"
            aria-label="Buscar"
            className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
          />
          <select name="design" defaultValue={sp.design ?? ''} aria-label="Diseño" className={sel}>
            <option value="">Todos los diseños</option>
            {Object.entries(LABELS.studyDesign).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            aria-label="Verificación"
            className={sel}
          >
            <option value="">Cualquier verificación</option>
            {Object.entries(LABELS.verification).map(([k, v]) => (
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
          href="/app/science/sources/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Nueva fuente
        </Link>
      </div>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState>No hay fuentes que coincidan.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {page.items.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3">
                <Link href={`/app/science/sources/${s.id}`} className="font-medium hover:underline">
                  {s.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>
                    {citation(s)}
                    {s.journal ? ` · ${s.journal}` : ''}
                  </span>
                  <Badge>{label('studyDesign', s.studyDesign)}</Badge>
                  <VerificationBadge status={s.verificationStatus} />
                  <span>{s.findings} hallazgo(s)</span>
                  {s.isGlobal ? <Badge tone="accent">Global</Badge> : null}
                  <Identifiers doi={s.doi} pmid={s.pmid} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>{page.total} fuente(s)</span>
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
