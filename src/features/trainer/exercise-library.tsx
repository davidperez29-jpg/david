'use client';

import { ChevronDown, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { type LibraryVM } from '@/contracts/trainer';
import { VISIBILITY_LABELS, type Visibility } from '@/domain/library/exercise';
import {
  FACET_LABELS,
  type Facet,
  type FacetFilter,
  filterLabel,
  type MatchMode,
  searchLibrary,
  type SortOrder,
  toggleFilter,
} from '@/domain/library/search';
import {
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  LATERALITIES,
  LATERALITY_LABELS,
  type TaxonomyNode,
} from '@/domain/library/taxonomy';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { Badge } from '@/ui/badge';
import { cn } from '@/ui/cn';

type Option = { id: string; label: string };
type Group = { title?: string; help?: string; personal?: boolean; options: Option[] };

const flat = (nodes: readonly TaxonomyNode[]): Group[] => [
  { options: nodes.filter((n) => n.parentId === null).map((n) => ({ id: n.id, label: n.name })) },
];

/** Grupos jerárquicos: el grupo completo y, debajo, sus subtipos. */
const hierarchical = (nodes: readonly TaxonomyNode[]): Group[] =>
  nodes
    .filter((n) => n.parentId === null)
    .map((root) => ({
      title: root.name,
      options: [
        { id: root.id, label: `Todo: ${root.name}` },
        ...nodes
          .filter((n) => n.parentId === root.id)
          .map((n) => ({ id: n.id, label: n.shortName ?? n.name })),
      ],
    }));

export function ExerciseLibrary({ library }: { library: LibraryVM }) {
  const { taxonomy } = library;
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<FacetFilter[]>([]);
  const [mode, setMode] = useState<MatchMode>('all');
  const [sort, setSort] = useState<SortOrder>('name');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const exerciseName = useMemo(
    () => new Map(library.exercises.map((e) => [e.id, e.name])),
    [library.exercises],
  );
  const favorites = useMemo(() => new Set(library.favoriteIds), [library.favoriteIds]);

  const results = useMemo(() => {
    const pool = favoritesOnly
      ? library.variants.filter((v) => favorites.has(v.id))
      : library.variants;
    const patternRole = primaryOnly ? 'primary' : 'any';
    return searchLibrary(
      pool,
      library.exercises,
      { text, filters, mode, sort, patternRole },
      taxonomy,
    );
  }, [library, favorites, favoritesOnly, primaryOnly, text, filters, mode, sort, taxonomy]);

  const facets: { facet: Facet; groups: Group[]; open?: boolean }[] = [
    {
      facet: 'tag',
      open: true,
      groups: [...taxonomy.tagCategories]
        .sort((a, b) => a.order - b.order)
        .map((category) => ({
          title: category.name,
          help: category.description,
          personal: category.owner.kind === 'trainer',
          options: taxonomy.tags
            .filter((t) => t.categoryId === category.id)
            .map((t) => ({ id: t.id, label: t.name })),
        })),
    },
    { facet: 'pattern', open: true, groups: hierarchical(taxonomy.patterns) },
    {
      facet: 'equipment',
      groups: hierarchical(taxonomy.equipment).map((g) =>
        g.options.length === 1 ? { options: [{ ...g.options[0]!, label: g.title! }] } : g,
      ),
    },
    {
      facet: 'region',
      groups: hierarchical(taxonomy.regions).map((g) =>
        g.options.length === 1 ? { options: [{ ...g.options[0]!, label: g.title! }] } : g,
      ),
    },
    {
      facet: 'laterality',
      groups: [{ options: LATERALITIES.map((id) => ({ id, label: LATERALITY_LABELS[id] })) }],
    },
    { facet: 'environment', groups: flat(taxonomy.environments) },
    {
      facet: 'complexity',
      groups: [{ options: COMPLEXITIES.map((id) => ({ id, label: COMPLEXITY_LABELS[id] })) }],
    },
    {
      facet: 'origin',
      groups: [
        {
          options: (['global', 'trainer', 'private'] as Visibility[]).map((id) => ({
            id,
            label: VISIBILITY_LABELS[id],
          })),
        },
      ],
    },
  ];

  const isSelected = (facet: Facet, id: string) =>
    filters.some((f) => f.facet === facet && f.id === id);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[19rem_1fr]">
      {/* En pantallas estrechas los filtros se pliegan para que los resultados se vean enseguida. */}
      <button
        type="button"
        onClick={() => setShowFilters((value) => !value)}
        aria-expanded={showFilters}
        aria-controls="filtros-biblioteca"
        className="flex h-12 items-center justify-between rounded-2xl border border-line bg-white px-4 font-semibold text-ink-900 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden className="size-4" />
          {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          {filters.length > 0 ? (
            <span className="rounded-full bg-ink-900 px-2 py-0.5 text-xs text-cream-50">
              {filters.length}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform', showFilters && 'rotate-180')}
        />
      </button>
      <aside
        id="filtros-biblioteca"
        aria-label="Filtros"
        className={cn(
          'rounded-3xl border border-line/70 bg-white p-4 shadow-soft lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto',
          showFilters ? 'block' : 'hidden',
        )}
      >
        <fieldset>
          <legend className="text-sm font-bold text-ink-900">Coincidencia</legend>
          <div className="mt-2 grid grid-cols-2 rounded-2xl bg-cream-100 p-1">
            {(
              [
                ['all', 'Todos (Y)', 'Cumple todos los filtros'],
                ['any', 'Alguno (O)', 'Cumple al menos uno'],
              ] as const
            ).map(([value, label, help]) => (
              <label
                key={value}
                title={help}
                className={cn(
                  'cursor-pointer rounded-xl px-2 py-1.5 text-center text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink-900',
                  mode === value
                    ? 'bg-sun-400 text-ink-900 shadow-soft'
                    : 'text-ink-500 hover:text-ink-900',
                )}
              >
                <input
                  type="radio"
                  name="modo"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            className="size-4 accent-[#2b2116]"
          />
          <Star aria-hidden className="size-4 text-sun-700" /> Solo mis favoritos
        </label>

        <div className="mt-4 space-y-2">
          {facets.map(({ facet, groups, open }) => {
            const active = filters.filter((f) => f.facet === facet).length;
            return (
              <details
                key={facet}
                open={open}
                className="group rounded-2xl bg-cream-50 ring-1 ring-line"
              >
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-bold text-ink-900">
                  <span>
                    {FACET_LABELS[facet]}
                    {active > 0 ? (
                      <span className="ml-1.5 rounded-full bg-ink-900 px-1.5 py-0.5 text-[11px] text-cream-50">
                        {active}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="size-4 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  {facet === 'pattern' ? (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 ring-1 ring-line">
                      <input
                        type="checkbox"
                        checked={primaryOnly}
                        onChange={(event) => setPrimaryOnly(event.target.checked)}
                        className="size-4 accent-[#2b2116]"
                      />
                      Solo patrón principal (sin contar los secundarios)
                    </label>
                  ) : null}
                  {groups.map((group, index) => (
                    <div
                      key={group.title ?? index}
                      role="group"
                      aria-label={group.title ?? FACET_LABELS[facet]}
                    >
                      {group.title ? (
                        <p className="mb-1.5 text-xs font-semibold text-ink-500">
                          {group.title}
                          {group.personal ? ' · personal' : ''}
                          {group.help ? (
                            <span className="block font-normal">{group.help}</span>
                          ) : null}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((option) => {
                          const selected = isSelected(facet, option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setFilters((current) =>
                                  toggleFilter(current, { facet, id: option.id }),
                                )
                              }
                              className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                                selected
                                  ? 'bg-ink-900 text-cream-50'
                                  : 'bg-white text-ink-700 ring-1 ring-line hover:ring-ink-300',
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Buscar ejercicios</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500"
            />
            <input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Buscar: nombre, etiqueta, patrón, material, ejecución…"
              className="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-ink-900 placeholder:text-ink-500 focus:border-ink-300"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            Ordenar por
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="h-12 rounded-2xl border border-line bg-white px-3 text-ink-900"
            >
              <option value="name">Nombre</option>
              <option value="exercise">Ejercicio principal</option>
              <option value="complexity">Complejidad</option>
            </select>
          </label>
        </div>

        {filters.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
            <span className="text-xs font-semibold text-ink-500">
              {mode === 'all' ? 'Cumple todos:' : 'Cumple alguno:'}
            </span>
            {filters.map((filter) => (
              <button
                key={`${filter.facet}:${filter.id}`}
                type="button"
                onClick={() => setFilters((current) => toggleFilter(current, filter))}
                aria-label={`Quitar filtro ${filterLabel(filter, taxonomy)}`}
                className="inline-flex items-center gap-1 rounded-full bg-sun-300 py-1 pr-1.5 pl-3 text-xs font-bold text-ink-900 hover:bg-sun-400"
              >
                {filterLabel(filter, taxonomy)} <X aria-hidden className="size-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilters([])}
              className="text-xs font-semibold text-sun-700 underline-offset-2 hover:underline"
            >
              Quitar todos
            </button>
          </div>
        ) : null}

        <p className="mt-4 mb-3 text-sm text-ink-500" aria-live="polite">
          {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
        </p>

        {results.length === 0 ? (
          <p className="rounded-3xl bg-cream-50 p-6 text-center text-ink-500 ring-1 ring-line">
            Ningún ejercicio cumple esta combinación. Prueba con «Alguno (O)» o quita algún filtro.
          </p>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {results.map((variant) => {
              const tagNames = variant.tagIds
                .map((id) => taxonomy.tags.find((t) => t.id === id)?.name)
                .filter(Boolean) as string[];
              const primary = variant.patterns.find((p) => p.role === 'primary');
              const secondaryCount = variant.patterns.filter((p) => p.role === 'secondary').length;
              const primaryName = primary
                ? (taxonomy.patterns.find((p) => p.id === primary.id)?.name ?? primary.id)
                : null;
              return (
                <li key={variant.id}>
                  <Link
                    href={`/entrenador/ejercicios/${variant.id}`}
                    className="flex h-full gap-4 rounded-3xl border border-line/70 bg-white p-4 shadow-soft transition-shadow hover:shadow-lift"
                  >
                    <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-cream-100 ring-1 ring-line">
                      <ExercisePictogram silhouette={variant.silhouette} className="size-16" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-bold text-ink-900">{variant.name}</span>
                        {favorites.has(variant.id) ? (
                          <Star
                            aria-label="Favorito"
                            className="size-4 shrink-0 fill-sun-400 text-sun-700"
                          />
                        ) : null}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {variant.isPrimary
                          ? `${exerciseName.get(variant.exerciseId)} · variante de referencia`
                          : `Variante de ${exerciseName.get(variant.exerciseId)}`}
                        {variant.visibility !== 'global'
                          ? ` · ${VISIBILITY_LABELS[variant.visibility]}`
                          : ''}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {tagNames.slice(0, 4).map((name) => (
                          <Badge key={name} tone="sun">
                            {name}
                          </Badge>
                        ))}
                        {tagNames.length > 4 ? (
                          <Badge tone="outline">+{tagNames.length - 4}</Badge>
                        ) : null}
                      </span>
                      <span className="mt-2 block text-xs text-ink-700">
                        {primaryName ? (
                          <>
                            <span className="font-semibold">{primaryName}</span>
                            {secondaryCount > 0
                              ? ` · +${secondaryCount} ${secondaryCount === 1 ? 'secundario' : 'secundarios'}`
                              : ''}
                          </>
                        ) : (
                          'Sin patrón asignado'
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-ink-500">
                        {COMPLEXITY_LABELS[variant.complexity]} ·{' '}
                        {LATERALITY_LABELS[variant.laterality]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
