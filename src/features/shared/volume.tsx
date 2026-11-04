'use client';

import { useId, useState } from 'react';
import { type WeeklyVolume } from '@/contracts/shared';
import { formatDate, formatNumber } from '@/domain/format';
import { cn } from '@/ui/cn';

export type VolumeMetric = 'volumeLoadKg' | 'completedSets' | 'totalReps';

export const METRICS: Record<VolumeMetric, { label: string; unit: string; formula: string }> = {
  completedSets: { label: 'Series', unit: 'series', formula: 'training.completed-sets v1.0.0' },
  totalReps: { label: 'Repeticiones', unit: 'rep.', formula: 'training.total-reps v1.0.0' },
  volumeLoadKg: { label: 'Tonelaje', unit: 'kg', formula: 'training.volume-load v1.0.0' },
};

/** Redondea hacia arriba a un número «limpio» (1, 2, 2,5, 5 × 10ⁿ) para el eje. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

const formatValue = (value: number, metric: VolumeMetric) =>
  `${formatNumber(value, metric === 'volumeLoadKg' ? 0 : 1)} ${METRICS[metric].unit}`;

/** Selector de métrica: una fila sobre los gráficos a los que afecta. */
export function MetricSwitch({
  value,
  onChange,
  options = ['completedSets', 'totalReps', 'volumeLoadKg'],
}: {
  value: VolumeMetric;
  onChange: (metric: VolumeMetric) => void;
  options?: VolumeMetric[];
}) {
  const name = useId();
  return (
    <fieldset className="inline-flex rounded-2xl border border-line bg-white p-1">
      <legend className="sr-only">Métrica de volumen</legend>
      {options.map((metric) => (
        <label
          key={metric}
          className={cn(
            'cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink-900',
            value === metric ? 'bg-sun-400 text-ink-900' : 'text-ink-500 hover:text-ink-900',
          )}
        >
          <input
            type="radio"
            name={name}
            value={metric}
            checked={value === metric}
            onChange={() => onChange(metric)}
            className="sr-only"
          />
          {METRICS[metric].label}
        </label>
      ))}
    </fieldset>
  );
}

