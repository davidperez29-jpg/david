import Link from 'next/link';
import { listScienceSearches } from '@tp/application';
import { localDate } from '@tp/domain';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { NewSearchForm } from './form';

/**
 * Specific searches (restructure phase 9, SCIENCE_SYSTEM.md §4): each module is built from
 * searches by objective, population, injury, phase, method, test or criterion, logged with the
 * exact query, the date, how many results were reviewed and which sources were selected.
 */
export default async function SearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const ctx = await requireStaff();
  const { topic } = await searchParams;
  const data = await listScienceSearches(ctx, topic ? { topic } : {});
  const all = topic ? await listScienceSearches(ctx, {}) : data;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Registro de las búsquedas con las que se ha construido cada módulo. Solo entra lo que tiene
        metadatos verificados (título, autores, revista, año, DOI o PMID).
      </p>
      <nav aria-label="Temas" className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/app/science/busquedas"
          aria-current={!topic ? 'page' : undefined}
          className={!topic ? 'font-semibold' : 'text-accent underline'}
        >
          Todas ({all.items.length})
        </Link>
        {all.topics.map((t) => (
          <Link
            key={t}
            href={`?topic=${encodeURIComponent(t)}`}
            aria-current={topic === t ? 'page' : undefined}
            className={topic === t ? 'font-semibold' : 'text-accent underline'}
          >
            {t}
          </Link>
        ))}
      </nav>
      <NewSearchForm today={localDate(new Date())} />
      <Card title={topic ? `Búsquedas · ${topic}` : 'Búsquedas'}>
        {data.items.length ? (
          <ul className="divide-y divide-border text-sm">
            {data.items.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.objective}</span>
                  <Badge>{s.topic}</Badge>
                  {s.isGlobal ? null : <Badge tone="accent">Del centro</Badge>}
                  <span className="text-xs text-muted">
                    {s.database} · {formatDate(s.searchedOn)}
                    {s.reviewed != null ? ` · ${s.reviewed} revisados` : ''}
                  </span>
                </div>
                <code className="break-words text-xs">{s.query}</code>
                {[s.population, s.injury, s.phase, s.method, s.test, s.criterion].some(Boolean) ? (
                  <p className="text-xs text-muted">
                    {[s.population, s.injury, s.phase, s.method, s.test, s.criterion]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                {s.selected.length ? (
                  <p className="text-xs">
                    Seleccionadas:{' '}
                    {s.selected.map((x, i) => (
                      <span key={x.id}>
                        {i ? ', ' : ''}
                        <Link
                          href={`/app/science/sources/${x.id}`}
                          className="text-accent underline"
                        >
                          {x.citation}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Ninguna seleccionada.</p>
                )}
                {s.reason ? <p className="text-xs text-muted">{s.reason}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Sin búsquedas registradas.</EmptyState>
        )}
      </Card>
    </div>
  );
}
