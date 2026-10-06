import Link from 'next/link';
import { calendarEvents, calendarTrainers, listClients } from '@tp/application';
import { addDays, isoWeekday, localDate, monthGrid, shiftMonth } from '@tp/domain';
import { Card } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = { mes?: string; semana?: string; vista?: string; cliente?: string; entrenador?: string };

const MONTH = (m: string) =>
  new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${m}-01T00:00:00Z`),
  );
const DAY = (d: string) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Status of a session as icon + text (never colour alone). */
function sessionMark(
  s: { attendance: string | null; published: boolean; date: string },
  today: string,
) {
  if (s.attendance === 'completed') return { icon: '✓', text: 'Completada', cls: 'text-ok' };
  if (s.attendance === 'partial') return { icon: '◐', text: 'Incompleta', cls: 'text-warn' };
  if (s.attendance === 'started') return { icon: '▶', text: 'Iniciada', cls: 'text-accent' };
  if (s.attendance)
    return { icon: '✗', text: label('attendance', s.attendance), cls: 'text-danger' };
  if (!s.published) return { icon: '○', text: 'No publicada', cls: 'text-muted' };
  if (s.date < today) return { icon: '!', text: 'Sin registrar', cls: 'text-warn' };
  return { icon: '•', text: 'Pendiente', cls: 'text-muted' };
}

/** Global calendar (F18): sessions, assessments, phases and rest weeks (§8.1 "Calendario"). */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const today = localDate(ctx.now());
  const week = sp.vista === 'semana';
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : today.slice(0, 7);
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(sp.semana ?? '')
    ? addDays(sp.semana!, 1 - isoWeekday(sp.semana!))
    : addDays(today, 1 - isoWeekday(today));
  const grid = week
    ? [Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))]
    : monthGrid(month);
  const from = grid[0]![0]!;
  const to = grid.at(-1)!.at(-1)!;
  const [data, clients, trainers] = await Promise.all([
    calendarEvents(ctx, {
      from,
      to,
      clientId: sp.cliente || undefined,
      trainerId: sp.entrenador || undefined,
      // A large centre (hundreds of sessions a day): the month shows a few per day, the week more.
      perDay: week ? 40 : 4,
    }),
    listClients(ctx, { limit: 100 }),
    calendarTrainers(ctx),
  ]);
  const href = (p: Partial<SP>) => {
    const q = new URLSearchParams();
    const all = {
      vista: week ? 'semana' : '',
      mes: month,
      semana: weekStart,
      cliente: sp.cliente ?? '',
      entrenador: sp.entrenador ?? '',
      ...p,
    };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    return `?${q}`;
  };
  const byDay = (d: string) => ({
    sessions: data.sessions.filter((s) => s.date === d),
    assessments: data.assessments.filter((a) => a.date === d),
    spans: data.spans.filter((s) => s.from <= d && s.to >= d),
  });
  const title = week
    ? `Semana del ${DAY(weekStart)}`
    : MONTH(month).replace(/^./, (c) => c.toUpperCase());

  const DayContent = ({ d, compact }: { d: string; compact: boolean }) => {
    const x = byDay(d);
    const max = compact ? 4 : 99;
    // Sessions of the day beyond those returned (per-day limit) plus those not drawn here.
    const total = x.assessments.length + (data.sessionTotals[d] ?? 0);
    const items = [
      ...x.assessments.map((a) => (
        <li key={`a-${a.id}`}>
          <Link
            href={`/app/clients/${a.clientId}/assessments/${a.id}`}
            className="block min-h-6 truncate rounded bg-surface px-1 leading-6 hover:underline"
            title={`Evaluación de ${a.firstName} ${a.lastName} (${label('assessmentStatus', a.status)})`}
          >
            📋 {sp.cliente ? 'Evaluación' : `${a.firstName} ${a.lastName[0]}.`}
            <span className="sr-only"> · evaluación {label('assessmentStatus', a.status)}</span>
          </Link>
        </li>
      )),
      ...x.sessions.map((s) => {
        const m = sessionMark(s, data.today);
        return (
          <li key={s.id}>
            <Link
              href={`/app/clients/${s.clientId}/sessions/${s.id}`}
              className="flex min-h-6 items-center gap-1 truncate hover:underline"
              title={`${s.firstName} ${s.lastName} · ${s.title} · ${m.text}`}
            >
              <span className={m.cls} aria-hidden>
                {m.icon}
              </span>
              <span className="truncate">
                {s.time ? `${s.time.slice(0, 5)} ` : ''}
                {sp.cliente ? s.title : `${s.firstName} ${s.lastName[0]}.`}
              </span>
              <span className="sr-only"> · {m.text}</span>
            </Link>
          </li>
        );
      }),
    ];
    const hidden = total - Math.min(items.length, max);
    return (
      <>
        {x.spans
          .filter((s) => s.kind === 'rest' || s.from === d || isoWeekday(d) === 1)
          .map((s) => (
            <p
              key={`${s.kind}-${s.label}-${s.from}`}
              className={`truncate text-[10px] font-medium uppercase ${s.kind === 'rest' ? 'text-warn' : 'text-accent'}`}
            >
              {s.kind === 'rest' ? `↓ ${s.label}` : s.label}
            </p>
          ))}
        <ul className="flex flex-col gap-0.5 text-xs">{items.slice(0, max)}</ul>
        {hidden > 0 && !compact ? (
          <p className="text-[11px] text-muted">
            +{hidden} más: filtra por entrenador/a o cliente para verlas.
          </p>
        ) : hidden > 0 ? (
          <Link
            href={href({ vista: 'semana', semana: d })}
            className="inline-flex min-h-6 items-center text-[11px] text-accent underline"
          >
            +{hidden} más
          </Link>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Calendario</h1>
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/app/calendar">
          {week ? <input type="hidden" name="vista" value="semana" /> : null}
          <input type="hidden" name={week ? 'semana' : 'mes'} value={week ? weekStart : month} />
          <label htmlFor="cal-cliente">Cliente</label>
          <select
            id="cal-cliente"
            name="cliente"
            defaultValue={sp.cliente ?? ''}
            className="h-9 rounded-md border border-border bg-bg px-2"
          >
            <option value="">Todos</option>
            {clients.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.lastName}, {c.firstName}
              </option>
            ))}
          </select>
          {trainers.length ? (
            <>
              <label htmlFor="cal-entrenador">Entrenador/a</label>
              <select
                id="cal-entrenador"
                name="entrenador"
                defaultValue={sp.entrenador ?? ''}
                className="h-9 rounded-md border border-border bg-bg px-2"
              >
                <option value="">Todos</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button className="h-9 rounded-md border border-border px-3">Filtrar</button>
        </form>
      </div>

      <nav
        aria-label="Navegación del calendario"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          className="rounded-md border border-border px-3 py-1"
          href={
            week ? href({ semana: addDays(weekStart, -7) }) : href({ mes: shiftMonth(month, -1) })
          }
        >
          ← Anterior
        </Link>
        <Link
          className="rounded-md border border-border px-3 py-1"
          href={
            week
              ? href({ semana: addDays(today, 1 - isoWeekday(today)) })
              : href({ mes: today.slice(0, 7) })
          }
        >
          Hoy
        </Link>
        <Link
          className="rounded-md border border-border px-3 py-1"
          href={
            week ? href({ semana: addDays(weekStart, 7) }) : href({ mes: shiftMonth(month, 1) })
          }
        >
          Siguiente →
        </Link>
        <h2 className="ml-2 text-lg font-semibold">{title}</h2>
        <span className="ml-auto flex gap-1">
          <Link
            href={href({ vista: '' })}
            aria-current={!week ? 'page' : undefined}
            className={`rounded-md px-3 py-1 ${!week ? 'bg-surface font-medium' : 'text-muted'}`}
          >
            Mes
          </Link>
          <Link
            href={href({ vista: 'semana' })}
            aria-current={week ? 'page' : undefined}
            className={`rounded-md px-3 py-1 ${week ? 'bg-surface font-medium' : 'text-muted'}`}
          >
            Semana
          </Link>
        </span>
      </nav>

      <p className="text-xs text-muted">
        ✓ completada · ◐ parcial · ✗ no realizada · ! sin registrar · • pendiente · ○ no publicada ·
        📋 evaluación
        {sp.cliente
          ? ' · en azul, la fase del plan; ↓ semanas de descarga o transición'
          : ' · elige un cliente para ver las fases y las descargas'}
      </p>

      {/* Desktop: grid. Mobile: day-by-day agenda. */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-bg md:block">
        <div className="grid grid-cols-7 border-b border-border text-xs text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1">
              {w}
            </div>
          ))}
        </div>
        {grid.map((row) => (
          <div key={row[0]} className="grid grid-cols-7 border-b border-border last:border-0">
            {row.map((d) => {
              const out = !week && d.slice(0, 7) !== month;
              return (
                <div
                  key={d}
                  className={`min-h-28 border-r border-border p-1 last:border-0 ${out ? 'bg-surface/60 text-muted' : ''} ${week ? 'min-h-64' : ''}`}
                >
                  <p
                    className={`mb-1 text-xs ${d === data.today ? 'inline-block rounded-full bg-accent px-1.5 font-semibold text-accent-contrast' : 'text-muted'}`}
                  >
                    {Number(d.slice(8))}
                    {d === data.today ? <span className="sr-only"> (hoy)</span> : null}
                  </p>
                  <DayContent d={d} compact={!week} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {grid
          .flat()
          .filter((d) => week || d.slice(0, 7) === month)
          .filter((d) => {
            const x = byDay(d);
            return x.sessions.length + x.assessments.length > 0 || d === data.today;
          })
          .map((d) => (
            <Card key={d} title={`${DAY(d)}${d === data.today ? ' · hoy' : ''}`}>
              <DayContent d={d} compact={false} />
            </Card>
          ))}
      </div>
    </div>
  );
}