export function WeeklyVolumeChart({
  weeks,
  metric,
  currentWeek,
  label,
}: {
  weeks: WeeklyVolume[];
  metric: VolumeMetric;
  currentWeek: string;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceCeil(Math.max(...weeks.map((w) => w[metric]), 0));
  const ticks = [0, max / 2, max];
  const empty = weeks.every((w) => w[metric] === 0);
  const labelled = [...weeks].reverse().find((w) => w.week === currentWeek && w[metric] > 0);

  return (
    <figure className="w-full">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative h-44 pl-11" onMouseLeave={() => setActive(null)}>
        {ticks.map((tick) => (
          <div
            key={tick}
            aria-hidden
            className="absolute right-0 left-11 border-t border-chart-grid"
            style={{ bottom: `${(tick / max) * 100}%` }}
          >
            <span className="absolute top-0 -left-11 w-9 -translate-y-1/2 text-right text-[11px] text-ink-500 tabular-nums">
              {formatNumber(tick, 1)}
            </span>
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-11 flex">
          {weeks.map((week, index) => {
            const value = week[metric];
            const height = (value / max) * 100;
            const isCurrent = week.week === currentWeek;
            return (
              <button
                key={week.week}
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`Semana del ${formatDate(week.weekStart, 'dayMonth')}${isCurrent ? ' (en curso)' : ''}: ${formatValue(value, metric)}, ${week.sessions} sesiones`}
                className="group relative flex h-full flex-1 items-end justify-center rounded-lg focus-visible:outline-offset-[-2px]"
              >
                {labelled === week ? (
                  <span
                    className="absolute text-xs font-bold text-ink-900 tabular-nums"
                    style={{ bottom: `calc(${height}% + 6px)` }}
                    aria-hidden
                  >
                    {formatNumber(value, 0)}
                  </span>
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    'w-6 rounded-t-[4px] bg-chart-amber transition-opacity',
                    active !== null && active !== index && 'opacity-45',
                  )}
                  style={{ height: `${height}%` }}
                />
                {active === index ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 w-max max-w-44 rounded-xl bg-ink-900 px-3 py-2 text-left text-cream-50 shadow-lift"
                    style={{ bottom: `calc(${Math.min(height, 70)}% + 12px)` }}
                  >
                    <span className="block text-sm font-bold tabular-nums">
                      {formatValue(value, metric)}
                    </span>
                    <span className="block text-xs text-cream-200">
                      Semana del {formatDate(week.weekStart, 'dayMonth')}
                      {isCurrent ? ' · en curso' : ''}
                    </span>
                    <span className="block text-xs text-cream-200">
                      {week.sessions} sesiones con registro
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {empty ? (
          <p className="absolute inset-0 left-11 grid place-items-center text-sm font-medium text-ink-500">
            Sin registros en este periodo
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex pl-11" aria-hidden>
        {weeks.map((week) => (
          <span
            key={week.week}
            className="flex-1 text-center text-[11px] leading-tight text-ink-500"
          >
            {formatDate(week.weekStart, 'short')}
            {week.week === currentWeek ? (
              <span className="block font-semibold text-ink-700">en curso</span>
            ) : null}
          </span>
        ))}
      </div>
      <VolumeTable weeks={weeks} currentWeek={currentWeek} />
    </figure>
  );
}

/** Vista en tabla: todos los valores, sin depender del color ni del ratón. */
export function VolumeTable({
  weeks,
  currentWeek,
}: {
  weeks: WeeklyVolume[];
  currentWeek: string;
}) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-sun-700 hover:text-ink-900">
        Ver datos en tabla
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left tabular-nums">
          <thead className="text-xs text-ink-500">
            <tr>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Semana
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Sesiones
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Series
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Rep.
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                Tonelaje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {weeks.map((week) => (
              <tr key={week.week}>
                <th scope="row" className="py-1.5 pr-3 font-medium text-ink-700">
                  {formatDate(week.weekStart, 'short')}
                  {week.week === currentWeek ? ' (en curso)' : ''}
                </th>
                <td className="py-1.5 pr-3 text-right">{week.sessions}</td>
                <td className="py-1.5 pr-3 text-right">{week.completedSets}</td>
                <td className="py-1.5 pr-3 text-right">{week.totalReps}</td>
                <td className="py-1.5 text-right">
                  {formatNumber(week.volumeLoadKg, 0)} kg
                  {week.setsWithoutExternalLoad > 0 ? (
                    <span className="block text-[11px] text-ink-500">
                      + {week.setsWithoutExternalLoad} series sin carga externa
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Gráfico de un único cliente con su selector de métrica encima. */
export function VolumePanel({
  weeks,
  currentWeek,
  options,
}: {
  weeks: WeeklyVolume[];
  currentWeek: string;
  options?: VolumeMetric[];
}) {
  const [metric, setMetric] = useState<VolumeMetric>(options?.[0] ?? 'completedSets');
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <MetricSwitch value={metric} onChange={setMetric} options={options} />
        <span className="text-xs text-ink-500">Cálculo · {METRICS[metric].formula}</span>
      </div>
      <WeeklyVolumeChart
        weeks={weeks}
        metric={metric}
        currentWeek={currentWeek}
        label={`${METRICS[metric].label} por semana`}
      />
    </div>
  );
}

/** Varios clientes: un único selector de métrica controla todos los gráficos. */
export function VolumeBoard({
  clients,
  currentWeek,
}: {
  clients: { id: string; name: string; initials: string; weeks: WeeklyVolume[] }[];
  currentWeek: string;
}) {
  const [metric, setMetric] = useState<VolumeMetric>('completedSets');
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <MetricSwitch value={metric} onChange={setMetric} />
        <span className="text-sm text-ink-500">Cálculo · {METRICS[metric].formula}</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {clients.map((client) => {
          const current = client.weeks.find((w) => w.week === currentWeek);
          const previous = client.weeks.at(-2);
          return (
            <section
              key={client.id}
              aria-labelledby={`volumen-${client.id}`}
              className="rounded-3xl border border-line/70 bg-white p-5 shadow-soft sm:p-6"
            >
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 id={`volumen-${client.id}`} className="text-lg font-bold text-ink-900">
                  {client.name}
                </h2>
                <p className="text-right text-sm text-ink-500">
                  Esta semana:{' '}
                  <strong className="text-ink-900 tabular-nums">
                    {formatValue(current?.[metric] ?? 0, metric)}
                  </strong>
                  {previous && previous.week !== currentWeek ? (
                    <span className="block text-xs">
                      Semana anterior: {formatValue(previous[metric], metric)}
                    </span>
                  ) : null}
                </p>
              </div>
              <WeeklyVolumeChart
                weeks={client.weeks}
                metric={metric}
                currentWeek={currentWeek}
                label={`${METRICS[metric].label} por semana de ${client.name}`}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
