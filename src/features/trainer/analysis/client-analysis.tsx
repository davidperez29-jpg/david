import { ArrowDownUp, Info } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { type ClientAnalysisVM, MAGNITUDE_PARAM_OF } from '@/contracts/analysis';
import {
  PERIOD_FORMULAS,
  type Period,
  type SessionRow,
  type WeekRow,
} from '@/domain/analysis/period';
import {
  ANALYSIS_FORMULAS,
  type Interval,
  assistanceMeanKg,
  type ExecutedVolume,
} from '@/domain/analysis/session';
import { EXERCISE_FORMULA } from '@/domain/analysis/exercise';
import { formatDate, formatNumber } from '@/domain/format';
import { EXECUTION_STATUS_LABELS, type ExecutionStatusV2 } from '@/domain/training/execution';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { cn } from '@/ui/cn';
import { Notice } from '@/ui/notice';
import {
  intervalText,
  minutesText,
  shortDateText,
  weekParts,
  weekRangeText,
} from './analysis-copy';
import {
  analysisState,
  executedValue,
  hrefWith,
  type MagnitudeInfo,
  MAGNITUDES,
  magnitudeInfo,
  periodText,
  plannedValue,
  REPEAT_DEFAULT,
  shiftPeriod,
  type UrlState,
} from './analysis-links';
import { WeeklyColumns, type WeeklyPoint } from './charts';
import { Field, fieldClass, PeriodFields, ScrollTable } from './analysis-form';
import { FilterSheet } from './filter-sheet';
import { FormulaBadge } from './formula-badge';

/**
 * A9 · Análisis del cliente por periodos (B3.2; docs/BLOCK3_SPEC.md §9.5). Componente de
 * servidor. Cada bloque dice su base de fecha: lo planificado, por fecha prevista; lo ejecutado,
 * por fecha de ejecución. Recuentos con su denominador; sin porcentajes, sin índices globales,
 * sin semáforos y sin interpretación.
 */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const num = (v: number, digits = 1) => formatNumber(v, digits);

const linkClass = 'text-ink-900 underline decoration-sun-400 underline-offset-2 hover:text-sun-800';

