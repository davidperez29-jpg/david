import Link from 'next/link';
import { listExercises, listLibraryTaxonomies } from '@tp/application';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = Record<string, string | undefined>;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  const [tax, page] = await Promise.all([
    listLibraryTaxonomies(ctx),
    listExercises(ctx, { ...clean, limit: 50 }),
  ]);
  const groups = [...new Set(tax.muscles.map((m) => m.groupSlug))];
  const qs = (patch: SP) =>
    `?${new URLSearchParams(Object.entries({ ...clean, ...patch }).filter(([, v]) => v) as [string, string][])}`;
  const next = page.offset + page.limit < page.total ? page.offset + page.limit : null;
  const prev = page.offset > 0 ? Math.max(0, page.offset - page.limit) : null;
  const sel = 'h-9 rounded-md border border-border bg-bg px-2 text-sm';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Biblioteca de ejercicios</h1>
        <Link
          href="/app/library/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Nuevo ejercicio
        </Link>
      </div>
      <form className="flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Buscar (sin importar tildes)"
          aria-label="Buscar"
          className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
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
        <select
          name="muscleGroup"
          defaultValue={sp.muscleGroup ?? ''}
          aria-label="Grupo muscular"
          className={sel}
        >
          <option value="">Todos los músculos</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {label('muscleGroup', g)}
            </option>
          ))}
        </select>
        <select name="level" defaultValue={sp.level ?? ''} aria-label="Nivel" className={sel}>
          <option value="">Cualquier nivel</option>
          {Object.entries(LABELS.level).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ''} aria-label="Estado" className={sel}>
          <option value="">Borradores y publicados</option>
          {Object.entries(LABELS.exerciseStatus).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="needsReview"
          defaultValue={sp.needsReview ?? ''}
          aria-label="Revisión"
          className={sel}
        >
          <option value="">Revisados y sin revisar</option>
          <option value="true">Pendientes de revisión</option>
          <option value="false">Revisados</option>
        </select>
        <select name="video" defaultValue={sp.video ?? ''} aria-label="Vídeo" className={sel}>
          <option value="">Con o sin vídeo</option>
          <option value="verified">Vídeo verificado</option>
          <option value="pending">Vídeo pendiente</option>
          <option value="none">Sin vídeo</option>
        </select>
        <button className="h-9 rounded-md border border-border bg-bg px-4 text-sm">Filtrar</button>
        {Object.keys(clean).length ? (
          <Link href="/app/library" className="self-center text-sm text-muted underline">
            Limpiar
          </Link>
        ) : null}
      </form>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState>No hay ejercicios que coincidan.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted uppercase">
                <tr>
                  <th className="py-2">Ejercicio</th>
                  <th>Patrón</th>
                  <th>Músculos principales</th>
                  <th>Nivel</th>
                  <th>Vídeo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2">
                      <Link className="font-medium hover:underline" href={`/app/library/${e.id}`}>
                        {e.name}
                      </Link>
                      {e.categories.length ? (
                        <div className="text-xs text-muted">{e.categories.join(' · ')}</div>
                      ) : null}
                    </td>
                    <td>{e.pattern ?? <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{e.primaryMuscles.join(', ') || '—'}</td>
                    <td>{label('level', e.level)}</td>
                    <td>
                      {e.video === 'verified' ? (
                        <Badge tone="ok">Verificado</Badge>
                      ) : e.video === 'pending' ? (
                        <Badge tone="warn">Pendiente</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="flex flex-wrap gap-1 py-2">
                      <Badge tone={e.status === 'published' ? 'ok' : 'neutral'}>
                        {label('exerciseStatus', e.status)}
                      </Badge>
                      {e.needsReview ? <Badge tone="warn">Revisar</Badge> : null}
                      {e.isGlobal ? <Badge tone="accent">Global</Badge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>{page.total} ejercicio(s)</span>
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
