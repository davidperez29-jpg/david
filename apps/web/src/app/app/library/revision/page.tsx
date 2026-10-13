import Link from 'next/link';
import { exerciseReviewOverview, listExerciseReview, listLibraryTaxonomies } from '@tp/application';
import { REVIEW_GAP_VALUES } from '@tp/contracts';
import { ReviewTable } from '@/components/library/review-table';
import { Card, EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = Record<string, string | undefined>;

export const metadata = { title: 'Revisión del banco' };
const FILTERS = ['gap', 'q', 'patternId', 'categoryId', 'status'] as const;

/**
 * Review of the exercise bank (restructure phase 19): how much is done, what is missing, and the
 * queue to complete it — one by one with «Revisar», or one change for many at once.
 */
export default async function BankReviewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const filters = Object.fromEntries(
    FILTERS.filter((k) => sp[k]).map((k) => [k, sp[k]!]),
  ) as Record<string, string>;
  const offset = Number(sp.offset ?? 0) || 0;
  const [ov, page, tax] = await Promise.all([
    exerciseReviewOverview(ctx),
    listExerciseReview(ctx, { ...filters, offset, limit: 50 }),
    listLibraryTaxonomies(ctx),
  ]);
  const queue = new URLSearchParams(filters).toString();
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(
      Object.entries({ ...filters, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return `/app/library/revision${p.size ? `?${p}` : ''}`;
  };
  const done = ov.published + ov.ready;
  const next = offset + page.limit < page.total ? offset + page.limit : null;
  const prev = offset > 0 ? Math.max(0, offset - page.limit) : null;
  // min-w-0: a select sizes itself to its longest option, wider than a phone (1.4.10).
  const sel = 'h-9 min-w-0 max-w-full rounded-md border border-border bg-bg px-2 text-sm';
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/library" className="text-sm text-muted hover:underline">
        ← Ejercicios
      </Link>
      <h1 className="text-2xl font-semibold">Revisión del banco</h1>

      <Card title="Avance">
        <p className="text-sm">
          De los <strong>{ov.total}</strong> ejercicios del centro, {ov.published} están publicados
          y {ov.ready} están completos y listos para publicar.
        </p>
        <progress
          className="mt-2 h-3 w-full accent-[var(--accent)]"
          value={done}
          max={Math.max(ov.total, 1)}
          aria-label={`Completados: ${done} de ${ov.total}`}
        />
        <nav aria-label="Qué falta" className="mt-3">
          <ul className="flex flex-wrap gap-2 text-sm">
            <li>
              <Link
                href={link({ gap: undefined })}
                aria-current={!filters.gap ? 'page' : undefined}
                className={`inline-flex min-h-8 items-center rounded-full border px-3 ${!filters.gap ? 'border-accent text-accent' : 'border-border'}`}
              >
                Todos ({ov.total})
              </Link>
            </li>
            {[...REVIEW_GAP_VALUES, 'ready' as const].map((g) => {
              const n = g === 'ready' ? ov.ready : ov.gaps[g];
              if (!n && filters.gap !== g) return null;
              return (
                <li key={g}>
                  <Link
                    href={link({ gap: g })}
                    aria-current={filters.gap === g ? 'page' : undefined}
                    className={`inline-flex min-h-8 items-center rounded-full border px-3 ${filters.gap === g ? 'border-accent text-accent' : 'border-border'}`}
                  >
                    {label('reviewGap', g)} ({n})
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="mt-3 text-sm">
          Vídeos: {ov.videos.verified} verificados, {ov.videos.pending} sin verificar y{' '}
          {ov.videos.broken} rotos.{' '}
          {ov.videos.pending ? (
            <Link href="/app/library/revision/videos" className="text-accent underline">
              Verificar vídeos ({ov.videos.pending})
            </Link>
          ) : null}
        </p>
      </Card>

      <form className="flex flex-wrap gap-2" role="search" aria-label="Filtrar la cola">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Buscar por nombre"
          aria-label="Buscar por nombre"
          className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
        <select name="gap" defaultValue={sp.gap ?? ''} aria-label="Qué falta" className={sel}>
          <option value="">Falte lo que falte</option>
          {[...REVIEW_GAP_VALUES, 'ready'].map((g) => (
            <option key={g} value={g}>
              {label('reviewGap', g)}
            </option>
          ))}
        </select>
        <select
          name="patternId"
          defaultValue={sp.patternId ?? ''}
          aria-label="Patrón"
          className={sel}
        >
          <option value="">Todos los patrones</option>
          {tax.patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          defaultValue={sp.categoryId ?? ''}
          aria-label="Categoría"
          className={sel}
        >
          <option value="">Todas las categorías</option>
          {tax.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ''} aria-label="Estado" className={sel}>
          <option value="">Borradores y publicados</option>
          <option value="draft">Borradores</option>
          <option value="published">Publicados</option>
        </select>
        <button className="h-9 rounded-md border border-border bg-bg px-4 text-sm">Filtrar</button>
        {Object.keys(filters).length ? (
          <Link href="/app/library/revision" className="self-center text-sm text-muted underline">
            Limpiar
          </Link>
        ) : null}
      </form>

      <Card
        title={`${page.total} ${page.total === 1 ? 'ejercicio' : 'ejercicios'} en la cola${filters.gap ? `: ${label('reviewGap', filters.gap).toLowerCase()}` : ''}`}
        headingId="cola-titulo"
      >
        {page.items.length === 0 ? (
          <EmptyState>
            {ov.total
              ? 'Nada pendiente con este filtro.'
              : 'El centro aún no tiene ejercicios propios.'}
          </EmptyState>
        ) : (
          <ReviewTable
            // Another page or filter starts with nothing selected and no old result (A-BR-1).
            key={`${queue}|${offset}`}
            items={page.items}
            queue={queue}
            focusId="cola-titulo"
            options={{
              patterns: tax.patterns.map((p) => ({ id: p.id, name: p.name })),
              categories: tax.categories.map((c) => ({ id: c.id, name: c.name })),
              muscles: tax.muscles.map((m) => ({ id: m.id, name: m.name })),
              profiles: tax.profiles.map((p) => ({ id: p.id, name: p.name })),
            }}
          />
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            {page.total ? `${offset + 1}–${offset + page.items.length} de ${page.total}` : null}
          </span>
          <span className="flex gap-3">
            {prev !== null ? (
              <Link href={link({ offset: String(prev) })} className="underline">
                Anterior
              </Link>
            ) : null}
            {next !== null ? (
              <Link href={link({ offset: String(next) })} className="underline">
                Siguiente
              </Link>
            ) : null}
          </span>
        </div>
      </Card>
    </div>
  );
}
