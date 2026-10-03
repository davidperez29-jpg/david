import Link from 'next/link';
import { clientAgenda } from '@tp/application';
import { EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireClientUser } from '@/server/session';

const fmt = (d: string) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));

/** Published sessions only, grouped by week (§9.2). */
export default async function ClientCalendar() {
  const ctx = await requireClientUser();
  const a = await clientAgenda(ctx, ctx.actor.clientId!);
  const weeks = new Map<string, typeof a.sessions>();
  for (const s of a.sessions) {
    const k = `${s.planName} · semana ${s.weekIndex}`;
    weeks.set(k, [...(weeks.get(k) ?? []), s]);
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Calendario</h1>
      {a.sessions.length === 0 ? (
        <EmptyState>Todavía no hay sesiones publicadas.</EmptyState>
      ) : (
        [...weeks].map(([k, list]) => (
          <section key={k} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</h2>
            <ul className="flex flex-col gap-2">
              {list.map((s) => {
                const past = s.date! < a.today;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/me/sesion/${s.id}`}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-lg border px-4 py-2 ${s.date === a.today ? 'border-accent' : 'border-border'}`}
                    >
                      <span>
                        <span className="block text-sm text-muted first-letter:uppercase">
                          {fmt(s.date!)}
                          {s.date === a.today ? ' · hoy' : ''}
                        </span>
                        <span className="font-medium">{s.title ?? `Sesión ${s.dayLabel}`}</span>
                      </span>
                      <span className="text-xs text-muted">
                        {s.attendance
                          ? label('attendance', s.attendance)
                          : past
                            ? 'Sin registrar'
                            : s.estimatedDurationMin
                              ? `${s.estimatedDurationMin} min`
                              : ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