function Section({
  id,
  title,
  basis,
  children,
}: {
  id: string;
  title: string;
  basis?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-3xl bg-white p-5 shadow-soft">
      <h3 id={id} className="text-lg font-bold text-ink-900">
        {title}
      </h3>
      {basis ? <p className="mt-0.5 text-sm text-ink-500">{basis}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Segmented({
  label,
  items,
}: {
  label: string;
  items: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-cream-50 p-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href as Route}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold',
                item.active ? 'bg-sun-400 text-ink-900' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Campos ocultos: lo que el formulario no cambia se conserva. */
function Hidden({ state, omit }: { state: UrlState; omit: readonly string[] }) {
  return (
    <>
      {Object.entries(state)
        .filter(([key]) => !omit.includes(key))
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
    </>
  );
}

const FORM_FIELDS = ['periodo', 'fecha', 'desde', 'hasta', 'ejercicio', 'patron', 'patrones'];

function Filters({ vm, base, state }: { vm: ClientAnalysisVM; base: string; state: UrlState }) {
  const p = vm.analysis.period;
  const f = vm.filters;
  const parts = [periodText(p)];
  if (f.variantId) parts.push(vm.names.variants[f.variantId] ?? f.variantId);
  if (f.pattern) parts.push(vm.names.patterns[f.pattern] ?? f.pattern);
  return (
    <FilterSheet summary={parts.join(' · ')}>
      <form method="get" action={base} className="rounded-3xl bg-white p-4 shadow-soft md:p-5">
        <Hidden state={state} omit={FORM_FIELDS} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PeriodFields period={p} kind={state.periodo!} />
          <Field id="f-ejercicio" label="Ejercicio">
            <select
              id="f-ejercicio"
              name="ejercicio"
              defaultValue={f.variantId ?? ''}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {vm.options.exercises.map((o) => (
                <option key={o.variantId} value={o.variantId}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-patron" label="Patrón de movimiento">
            <select
              id="f-patron"
              name="patron"
              defaultValue={f.pattern ?? ''}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {vm.options.patterns.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-patrones" label="Patrones que cuentan">
            <select
              id="f-patrones"
              name="patrones"
              defaultValue={f.patternMode === 'all' ? 'todos' : ''}
              className={fieldClass}
            >
              <option value="">Solo el patrón principal</option>
              <option value="todos">Principal y secundarios</option>
            </select>
          </Field>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-2xl bg-ink-900 px-5 text-sm font-bold text-cream-50 hover:bg-ink-700"
            >
              Aplicar
            </button>
            {f.variantId || f.pattern ? (
              <Link
                href={hrefWith(base, state, { ejercicio: null, patron: null }) as Route}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-sun-800 hover:text-ink-900"
              >
                Quitar filtros
              </Link>
            ) : null}
          </div>
        </div>
      </form>
    </FilterSheet>
  );
}

function Header({ vm, base, state }: { vm: ClientAnalysisVM; base: string; state: UrlState }) {
  const p = vm.analysis.period;
  const f = vm.filters;
  return (
    <header className="rounded-3xl bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-sun-800">Análisis por periodos</p>
      <h2 className="mt-1 text-2xl font-extrabold text-ink-900">{periodText(p)}</h2>
      {f.variantId || f.pattern ? (
        <p className="mt-1 text-sm text-ink-700">
          Solo{' '}
          {[
            f.variantId ? `«${vm.names.variants[f.variantId] ?? f.variantId}»` : null,
            f.pattern
              ? `ejercicios con el patrón «${vm.names.patterns[f.pattern] ?? f.pattern}»${f.patternMode === 'all' ? ' (principal o secundario)' : ' como principal'}`
              : null,
          ]
            .filter(Boolean)
            .join(' y ')}
          . Las sesiones sin esos ejercicios se cuentan como previstas o hechas, sin series.
        </p>
      ) : null}
      <nav aria-label="Otros periodos" className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
        <Link
          href={hrefWith(base, state, shiftPeriod(p, p.previous)) as Route}
          className="inline-flex min-h-10 items-center text-sun-800 hover:text-ink-900"
        >
          ← Periodo anterior
        </Link>
        <Link
          href={hrefWith(base, state, shiftPeriod(p, p.next)) as Route}
          className="inline-flex min-h-10 items-center text-sun-800 hover:text-ink-900"
        >
          Periodo siguiente →
        </Link>
      </nav>
      <div className="mt-3">
        <Segmented
          label="Prescripción con la que se compara"
          items={[
            {
              key: 'original',
              label: 'Prescripción original',
              href: hrefWith(base, state, { referencia: null }),
              active: vm.perspective === 'original',
            },
            {
              key: 'current',
              label: 'Prescripción vigente',
              href: hrefWith(base, state, { referencia: 'vigente' }),
              active: vm.perspective === 'current',
            },
          ]}
        />
      </div>
      <p className="mt-2 text-sm text-ink-700">
        {vm.perspective === 'original'
          ? 'Original: cada serie frente a la versión con la que se registró; lo planificado, con la fecha prevista original.'
          : 'Vigente: cada serie frente a la prescripción actual; lo planificado, con la fecha prevista vigente.'}
      </p>
    </header>
  );
}

const STATUS_ORDER: readonly ExecutionStatusV2[] = [
  'completed',
  'partial',
  'interrupted',
  'paused',
  'in_progress',
  'overdue',
  'planned',
];

function ExecutedTotals({ v }: { v: ExecutedVolume }) {
  const sets = v.sets.reps + v.sets.seconds + v.sets.meters;
  const mean = assistanceMeanKg(v.assistance);
  const rows: {
    term: string;
    value: string;
    formula: (typeof ANALYSIS_FORMULAS)[keyof typeof ANALYSIS_FORMULAS];
  }[] = [
    { term: 'Series hechas', value: String(sets), formula: ANALYSIS_FORMULAS.completedSets },
    {
      term: 'Repeticiones',
      value:
        v.reps === null
          ? 'no aplica'
          : `${num(v.reps, 0)}${v.repsPerSide !== null ? ` + ${num(v.repsPerSide, 0)} «por lado»` : ''}`,
      formula: ANALYSIS_FORMULAS.totalReps,
    },
    {
      term: 'Tiempo',
      value: v.seconds === null ? 'no aplica' : `${num(v.seconds, 0)} s`,
      formula: ANALYSIS_FORMULAS.durationTotal,
    },
    {
      term: 'Distancia',
      value: v.meters === null ? 'no aplica' : `${num(v.meters)} m`,
      formula: ANALYSIS_FORMULAS.distanceTotal,
    },
    {
      term: 'Tonelaje (nominal)',
      value:
        v.tonnageKg === null
          ? 'no aplica'
          : `${num(v.tonnageKg)} kg en ${plural(v.tonnageSets, 'serie', 'series')}`,
      formula: ANALYSIS_FORMULAS.volumeLoad,
    },
    {
      term: 'Lastre (aparte)',
      value:
        v.addedLoad.kg === null
          ? 'no aplica'
          : `${num(v.addedLoad.kg)} kg en ${plural(v.addedLoad.sets, 'serie', 'series')}`,
      formula: ANALYSIS_FORMULAS.addedLoadVolume,
    },
    {
      term: 'Asistencia (aparte)',
      value:
        v.assistance.sets === 0
          ? 'no aplica'
          : `${plural(v.assistance.sets, 'serie asistida', 'series asistidas')}${mean !== null ? `, media ponderada ${num(mean, 2)} kg` : ', sin los kg anotados'}${v.assistance.noData > 0 ? ` (${v.assistance.noData} sin dato)` : ''}`,
      formula: ANALYSIS_FORMULAS.assistanceSummary,
    },
  ];
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-1 py-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm font-semibold text-ink-500">{r.term}</dt>
          <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-900">
            <span>{r.value}</span>
            <FormulaBadge formula={r.formula} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Summary({
  vm,
  sessionHref,
}: {
  vm: ClientAnalysisVM;
  sessionHref: (id: string) => string;
}) {
  const a = vm.analysis;
  const executedSessions = a.weeks.reduce((n, w) => n + w.executed.sessions, 0);
  const d = a.duration;
  const mean = (x: { sessions: number; seconds: number }) =>
    x.sessions > 0 ? minutesText(x.seconds / x.sessions) : null;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Section id="resumen" title="Resumen del periodo" basis="Por fecha prevista.">
          <p className="text-sm text-ink-900">
            <span className="text-2xl font-extrabold">{a.adherence.planned}</span>{' '}
            {a.adherence.planned === 1 ? 'sesión prevista' : 'sesiones previstas'} en el periodo.
          </p>
          {a.adherence.planned > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              {STATUS_ORDER.filter((s) => a.adherence.byStatus[s] > 0).map((s) => (
                <li key={s}>
                  {EXECUTION_STATUS_LABELS[s]}: {a.adherence.byStatus[s]} de {a.adherence.planned}
                </li>
              ))}
              {a.adherence.executedOtherDay > 0 ? (
                <li>
                  Hechas otro día que el previsto: {a.adherence.executedOtherDay} de{' '}
                  {a.adherence.planned}
                </li>
              ) : null}
            </ul>
          ) : null}
          {a.undeterminedPlanning.length > 0 ? (
            <div className="mt-3 text-sm text-ink-700">
              <p className="font-semibold text-ink-900">
                Fecha prevista original no determinada ({a.undeterminedPlanning.length}): no se
                cuentan como previstas en ninguna semana.
              </p>
              <ul className="mt-1 list-disc pl-5">
                {a.undeterminedPlanning.map((s) => (
                  <li key={s.sessionId}>
                    <Link href={sessionHref(s.sessionId) as Route} className={linkClass}>
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <FormulaBadge formula={PERIOD_FORMULAS.adherence} />
          </div>
        </Section>
        <Missing vm={vm} />
      </div>

      <Section id="ejecutado" title="Lo ejecutado en el periodo" basis="Por fecha de ejecución.">
        <p className="text-sm text-ink-900">
          <span className="text-2xl font-extrabold">{executedSessions}</span>{' '}
          {executedSessions === 1 ? 'sesión empezada' : 'sesiones empezadas'}.
        </p>
        <ExecutedTotals v={a.executedTotals} />
        <div className="mt-3 border-t border-line pt-3 text-sm text-ink-700">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900">Duración calculada</p>
            <FormulaBadge formula={PERIOD_FORMULAS.durationTotals} />
          </div>
          {d.all.sessions === 0 ? (
            <p className="mt-1">Ninguna sesión con la duración calculada.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              <li>
                Todas: {minutesText(d.all.seconds)} en{' '}
                {plural(d.all.sessions, 'sesión', 'sesiones')} (media {mean(d.all)}).
              </li>
              <li>
                Sin las {d.warned} con advertencia:{' '}
                {d.withoutWarned.sessions > 0
                  ? `${minutesText(d.withoutWarned.seconds)} en ${plural(d.withoutWarned.sessions, 'sesión', 'sesiones')} (media ${mean(d.withoutWarned)}).`
                  : 'ninguna sesión.'}
              </li>
              {d.notices > 0 ? (
                <li>Con avisos (se cuentan en las dos cifras): {d.notices}.</li>
              ) : null}
            </ul>
          )}
          {d.without.unfinished + d.without.incoherent + d.without.notCalculable > 0 ? (
            <p className="mt-1 text-ink-500">
              Aparte, sin duración calculada:{' '}
              {[
                d.without.unfinished ? `${d.without.unfinished} sin terminar` : null,
                d.without.incoherent ? `${d.without.incoherent} con horas incoherentes` : null,
                d.without.notCalculable ? `${d.without.notCalculable} no calculables` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              .
            </p>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function Missing({ vm }: { vm: ClientAnalysisVM }) {
  const m = vm.analysis.missing;
  const items = [
    m.unfinished ? plural(m.unfinished, 'sesión sin terminar', 'sesiones sin terminar') : null,
    m.unregisteredSets
      ? plural(m.unregisteredSets, 'serie sin registrar', 'series sin registrar')
      : null,
    m.notDoneSets ? plural(m.notDoneSets, 'serie no realizada', 'series no realizadas') : null,
    m.effortNoData ? `${plural(m.effortNoData, 'valor', 'valores')} de esfuerzo sin dato` : null,
    m.loadNoData
      ? plural(m.loadNoData, 'serie con la carga sin dato', 'series con la carga sin dato')
      : null,
    m.notComparable
      ? `${plural(m.notComparable, 'comparación', 'comparaciones')} no comparables`
      : null,
    m.notEvaluable
      ? `${plural(m.notEvaluable, 'comparación', 'comparaciones')} no evaluables`
      : null,
    m.referenceUndetermined
      ? plural(
          m.referenceUndetermined,
          'sesión con la referencia histórica no determinada',
          'sesiones con la referencia histórica no determinada',
        )
      : null,
    m.adjustedTimes
      ? plural(m.adjustedTimes, 'sesión con horas ajustadas', 'sesiones con horas ajustadas')
      : null,
    m.outsideReference
      ? plural(
          m.outsideReference,
          'serie fuera de la versión vigente',
          'series fuera de la versión vigente',
        )
      : null,
    vm.analysis.duration.warned
      ? plural(
          vm.analysis.duration.warned,
          'sesión con advertencia en la duración',
          'sesiones con advertencia en la duración',
        )
      : null,
  ].filter((x): x is string => x !== null);
  return (
    <Section
      id="ausentes"
      title="Datos ausentes y advertencias"
      basis="De las sesiones del periodo."
    >
      {items.length === 0 ? (
        <p className="text-sm text-ink-700">Ninguno.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {m.proposal.done > 0 ? (
        <p className="mt-2 text-sm text-ink-500">
          {m.proposal.equal} de {m.proposal.done} series hechas tienen todos sus valores iguales a
          los propuestos: pueden haberse aceptado sin revisarlos.
        </p>
      ) : null}
    </Section>
  );
}

/**
 * Lo prescrito de una semana. Si alguna sesión tiene series sin referencia determinada (en la
 * perspectiva original, por ejemplo, las que aún no han llegado a su día), la cifra está
 * incompleta: se dice y no se dibuja en el gráfico.
 */
function plannedCell(
  w: WeekRow,
  info: MagnitudeInfo,
  perspective: ClientAnalysisVM['perspective'],
): { text: string; note: string | null; chart: Interval | null } {
  const v = w.planned.volume;
  if (w.planned.sessions === 0) return { text: `0 ${info.unit}`, note: null, chart: null };
  const value = plannedValue(v, info.key);
  const sets = v.sets.reps + v.sets.seconds + v.sets.meters;
  const unknown = v.unknownSessions;
  const text =
    unknown === w.planned.sessions && sets === 0
      ? 'no determinado'
      : (intervalText(value, info.unit, info.digits) ?? 'no aplica');
  if (unknown === 0) return { text, note: null, chart: value };
  return {
    text,
    note: `incompleto: ${plural(unknown, 'sesión', 'sesiones')} con series sin referencia determinada${perspective === 'original' ? ' (con la prescripción vigente se ven)' : ''}`,
    chart: null,
  };
}

const valueText = (v: number | null, unit: string, digits: number) =>
  v === null ? 'no aplica' : `${num(v, digits)} ${unit}`;

function WeekCell({ week, period }: { week: WeekRow['week']; period: Period }) {
  const { year, week: n } = weekParts(week.key);
  const partial = week.start < period.from || week.end > period.to;
  return (
    <>
      <span className="block font-semibold text-ink-900">
        Semana {n} de {year}
      </span>
      <span className="block text-xs font-normal text-ink-500">{weekRangeText(week)}</span>
      {partial ? (
        <span className="block text-xs font-normal text-ink-500">
          Solo del {shortDateText(week.start < period.from ? period.from : week.start)} al{' '}
          {shortDateText(week.end > period.to ? period.to : week.end)}
        </span>
      ) : null}
    </>
  );
}

function Moves({ w, sessionHref }: { w: WeekRow; sessionHref: (id: string) => string }) {
  const out = w.planned.movedOut;
  const inn = w.executed.movedIn;
  if (out.length === 0 && inn.length === 0) return <>—</>;
  return (
    <ul className="space-y-1">
      {out.map((m) => (
        <li key={`o-${m.sessionId}`}>
          <Link href={sessionHref(m.sessionId) as Route} className={linkClass}>
            {m.title}
          </Link>
          : prevista aquí, hecha el {formatDate(m.executedOn, 'long')} (semana{' '}
          {weekParts(m.executedWeek).week})
        </li>
      ))}
      {inn.map((m) => (
        <li key={`i-${m.sessionId}`}>
          <Link href={sessionHref(m.sessionId) as Route} className={linkClass}>
            {m.title}
          </Link>
          : hecha aquí,{' '}
          {m.plannedOn
            ? `prevista el ${formatDate(m.plannedOn, 'long')} (semana ${weekParts(m.plannedWeek!).week})`
            : 'fecha prevista original no determinada'}
        </li>
      ))}
    </ul>
  );
}

function Weekly({
  vm,
  base,
  state,
  sessionHref,
}: {
  vm: ClientAnalysisVM;
  base: string;
  state: UrlState;
  sessionHref: (id: string) => string;
}) {
  const a = vm.analysis;
  const info = magnitudeInfo(vm.filters.magnitude);
  const points: WeeklyPoint[] = a.weeks.map((w) => {
    const executed = w.executed.sessions === 0 ? 0 : executedValue(w.executed.volume, info.key);
    const planned = plannedCell(w, info, vm.perspective);
    const { week: n } = weekParts(w.week.key);
    return {
      key: w.week.key,
      axisLabel: `S${n}`,
      label: `Semana ${n} · ${weekRangeText(w.week)}`,
      executed: executed ?? 0,
      planned: planned.chart,
      detail: `registrado ${valueText(executed, info.unit, info.digits)} en ${plural(w.executed.sessions, 'sesión', 'sesiones')}; prescrito ${w.planned.sessions === 0 ? 'ninguna sesión prevista' : `${planned.text}${planned.note ? ` (${planned.note})` : ''}`}`,
    };
  });
  return (
    <Section
      id="volumen"
      title="Volumen por semana"
      basis="Registrado, por fecha de ejecución; prescrito, por fecha prevista. Nunca se suman entre sí."
    >
      <Segmented
        label="Magnitud"
        items={MAGNITUDES.map((m) => ({
          key: m.key,
          label: m.label,
          href: hrefWith(
            base,
            state,
            { magnitud: m.key === 'sets' ? null : MAGNITUDE_PARAM_OF[m.key] },
            'volumen',
          ),
          active: m.key === info.key,
        }))}
      />
      <div className="mt-4">
        <WeeklyColumns
          points={points}
          unit={info.unit}
          title={`${info.label} por semana (${info.unit})`}
        />
      </div>
      <ScrollTable label="Tabla semana a semana" className="mt-4">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">
            Semana a semana: sesiones previstas y prescrito, sesiones empezadas y registrado, y
            traslados
          </caption>
          <thead>
            <tr className="border-b border-line text-ink-500">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Semana (ISO)
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Previstas
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Prescrito
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Empezadas
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Registrado
              </th>
              <th scope="col" className="py-2 font-semibold">
                Traslados
              </th>
            </tr>
          </thead>
          <tbody>
            {a.weeks.map((w) => {
              const planned = plannedCell(w, info, vm.perspective);
              const executed = executedValue(w.executed.volume, info.key);
              return (
                <tr
                  key={w.week.key}
                  className="border-b border-line/60 align-top"
                  data-week={w.week.key}
                >
                  <th scope="row" className="py-2 pr-3 font-normal">
                    <WeekCell week={w.week} period={a.period} />
                  </th>
                  <td className="py-2 pr-3 tabular-nums">{w.planned.sessions}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {planned.text}
                    {planned.note ? (
                      <span className="block text-xs text-ink-500">{planned.note}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{w.executed.sessions}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {w.executed.sessions === 0
                      ? `0 ${info.unit}`
                      : valueText(executed, info.unit, info.digits)}
                  </td>
                  <td className="py-2 text-ink-700">
                    <Moves w={w} sessionHref={sessionHref} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollTable>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <FormulaBadge formula={PERIOD_FORMULAS.weeklyExecuted} />
        <FormulaBadge formula={PERIOD_FORMULAS.weeklyPlanned} />
        <FormulaBadge formula={info.executed} />
        {info.planned.id !== info.executed.id ? <FormulaBadge formula={info.planned} /> : null}
      </div>
      <p className="mt-2 text-sm text-ink-500">
        Las semanas sin sesiones aparecen con cero. Una sesión hecha otro día cuenta como prevista
        en su semana prevista y como hecha en la de ejecución.
      </p>
    </Section>
  );
}

/** «8 de 14»; sin referencia y sin registros, las series no se pueden enumerar. */
const setsText = (r: SessionRow) =>
  r.totalSets === 0 && r.referenceUndetermined
    ? 'no determinadas'
    : `${r.doneSets} de ${r.totalSets}`;

function durationText(d: SessionRow['duration']): string {
  if (d.kind === 'calculated') {
    return `${minutesText(d.seconds)}${d.warned ? ' · con advertencia' : d.notices > 0 ? ' · con aviso' : ''}`;
  }
  return {
    not_started: 'sin empezar',
    unfinished: 'sin terminar',
    incoherent: 'horas incoherentes',
    not_calculable: 'no calculable',
  }[d.reason];
}

function Sessions({
  vm,
  base,
  state,
  sessionHref,
}: {
  vm: ClientAnalysisVM;
  base: string;
  state: UrlState;
  sessionHref: (id: string) => string;
}) {
  const asc = vm.filters.sort === 'asc';
  const date = (r: SessionRow) => r.executedOn ?? r.plannedOn ?? '';
  const rows = [...vm.analysis.sessions].sort(
    (a, b) =>
      (asc ? 1 : -1) * (date(a).localeCompare(date(b)) || a.sessionId.localeCompare(b.sessionId)),
  );
  const notes = (r: SessionRow) =>
    [
      r.moved ? 'trasladada' : null,
      r.referenceUndetermined ? 'referencia histórica no determinada' : null,
    ].filter(Boolean);
  return (
    <Section
      id="sesiones"
      title="Sesiones del periodo"
      basis="Previstas o empezadas en el periodo. Se ordenan por fecha (la de ejecución o, si no se empezó, la prevista)."
    >
      <Link
        href={hrefWith(base, state, { orden: asc ? null : 'asc' }, 'sesiones') as Route}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-sun-800 hover:text-ink-900"
      >
        <ArrowDownUp aria-hidden className="size-4" />
        {asc ? 'Más recientes primero' : 'Más antiguas primero'}
      </Link>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-700">
          Ninguna sesión prevista ni empezada en el periodo.
        </p>
      ) : (
        <>
          <ScrollTable label="Tabla de sesiones del periodo" className="mt-2 hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Sesiones del periodo, ordenadas por fecha {asc ? 'ascendente' : 'descendente'}
              </caption>
              <thead>
                <tr className="border-b border-line text-ink-500">
                  <th
                    scope="col"
                    className="py-2 pr-3 font-semibold"
                    aria-sort={asc ? 'ascending' : 'descending'}
                  >
                    Sesión
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Prevista
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Realizada
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Series hechas
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Repeticiones
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Tonelaje
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Lastre
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Duración calculada
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sessionId} className="border-b border-line/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      <Link href={sessionHref(r.sessionId) as Route} className={linkClass}>
                        {r.label ? `${r.label} · ` : ''}
                        {r.title}
                      </Link>
                      <span className="mt-1 block">
                        <ExecutionStatusBadge status={r.status} />
                      </span>
                      {notes(r).length > 0 ? (
                        <span className="block text-xs font-normal text-ink-500">
                          {notes(r).join(' · ')}
                        </span>
                      ) : null}
                    </th>
                    <td className="py-2 pr-3">
                      {r.plannedOn ? formatDate(r.plannedOn, 'long') : 'no determinada'}
                    </td>
                    <td className="py-2 pr-3">
                      {r.executedOn ? formatDate(r.executedOn, 'long') : '—'}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{setsText(r)}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.reps === null ? 'no aplica' : num(r.reps, 0)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.tonnageKg === null ? 'no aplica' : `${num(r.tonnageKg)} kg`}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.addedLoadKg === null ? 'no aplica' : `${num(r.addedLoadKg)} kg`}
                    </td>
                    <td className="py-2">{durationText(r.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <ol className="mt-2 space-y-2 md:hidden" aria-label="Sesiones del periodo">
            {rows.map((r) => (
              <li key={r.sessionId} className="rounded-2xl bg-cream-50 p-3 text-sm">
                <Link
                  href={sessionHref(r.sessionId) as Route}
                  className={cn(linkClass, 'font-semibold')}
                >
                  {r.label ? `${r.label} · ` : ''}
                  {r.title}
                </Link>
                <span className="mt-1 block">
                  <ExecutionStatusBadge status={r.status} />
                </span>
                <dl className="mt-2 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
                  <dt className="text-ink-500">Prevista</dt>
                  <dd>{r.plannedOn ? formatDate(r.plannedOn, 'long') : 'no determinada'}</dd>
                  <dt className="text-ink-500">Realizada</dt>
                  <dd>{r.executedOn ? formatDate(r.executedOn, 'long') : '—'}</dd>
                  <dt className="text-ink-500">Series hechas</dt>
                  <dd>{setsText(r)}</dd>
                  <dt className="text-ink-500">Tonelaje</dt>
                  <dd>{r.tonnageKg === null ? 'no aplica' : `${num(r.tonnageKg)} kg`}</dd>
                  <dt className="text-ink-500">Duración</dt>
                  <dd>{durationText(r.duration)}</dd>
                </dl>
                {notes(r).length > 0 ? (
                  <p className="mt-1 text-xs text-ink-500">{notes(r).join(' · ')}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}

const BAR = '#b38600';

function Patterns({ vm, base, state }: { vm: ClientAnalysisVM; base: string; state: UrlState }) {
  const p = vm.analysis.patterns;
  const all = vm.filters.patternMode === 'all';
  const shown = all ? p.all : p.primary;
  const primary = new Map(p.primary.map((x) => [x.patternId, x.sets]));
  const any = new Map(p.all.map((x) => [x.patternId, x.sets]));
  const ids = [...new Set([...any.keys()])].sort(
    (a, b) => (any.get(b) ?? 0) - (any.get(a) ?? 0) || a.localeCompare(b),
  );
  const max = Math.max(1, ...shown.map((x) => x.sets));
  const name = (id: string) => vm.names.patterns[id] ?? id;
  return (
    <Section
      id="patrones"
      title="Series hechas por patrón de movimiento"
      basis="Por fecha de ejecución. Patrones de la biblioteca de ejercicios."
    >
      <Segmented
        label="Patrones que cuentan"
        items={[
          {
            key: 'primary',
            label: 'Solo el principal',
            href: hrefWith(base, state, { patrones: null }, 'patrones'),
            active: !all,
          },
          {
            key: 'all',
            label: 'Principal y secundarios',
            href: hrefWith(base, state, { patrones: 'todos' }, 'patrones'),
            active: all,
          },
        ]}
      />
      {p.doneSets === 0 ? (
        <p className="mt-3 text-sm text-ink-700">Ninguna serie hecha en el periodo.</p>
      ) : (
        <>
          <figure className="mt-4" aria-labelledby="patrones-fig">
            <figcaption id="patrones-fig" className="text-sm font-semibold text-ink-900">
              Series hechas por patrón ({all ? 'principal y secundarios' : 'solo el principal'})
            </figcaption>
            <ul className="mt-2 space-y-2" aria-hidden>
              {shown.map((x) => (
                <li
                  key={x.patternId}
                  className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.5rem] sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3rem] items-center gap-2 text-sm"
                >
                  <span className="truncate text-ink-700">{name(x.patternId)}</span>
                  <span className="h-4">
                    <span
                      className="block h-4 rounded-r-[4px]"
                      style={{ width: `${(x.sets / max) * 100}%`, background: BAR }}
                    />
                  </span>
                  <span className="text-right text-ink-900 tabular-nums">{x.sets}</span>
                </li>
              ))}
            </ul>
          </figure>
          <ScrollTable label="Tabla de series por patrón" className="mt-4">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Series hechas por patrón, con los dos recuentos</caption>
              <thead>
                <tr className="border-b border-line text-ink-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Patrón
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Como principal
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Principal o secundario
                  </th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id) => (
                  <tr key={id} className="border-b border-line/60" data-pattern={id}>
                    <th scope="row" className="py-2 pr-3 font-semibold text-ink-900">
                      {name(id)}
                    </th>
                    <td className="py-2 pr-3 tabular-nums">{primary.get(id) ?? 0}</td>
                    <td className="py-2 tabular-nums">{any.get(id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <p className="mt-2 text-sm text-ink-500">
            De {plural(p.doneSets, 'serie hecha', 'series hechas')}
            {p.unknown > 0 ? `; ${p.unknown} de ejercicios sin patrón en la biblioteca` : ''}. Con
            los secundarios, una serie cuenta en cada uno de sus patrones: la suma puede superar el
            total.
          </p>
        </>
      )}
      <div className="mt-3">
        <FormulaBadge formula={PERIOD_FORMULAS.patterns} />
      </div>
    </Section>
  );
}

function Exercises({
  vm,
  exerciseHref,
}: {
  vm: ClientAnalysisVM;
  exerciseHref: (variantId: string) => string;
}) {
  const list = [...vm.analysis.exercises].sort((a, b) =>
    (vm.names.variants[a.variantId] ?? '').localeCompare(
      vm.names.variants[b.variantId] ?? '',
      'es',
    ),
  );
  return (
    <Section
      id="ejercicios"
      title="Ejercicios"
      basis="Con series hechas en el periodo, por fecha de ejecución."
    >
      {list.length === 0 ? (
        <p className="text-sm text-ink-700">Ninguno.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((e) => (
            <li
              key={e.variantId}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
            >
              <Link
                href={exerciseHref(e.variantId) as Route}
                className={cn(linkClass, 'font-semibold')}
              >
                {vm.names.variants[e.variantId] ?? e.variantId}
              </Link>
              <span className="text-sm text-ink-500">
                {plural(e.sessions, 'sesión', 'sesiones')} ·{' '}
                {plural(e.doneSets, 'serie hecha', 'series hechas')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FormulaBadge formula={EXERCISE_FORMULA} />
      </div>
    </Section>
  );
}

function Repeated({ vm, base, state }: { vm: ClientAnalysisVM; base: string; state: UrlState }) {
  const { n, m } = vm.filters.repeat;
  const list = [...vm.analysis.repeated].sort((a, b) =>
    (vm.names.variants[a.variantId] ?? '').localeCompare(
      vm.names.variants[b.variantId] ?? '',
      'es',
    ),
  );
  return (
    <Section
      id="repetidas"
      title="Diferencias repetidas"
      basis={`Ejercicios con series fuera de la condición prescrita en ${n} o más de sus últimas ${m} sesiones del periodo. Es una lista descriptiva, no una alerta.`}
    >
      <form method="get" action={`${base}#repetidas`} className="flex flex-wrap items-end gap-3">
        <Hidden state={state} omit={['n', 'm']} />
        <Field id="f-n" label="N (sesiones con diferencias)">
          <input
            id="f-n"
            type="number"
            name="n"
            min={1}
            max={20}
            defaultValue={n}
            className={cn(fieldClass, 'w-28')}
          />
        </Field>
        <Field id="f-m" label="M (últimas sesiones)">
          <input
            id="f-m"
            type="number"
            name="m"
            min={1}
            max={20}
            defaultValue={m}
            className={cn(fieldClass, 'w-28')}
          />
        </Field>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-2xl border border-line bg-white px-4 text-sm font-semibold text-ink-900 hover:border-ink-300"
        >
          Actualizar
        </button>
        {n !== REPEAT_DEFAULT.n || m !== REPEAT_DEFAULT.m ? (
          <span className="pb-3 text-xs text-ink-500">
            Por defecto, {REPEAT_DEFAULT.n} de {REPEAT_DEFAULT.m}. No se guarda.
          </span>
        ) : null}
      </form>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700">
          Ningún ejercicio con series fuera de la condición prescrita en {n} o más de sus últimas{' '}
          {m} sesiones.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-ink-900">
          {list.map((r) => (
            <li key={r.variantId}>
              <span className="font-semibold">{vm.names.variants[r.variantId] ?? r.variantId}</span>
              : en {r.outside} de sus últimas {plural(r.considered, 'sesión', 'sesiones')} con
              series hechas.
              <span className="block text-ink-500">
                Cantidad en {r.dimensions.quantity} · carga en {r.dimensions.load} · esfuerzo en{' '}
                {r.dimensions.effort}.
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FormulaBadge formula={PERIOD_FORMULAS.repeated} />
      </div>
    </Section>
  );
}

export function ClientAnalysisView({
  vm,
  base,
  sessionHref,
  exerciseHref,
}: {
  vm: ClientAnalysisVM;
  /** Ruta de A9 (sin parámetros). */
  base: string;
  /** A8 de una sesión, con la perspectiva elegida. */
  sessionHref: (sessionId: string) => string;
  /** A10 de un ejercicio, con el mismo periodo y perspectiva. */
  exerciseHref: (variantId: string) => string;
}) {
  const state = analysisState({
    period: vm.analysis.period,
    perspective: vm.perspective,
    today: vm.today,
    filters: vm.filters,
  });
  return (
    <div className="space-y-5">
      {vm.invalidPeriod ? (
        <Notice tone="sun" title="Periodo no válido">
          El periodo pedido no es válido (una fecha imposible, un rango invertido o de más de 53
          semanas). Se muestran las 4 semanas hasta hoy.
        </Notice>
      ) : null}
      <Header vm={vm} base={base} state={state} />
      <Filters vm={vm} base={base} state={state} />
      <Summary vm={vm} sessionHref={sessionHref} />
      <Weekly vm={vm} base={base} state={state} sessionHref={sessionHref} />
      <Sessions vm={vm} base={base} state={state} sessionHref={sessionHref} />
      <Patterns vm={vm} base={base} state={state} />
      <Exercises vm={vm} exerciseHref={exerciseHref} />
      <Repeated vm={vm} base={base} state={state} />
      <Notice tone="cream" title="Carga interna: pendiente (B3.3)">
        El esfuerzo percibido de la sesión y la carga interna no se muestran todavía. Ninguna cifra
        de esta página usa un esfuerzo de sesión.
      </Notice>
      <section
        aria-labelledby="concluir"
        className="rounded-3xl border border-sun-300 bg-sun-100 p-5"
      >
        <h3 id="concluir" className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Info aria-hidden className="size-5" /> Qué se puede concluir y qué no
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>
            Lo planificado va por fecha prevista y lo ejecutado por fecha de ejecución: las dos
            cifras de una semana no se suman ni se restan.
          </li>
          <li>
            Son recuentos con su denominador: no hay un porcentaje ni un índice global de
            cumplimiento.
          </li>
          <li>
            «Serie hecha» confirma el registro, no una medición de cada valor. Los valores se
            proponen con lo prescrito; el tonelaje es nominal (kg declarados).
          </li>
          <li>El RIR y el RPE son estimaciones de la propia persona, con error.</li>
          <li>
            Las diferencias repetidas describen lo registrado: no indican fatiga, adaptación ni la
            causa, y no recomiendan cambios. La interpretación es tuya.
          </li>
        </ul>
      </section>
    </div>
  );
}
