import { ArrowLeft, Info } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { type ExerciseEvolutionVM } from '@/contracts/analysis';
import { EXERCISE_FORMULA, type EvolutionSegment } from '@/domain/analysis/exercise';
import { formatDate, formatNumber } from '@/domain/format';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { cn } from '@/ui/cn';
import { Notice } from '@/ui/notice';
import { SET_STATUS_LABEL, shortDateText } from './analysis-copy';
import { hrefWith, periodState, periodText, shiftPeriod } from './analysis-links';
import { type DotSession, SetLoadDots } from './charts';
import { PeriodFields, ScrollTable } from './analysis-form';
import { FilterSheet } from './filter-sheet';
import { FormulaBadge } from './formula-badge';
import { conditionsOf, differencesOf, setVersion } from './session-analysis';

/**
 * A10 · Evolución de un ejercicio (B3.2; docs/BLOCK3_SPEC.md §9.6). Sesión a sesión, en orden
 * de ejecución, las series de la variante: lo prescrito, lo registrado, la diferencia y su
 * condición, y la versión. Solo dentro de la misma modalidad: si cambia, se corta en otro tramo.
 * Sin estimación del 1RM, sin tendencias ni predicciones.
 */
const linkClass = 'text-ink-900 underline decoration-sun-400 underline-offset-2 hover:text-sun-800';

function dotsOf(segment: EvolutionSegment): DotSession[] {
  return segment.sessions
    .map((s) => ({
      key: s.sessionId,
      label: shortDateText(s.executedOn).replace(/ \d{4}$/, ''),
      sets: s.sets
        .filter(
          (x) => x.status === 'done' && x.recorded?.kg !== null && x.recorded?.kg !== undefined,
        )
        .map((x) => ({
          setNumber: x.setNumber,
          kg: x.recorded!.kg!,
          detail: `${x.performed ?? ''}${x.prescribed ? ` (prescrito: ${x.prescribed})` : ''}`,
        })),
    }))
    .filter((s) => s.sets.length > 0);
}

