import Link from 'next/link';
import { trainerHome, type HomeAttention, type HomeStatus } from '@tp/application';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

/** Home (docs/UX_FLOW.md §2.1): «Mis clientes» and «Entrenamientos de hoy», nothing else. */
export default async function HomePage() {
  const ctx = await requireStaff();
  const home = await trainerHome(ctx, { limit: 100 });
  const { items, total } = home.clients;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Mis clientes</h1>
        <span className="flex-1" />
        <Link
          href="/app/groups"
          className="inline-flex h-10 items-center rounded-md border border-border bg-bg px-4 text-sm font-medium hover:bg-surface"
        >
          Grupos y equipos
        </Link>
        <Link
          href="/app/clients/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          + Nuevo cliente
        </Link>
      </div>
      <Card>
        {items.length === 0 ? (
          <EmptyState>
            Todavía no hay clientes. Pulsa «+ Nuevo cliente»: basta con el nombre y el perfil.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 py-3 text-sm md:grid-cols-[auto_minmax(10rem,1.2fr)_minmax(9rem,1fr)_minmax(10rem,1.2fr)_6rem]"
              >
                <StatusDot status={c.status} />
                <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">
                  {c.lastName}, {c.firstName}
                </Link>
                <span className="col-start-2 text-muted md:col-start-auto">
                  {c.programmingProfile ? (
                    <>
                      {c.programmingProfile}
                      {c.programmingLevel ? ` · N${c.programmingLevel}` : ''}
                    </>
                  ) : (
                    <Link href={`/app/clients/${c.id}?tab=ficha`} className="underline">
                      Elegir perfil
                    </Link>
                  )}
                </span>
                <span className="col-start-2 md:col-start-auto">
                  {c.next ? (
                    <Link
                      href={`/app/clients/${c.id}/sessions/${c.next.id}`}
                      className="hover:underline"
                    >
                      {dayLabel(c.next.date, home.today)} · {c.next.title}
                      {c.next.published ? null : (
                        <span className="text-muted"> (sin publicar)</span>
                      )}
                    </Link>
                  ) : (
                    <span className="text-muted">Sin sesiones próximas</span>
                  )}
                </span>
                <span
                  className="col-start-2 text-muted tabular-nums md:col-start-auto md:text-right"
                  title="Adherencia de las últimas 4 semanas"
                >
                  {c.adherence28.percent == null ? (
                    '—'
                  ) : (
                    <>
                      <span className="text-text">
                        {c.adherence28.percent.toLocaleString('es-ES')} %
                      </span>
                      <span className="sr-only"> de adherencia en 4 semanas</span>
                    </>
                  )}
                </span>
                {c.attention.length ? (
                  <ul className="col-start-2 flex flex-col gap-0.5 md:col-span-4">
                    {c.attention.slice(0, 2).map((a, i) => (
                      <li key={i}>
                        <Link
                          href={attentionHref(c.id, a)}
                          className={`text-xs hover:underline ${a.status === 'review' ? 'text-danger' : 'text-warn'}`}
                        >
                          {a.text}
                        </Link>
                      </li>
                    ))}
                    {c.attention.length > 2 ? (
                      <li className="text-xs text-muted">y {c.attention.length - 2} más</li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {total > items.length ? (
          <p className="mt-3 text-sm text-muted">
            Mostrando {items.length} de {total}.{' '}
            <Link href="/app/clients" className="text-accent underline">
              Ver todos los clientes
            </Link>
          </p>
        ) : items.length ? (
          <p className="mt-3 text-sm">
            <Link href="/app/clients" className="text-accent underline">
              Buscar y filtrar clientes
            </Link>
          </p>
        ) : null}
      </Card>

      <Card
        title="Entrenamientos de hoy"
        actions={
          <Link href="/app/calendar" className="text-sm text-accent underline">
            Ver calendario
          </Link>
        }
      >
        {home.todaySessions.length === 0 ? (
          <EmptyState>No hay entrenamientos programados hoy.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {home.todaySessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="w-12 text-muted tabular-nums">{s.time ?? '—'}</span>
                <Link
                  className="font-medium hover:underline"
                  href={`/app/clients/${s.clientId}/sessions/${s.id}`}
                >
                  {s.firstName} {s.lastName}
                </Link>
                <span className="text-muted">· {s.title}</span>
                {s.status ? (
                  <Badge tone={s.status === 'completed' ? 'ok' : 'warn'}>
                    {label('attendance', s.status)}
                  </Badge>
                ) : s.published ? (
                  <Badge>Sin registrar</Badge>
                ) : (
                  <Badge>No publicada</Badge>
                )}
                <Link
                  className="ml-auto text-xs text-accent underline"
                  href={`/app/clients/${s.clientId}/sessions/${s.id}/sala`}
                >
                  Modo sala
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const STATUS: Record<HomeStatus, { className: string; text: string }> = {
  ok: { className: 'bg-ok', text: 'Al día' },
  look: { className: 'bg-warn', text: 'Algo que mirar' },
  review: { className: 'bg-danger', text: 'Revisar' },
};

function StatusDot({ status }: { status: HomeStatus }) {
  const s = STATUS[status];
  return (
    <span className="mt-1 flex items-center" title={s.text}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${s.className}`} />
      <span className="sr-only">{s.text}</span>
    </span>
  );
}

function attentionHref(clientId: string, a: HomeAttention): string {
  if (a.reason === 'session_review' && a.sessionId)
    return `/app/clients/${clientId}/sessions/${a.sessionId}`;
  if (a.reason === 'referral') return `/app/clients/${clientId}?tab=ficha#salud`;
  return `/app/clients/${clientId}?tab=seguimiento`;
}

const WEEKDAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

/** «Hoy», «Mañana» or «mié., 08/10». */
function dayLabel(date: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return WEEKDAY.format(new Date(`${date}T00:00:00Z`));
}
