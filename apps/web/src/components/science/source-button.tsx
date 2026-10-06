import Link from 'next/link';
import type { EvidenceCards } from '@tp/application';
import { Identifiers } from './evidence';

/**
 * «Fuente» (restructure phase 9, SCIENCE_SYSTEM.md §6): a small icon next to the exercise, the
 * test, the criterion or the recommendation that opens the source card where it is used —
 * article, DOI/PMID, population, what it supports, kind of evidence and limitations. Native
 * <details>: works without JavaScript and with a keyboard. Only verified sources are shown as
 * support; anything else is listed apart and says it does not back anything.
 */
export function SourceButton({
  evidence,
  ids,
  label = 'Fuente',
}: {
  evidence: EvidenceCards;
  /** Restrict to these source ids (when one call loaded the cards for a whole page). */
  ids?: string[];
  label?: string;
}) {
  const keep = ids ? new Set(ids) : null;
  const cards = keep ? evidence.cards.filter((c) => keep.has(c.id)) : evidence.cards;
  const flagged = keep
    ? evidence.notSupporting.filter((c) => keep.has(c.id))
    : evidence.notSupporting;
  if (!cards.length && !flagged.length)
    return <span className="text-xs text-muted">Evidencia insuficiente / criterio práctico</span>;
  return (
    <details className="text-sm">
      <summary
        className="inline-flex cursor-pointer items-center gap-1 text-accent"
        aria-label={`${label}: ${cards.length} referencia(s) verificada(s)`}
      >
        <span aria-hidden="true">ⓘ</span> {label}
        {cards.length > 1 ? ` (${cards.length})` : ''}
      </summary>
      <div className="mt-2 flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
        {cards.map((c) => (
          <article key={c.id} className="flex flex-col gap-1">
            <p>
              <Link href={`/app/science/sources/${c.id}`} className="font-medium underline">
                {c.citation}
              </Link>{' '}
              {c.title}
              {c.journal ? <span className="text-muted"> · {c.journal}</span> : null}
            </p>
            <p className="text-xs">
              <Identifiers doi={c.doi} pmid={c.pmid} />
            </p>
            <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Diseño</dt>
              <dd>{c.design}</dd>
              <dt className="text-muted">Población</dt>
              <dd>{c.population ?? '—'}</dd>
              <dt className="text-muted">Qué respalda</dt>
              <dd>
                {c.supports.length ? (
                  <ul className="list-disc pl-4">
                    {c.supports.map((x) => (
                      <li key={x.statement}>
                        {x.statement}{' '}
                        <span className="text-muted">
                          ({[x.evidenceKind, x.level].filter(Boolean).join(' · ')})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">Contexto (sin afirmación publicada)</span>
                )}
              </dd>
              <dt className="text-muted">Limitaciones</dt>
              <dd>{c.limitations ?? '—'}</dd>
              <dt className="text-muted">Origen</dt>
              <dd>
                {c.origin}
                {c.citedIn ? ` · citada en ${c.citedIn}` : ''} · {c.verification}
              </dd>
            </dl>
          </article>
        ))}
        {flagged.length ? (
          <div className="border-t border-border pt-2 text-xs text-muted">
            <p className="font-medium">No se usan como respaldo:</p>
            <ul className="list-disc pl-4">
              {flagged.map((f) => (
                <li key={f.id}>
                  {f.citation} — {f.verification}
                  {f.citedIn ? ` (citada en ${f.citedIn})` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