function Segment({
  segment,
  index,
  total,
  name,
  sessionHref,
}: {
  segment: EvolutionSegment;
  index: number;
  total: number;
  name: string;
  sessionHref: (id: string) => string;
}) {
  const id = `tramo-${index + 1}`;
  const dots = dotsOf(segment);
  return (
    <section aria-labelledby={id} className="rounded-3xl bg-white p-5 shadow-soft">
      <h3 id={id} className="text-lg font-bold text-ink-900 first-letter:uppercase">
        {total > 1 ? `Tramo ${index + 1} de ${total} · ` : ''}
        {segment.modality
          ? segment.modality.text
          : 'Modalidades distintas dentro de la misma sesión'}
      </h3>
      <p className="mt-0.5 text-sm text-ink-500">
        {segment.sessions.length === 1 ? '1 sesión' : `${segment.sessions.length} sesiones`} · del{' '}
        {formatDate(segment.sessions[0]!.executedOn, 'long')} al{' '}
        {formatDate(segment.sessions.at(-1)!.executedOn, 'long')} (fecha de ejecución)
      </p>
      {dots.length > 0 ? (
        <div className="mt-4">
          <SetLoadDots sessions={dots} title={`kg registrados de cada serie hecha · ${name}`} />
        </div>
      ) : null}
      <ScrollTable label={`Tabla de series de ${name}`} className="mt-4">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">
            Sesión a sesión: series de {name}, prescrito, registrado, diferencia y condición
          </caption>
          <thead>
            <tr className="border-b border-line text-ink-500">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Sesión
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Serie
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Versión
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Prescrito
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Registrado
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Diferencia
              </th>
              <th scope="col" className="py-2 font-semibold">
                Condición
              </th>
            </tr>
          </thead>
          {segment.sessions.map((s) => (
            <tbody key={s.sessionId} className="border-b border-line">
              {s.sets.map((x, i) => (
                <tr key={`${x.prescriptionId}#${x.setNumber}`} className="align-top">
                  {i === 0 ? (
                    <th
                      scope="rowgroup"
                      rowSpan={s.sets.length}
                      className="py-2 pr-3 font-semibold"
                    >
                      <Link href={sessionHref(s.sessionId) as Route} className={linkClass}>
                        {formatDate(s.executedOn, 'long')}
                      </Link>
                      <span className="block text-xs font-normal text-ink-500">
                        {s.label ? `${s.label} · ` : ''}
                        {s.title}
                      </span>
                      <span className="block text-xs font-normal text-ink-500">
                        {s.doneSets} de {s.plannedSets} series hechas
                      </span>
                      <span className="mt-1 block">
                        <ExecutionStatusBadge status={s.status} />
                      </span>
                    </th>
                  ) : null}
                  <td className="py-2 pr-3 tabular-nums">{x.setNumber}</td>
                  <td className="py-2 pr-3">{setVersion(x)}</td>
                  <td className="py-2 pr-3">{x.prescribed ?? 'Referencia no determinada'}</td>
                  <td className="py-2 pr-3">
                    {x.status === 'done' ? x.performed : SET_STATUS_LABEL[x.status]}
                    {x.note ? (
                      <span className="block text-xs text-ink-500">observación: «{x.note}»</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{differencesOf(x)}</td>
                  <td className="py-2">{conditionsOf(x)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </ScrollTable>
    </section>
  );
}

export function ExerciseEvolutionView({
  vm,
  base,
  backHref,
  sessionHref,
}: {
  vm: ExerciseEvolutionVM;
  base: string;
  /** A9 con el mismo periodo y perspectiva. */
  backHref: string;
  sessionHref: (sessionId: string) => string;
}) {
  const p = vm.period;
  const state = periodState(p, vm.perspective, vm.today);
  const e = vm.evolution;
  return (
    <div className="space-y-5">
      <Link
        href={backHref as Route}
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Análisis por periodos
      </Link>
      {vm.invalidPeriod ? (
        <Notice tone="sun" title="Periodo no válido">
          El periodo pedido no es válido. Se muestran las 12 semanas hasta hoy.
        </Notice>
      ) : null}
      <header className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-sun-800">Evolución de un ejercicio</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink-900">{vm.name}</h2>
        <p className="mt-1 text-sm text-ink-700">{periodText(p)} · por fecha de ejecución</p>
        <nav
          aria-label="Otros periodos"
          className="mt-3 flex flex-wrap gap-3 text-sm font-semibold"
        >
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
        <nav aria-label="Prescripción con la que se compara" className="mt-3">
          <ul className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-cream-50 p-1">
            {(
              [
                ['original', 'Prescripción original', null],
                ['current', 'Prescripción vigente', 'vigente'],
              ] as const
            ).map(([key, label, value]) => (
              <li key={key}>
                <Link
                  href={hrefWith(base, state, { referencia: value }) as Route}
                  aria-current={vm.perspective === key ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold',
                    vm.perspective === key
                      ? 'bg-sun-400 text-ink-900'
                      : 'text-ink-500 hover:text-ink-900',
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <FilterSheet summary={periodText(p)}>
        <form method="get" action={base} className="rounded-3xl bg-white p-4 shadow-soft md:p-5">
          {vm.perspective === 'current' ? (
            <input type="hidden" name="referencia" value="vigente" />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PeriodFields period={p} kind={state.periodo!} />
          </div>
          <button
            type="submit"
            className="mt-3 inline-flex h-11 items-center rounded-2xl bg-ink-900 px-5 text-sm font-bold text-cream-50 hover:bg-ink-700"
          >
            Aplicar
          </button>
        </form>
      </FilterSheet>

      {e.sessions === 0 ? (
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-sm text-ink-700">
            {vm.clientFirstName} no tiene series hechas de este ejercicio en el periodo.
          </p>
        </section>
      ) : (
        <>
          {e.segments.length > 1 ? (
            <Notice tone="sun" title="La modalidad cambia">
              El tipo de serie o la base de la carga no es el mismo en todo el periodo: la evolución
              se muestra en {e.segments.length} tramos y no se compara de un tramo a otro.
            </Notice>
          ) : null}
          {e.segments.map((segment, i) => (
            <Segment
              key={`${segment.modality?.key ?? 'mixta'}-${i}`}
              segment={segment}
              index={i}
              total={e.segments.length}
              name={vm.name}
              sessionHref={sessionHref}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <p>
              {formatNumber(e.sessions, 0)} {e.sessions === 1 ? 'sesión' : 'sesiones'} con series
              hechas de este ejercicio.
            </p>
            <FormulaBadge formula={EXERCISE_FORMULA} />
          </div>
        </>
      )}

      <section
        aria-labelledby="concluir"
        className="rounded-3xl border border-sun-300 bg-sun-100 p-5"
      >
        <h3 id="concluir" className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Info aria-hidden className="size-5" /> Qué se puede concluir y qué no
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>
            Son los kg declarados de cada serie, tal como se registraron (por implemento si la carga
            es «por implemento»): no se estima el 1RM ni la fuerza.
          </li>
          <li>Sin tendencias ni predicciones: la evolución se describe, no se extrapola.</li>
          <li>
            Los valores se proponen con lo prescrito; el RIR y el RPE son estimaciones de la propia
            persona, con error.
          </li>
          <li>No se comparan tramos con modalidades distintas.</li>
        </ul>
      </section>
    </div>
  );
}
