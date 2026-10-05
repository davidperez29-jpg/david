import Link from 'next/link';
import { getClient, listPlanTemplates, listProgrammingProfiles } from '@tp/application';
import { NewTemplateForm, UseTemplateForm } from '@/components/templates/template-actions';
import { KIND_LABELS, POPULATION_LABELS } from '@/lib/labels';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

type SP = Record<string, string | undefined>;
const FILTERS = [
  'q',
  'profile',
  'level',
  'days',
  'population',
  'kind',
  'scope',
  'archived',
  'fitsEquipment',
  'client',
] as const;

const select =
  'h-10 rounded-md border border-border bg-bg px-2 text-sm text-text aria-[invalid=true]:border-danger';

/** Library groups: the programming profile; without one, the kind (risk-reduction routines…). */
const groupOf = (t: { profileSlug: string | null; kind: string }) =>
  t.profileSlug ?? `kind:${t.kind}`;

/**
 * Plantillas (restructure phase 3): the library with its filters. Coming from a client
 * (?client=…), the templates that suit their profile, level and days come first and each one can
 * be used for them right here (Programa → Usar plantilla → elegir → Crear: 3 clicks).
 */
export default async function PlansHome({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const query = Object.fromEntries(FILTERS.flatMap((k) => (sp[k] ? [[k, sp[k]]] : [])));
  const [templates, profiles, client] = await Promise.all([
    listPlanTemplates(ctx, query),
    listProgrammingProfiles(ctx),
    sp.client ? getClient(ctx, sp.client).catch(() => null) : Promise.resolve(null),
  ]);
  const clientName = client ? `${client.firstName} ${client.lastName}` : null;
  const shown = templates.slice(0, 60);
  const groups = client
    ? [{ key: 'fit', title: `Para ${clientName}`, items: shown }]
    : [...new Set(shown.map(groupOf))].map((key) => {
        const first = shown.find((t) => groupOf(t) === key)!;
        return {
          key,
          title:
            first.profileName ??
            (first.kind === 'training' ? 'Sin perfil' : (KIND_LABELS[first.kind] ?? first.kind)),
          items: shown.filter((t) => groupOf(t) === key),
        };
      });
  const active = FILTERS.some((k) => k !== 'client' && sp[k]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Plantillas</h1>
        {client ? (
          <Link
            href={`/app/clients/${client.id}?tab=programa`}
            className="text-sm text-muted hover:underline"
          >
            ← {clientName}
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-muted">
        Puntos de partida, no recetas: usar una plantilla crea un plan independiente que luego
        adaptas. La duración (3, 6, 9 o 12 meses) se elige al usarla. Las dosis siguen los métodos
        enlazados en cada plantilla; la ola de RIR y las descargas son criterio práctico.
      </p>
      {client ? (
        <p className="rounded-md border border-accent p-3 text-sm">
          {client.programmingProfileId ? (
            'Primero las que encajan con su perfil, nivel, días por semana y material.'
          ) : (
            <>
              {client.firstName} no tiene perfil de programación: primero las que encajan con sus
              objetivos, su experiencia, sus días por semana y su material.{' '}
              <Link
                href={`/app/clients/${client.id}?tab=ficha`}
                className="font-medium text-accent underline"
              >
                Asignar perfil
              </Link>
            </>
          )}
        </p>
      ) : null}

      <form
        method="get"
        role="search"
        aria-label="Filtrar plantillas"
        className="flex flex-wrap items-end gap-2"
      >
        {sp.client ? <input type="hidden" name="client" value={sp.client} /> : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Buscar</span>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="hipertrofia, cuerpo completo…"
            className={`${select} w-56`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Perfil</span>
          <select name="profile" defaultValue={sp.profile ?? ''} className={select}>
            <option value="">Todos</option>
            {profiles.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nivel</span>
          <select name="level" defaultValue={sp.level ?? ''} className={select}>
            <option value="">Todos</option>
            <option value="1">1 · Inicial</option>
            <option value="2">2 · Intermedio</option>
            <option value="3">3 · Avanzado</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Días</span>
          <select name="days" defaultValue={sp.days ?? ''} className={select}>
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d} por semana
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Población</span>
          <select name="population" defaultValue={sp.population ?? ''} className={select}>
            <option value="">Todas</option>
            {Object.entries(POPULATION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select name="kind" defaultValue={sp.kind ?? ''} className={select}>
            <option value="">Todos</option>
            {Object.entries(KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Origen</span>
          <select name="scope" defaultValue={sp.scope ?? ''} className={select}>
            <option value="">Todas</option>
            <option value="global">De la plataforma</option>
            <option value="mine">Mis plantillas</option>
          </select>
        </label>
        {client ? (
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="fitsEquipment"
              value="true"
              defaultChecked={sp.fitsEquipment === 'true'}
            />
            Solo con su material
          </label>
        ) : null}
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archived"
            value="true"
            defaultChecked={sp.archived === 'true'}
          />
          Archivadas
        </label>
        <button className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast hover:bg-accent-hover">
          Filtrar
        </button>
        {active ? (
          <Link
            href={sp.client ? `/app/plans?client=${sp.client}` : '/app/plans'}
            className="flex h-10 items-center text-sm text-muted underline"
          >
            Quitar filtros
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-muted" role="status">
        {templates.length === 1 ? '1 plantilla' : `${templates.length} plantillas`}
        {templates.length > shown.length
          ? ` (se muestran ${shown.length}: afina con los filtros)`
          : ''}
      </p>

      {templates.length ? (
        groups.map((g) => (
          <Card key={g.key} title={g.title}>
            <ul className="divide-y divide-border">
              {g.items.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/app/plans/templates/${t.id}${client ? `?client=${client.id}` : ''}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    {t.levelN ? <Badge>Nivel {t.levelN}</Badge> : null}
                    <Badge>{t.sessionsPerWeek} días</Badge>
                    {t.kind !== 'training' ? (
                      <Badge tone="accent">{KIND_LABELS[t.kind] ?? t.kind}</Badge>
                    ) : null}
                    {t.isGlobal ? null : <Badge tone="accent">Propia · v{t.templateVersion}</Badge>}
                    {t.archived ? <Badge tone="warn">Archivada</Badge> : null}
                  </div>
                  {t.description ? <p className="text-sm text-muted">{t.description}</p> : null}
                  {client && t.missingEquipment.length ? (
                    <p className="text-xs text-warn">
                      Le falta material: {t.missingEquipment.join(', ')} (se puede adaptar).
                    </p>
                  ) : null}
                  {client && !t.archived ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-accent">
                        Usar con {clientName}
                      </summary>
                      <div className="mt-2">
                        <UseTemplateForm template={t} clientId={client.id} />
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ))
      ) : (
        <EmptyState>Ninguna plantilla con esos filtros.</EmptyState>
      )}

      <details className="rounded-lg border border-border bg-bg p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Crear una plantilla desde cero
        </summary>
        <div className="mt-3">
          <NewTemplateForm profiles={profiles.map((p) => ({ slug: p.slug, name: p.name }))} />
        </div>
      </details>
    </div>
  );
}
