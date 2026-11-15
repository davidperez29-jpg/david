import Link from 'next/link';
import { type ExecutionDayVM, type RecentExecutionVM } from '@/contracts/analysis';
import { ANALYSIS_FORMULAS, type ExecutedVolume } from '@/domain/analysis/session';
import { formatDate, formatNumber } from '@/domain/format';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { dateTimeText, offsetText, timeText, TONNAGE_EXCLUSION_TEXT } from './analysis-copy';
import { FormulaBadge } from './formula-badge';

/**
 * Totales del día (B3.1). Lo ejecutado va por **fecha de ejecución** (la del inicio de cada
 * sesión, en la zona del móvil); lo previsto, por **fecha prevista**, aparte y sin sumarse
 * (P-93). Una sesión trasladada aparece en su día previsto como prevista y en el de ejecución
 * con lo que se hizo.
 */
const cell = (value: number | null, unit = '', digits = 1) =>
  value === null ? 'no aplica' : `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;

function VolumeCells({ v }: { v: ExecutedVolume }) {
  return (
    <>
      <td className="py-2 pr-3 tabular-nums">{v.sets.reps + v.sets.seconds + v.sets.meters}</td>
      <td className="py-2 pr-3 tabular-nums">
        {cell(v.reps, '', 0)}
        {v.repsPerSide !== null ? (
          <span className="block text-xs text-ink-500">
            + {formatNumber(v.repsPerSide)} «por lado»
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3 tabular-nums">{cell(v.seconds, 's', 0)}</td>
      <td className="py-2 pr-3 tabular-nums">{cell(v.meters, 'm')}</td>
      <td className="py-2 tabular-nums">{cell(v.tonnageKg, 'kg')}</td>
    </>
  );
}

function weekLabel(week: ExecutionDayVM['week']) {
  const [year, n] = week.key.split('-W') as [string, string];
  const date = (d: string) =>
    new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(`${d}T00:00:00Z`))
      .replace('.', '');
  return `Semana ${Number(n)} de ${year} (ISO): ${date(week.start)} – ${date(week.end)}`;
}

export function ExecutionDayView({
  vm,
  sessionHref,
  dayHref,
}: {
  vm: ExecutionDayVM;
  sessionHref: (sessionId: string) => string;
  dayHref: (date: string) => string;
}) {
  const excluded = Object.entries(vm.totals.tonnageExcluded) as [
    keyof typeof TONNAGE_EXCLUSION_TEXT,
    number,
  ][];
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-sun-800">Totales del día</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink-900 first-letter:uppercase">
          {formatDate(vm.date, 'long')}
        </h2>
        <p className="mt-1 text-sm text-ink-700">{weekLabel(vm.week)}</p>
        <nav aria-label="Otros días" className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link
            href={dayHref(prev(vm.date))}
            className="inline-flex min-h-10 items-center text-sun-800 hover:text-ink-900"
          >
            ← Día anterior
          </Link>
          <Link
            href={dayHref(next(vm.date))}
            className="inline-flex min-h-10 items-center text-sun-800 hover:text-ink-900"
          >
            Día siguiente →
          </Link>
        </nav>
      </header>

      <section aria-labelledby="ejecutado" className="rounded-3xl bg-white p-5 shadow-soft">
        <h3 id="ejecutado" className="text-lg font-bold text-ink-900">
          Ejecutado este día (según fecha de ejecución)
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          Sesiones que {vm.clientFirstName} empezó este día, en la zona de su móvil. Las series de
          después de la medianoche cuentan en el día de inicio de su sesión.
        </p>
        {vm.executed.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700">Ninguna sesión empezada este día.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                Lo registrado en cada sesión del día y el total, magnitud a magnitud
              </caption>
              <thead>
                <tr className="border-b border-line text-ink-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Sesión
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Series hechas
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Repeticiones
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Tiempo
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Distancia
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Tonelaje (nominal)
                  </th>
                </tr>
              </thead>
              <tbody>
                {vm.executed.map((s) => (
                  <tr key={s.sessionId} className="border-b border-line/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-semibold text-ink-900">
                      <Link
                        href={sessionHref(s.sessionId)}
                        className="text-ink-900 underline decoration-sun-400 underline-offset-2 hover:text-sun-800"
                      >
                        {s.label ? `${s.label} · ` : ''}
                        {s.title}
                      </Link>
                      <span className="block text-xs font-normal text-ink-500">
                        Empezada a las {timeText(s.startedAt, s.startTimeZone)}
                        {s.daysFromPlanned !== 0
                          ? ` · trasladada: prevista el ${formatDate(s.plannedDate, 'long')} (${offsetText(s.daysFromPlanned)})`
                          : ''}
                      </span>
                      <span className="mt-1 block">
                        <ExecutionStatusBadge status={s.status} />
                      </span>
                    </th>
                    <VolumeCells v={s.executed} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-ink-900">
                  <th scope="row" className="py-2 pr-3">
                    Total del día
                  </th>
                  <VolumeCells v={vm.totals} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FormulaBadge formula={ANALYSIS_FORMULAS.dayTotals} />
          <FormulaBadge formula={ANALYSIS_FORMULAS.totalReps} />
          <FormulaBadge formula={ANALYSIS_FORMULAS.volumeLoad} />
        </div>
        <ul className="mt-2 space-y-1 text-sm text-ink-500">
          <li>
            Cada magnitud se suma por separado; nunca se promedian porcentajes ni se mezclan
            repeticiones, segundos y metros.
          </li>
          {excluded.map(([reason, n]) => (
            <li key={reason}>
              Sin calcular en el tonelaje: {n} {n === 1 ? 'serie' : 'series'} con{' '}
              {TONNAGE_EXCLUSION_TEXT[reason]}.
            </li>
          ))}
          <li>
            Solo lo confirmado por el servidor; los valores se proponen con lo prescrito y una cifra
            igual a la propuesta puede no haberse revisado.
          </li>
        </ul>
      </section>

      <section aria-labelledby="previsto" className="rounded-3xl bg-white p-5 shadow-soft">
        <h3 id="previsto" className="text-lg font-bold text-ink-900">
          Previsto para este día (según fecha prevista)
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          Con la fecha prevista de la versión vigente. No se suma con lo ejecutado.
        </p>
        {vm.planned.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700">Ninguna sesión publicada prevista este día.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {vm.planned.map((s) => (
              <li
                key={s.sessionId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="min-w-0">
                  <Link
                    href={sessionHref(s.sessionId)}
                    className="font-semibold text-ink-900 underline decoration-sun-400 underline-offset-2 hover:text-sun-800"
                  >
                    {s.label ? `${s.label} · ` : ''}
                    {s.title}
                  </Link>
                  {s.executedOn && s.daysFromPlanned ? (
                    <span className="block text-sm text-ink-500">
                      Hecha el {formatDate(s.executedOn, 'long')} ({offsetText(s.daysFromPlanned)}):
                      su carga cuenta ese día.
                    </span>
                  ) : null}
                </span>
                <ExecutionStatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const prev = (date: string) => shift(date, -1);
const next = (date: string) => shift(date, 1);

/** Panel (A1): sesiones empezadas en los últimos 7 días, con enlace a su análisis. */
export function RecentExecutions({
  items,
  timeZone,
}: {
  items: RecentExecutionVM[];
  timeZone: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-500">Ninguna sesión empezada en los últimos 7 días.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.sessionId}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
        >
          <span className="min-w-0">
            <Link
              href={`/entrenador/clientes/${item.clientId}/sesiones/${item.sessionId}/analisis`}
              className="font-semibold text-ink-900 underline decoration-sun-400 underline-offset-2 hover:text-sun-800"
            >
              {item.clientName} · {item.label ? `${item.label} · ` : ''}
              {item.title}
            </Link>
            <span className="block text-sm text-ink-500">
              Empezada el {dateTimeText(item.startedAt, timeZone)}
            </span>
          </span>
          <ExecutionStatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  );
}
