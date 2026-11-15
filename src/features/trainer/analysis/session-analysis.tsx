import { CalendarDays, CircleAlert, Info, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { type SessionAnalysisVM } from '@/contracts/analysis';
import { type Comparison } from '@/domain/analysis/compare';
import {
  ANALYSIS_FORMULAS,
  type AnalyzedExercise,
  type AnalyzedSet,
  type ConditionCounts,
  type SessionAnalysis,
} from '@/domain/analysis/session';
import { formatDate, formatNumber } from '@/domain/format';
import { type FormulaRef } from '@/domain/measurement';
import { ExecutionStatusBadge } from '@/features/shared/status-badge';
import { Badge } from '@/ui/badge';
import { cn } from '@/ui/cn';
import {
  comparisonText,
  CONDITION_LABEL,
  countsText,
  dateTimeText,
  differenceText,
  EXERCISE_STATUS_LABEL,
  gapText,
  intervalText,
  minutesText,
  offsetText,
  PROPOSAL_LABEL,
  referenceText,
  SET_STATUS_LABEL,
  timeText,
  TONNAGE_EXCLUSION_TEXT,
} from './analysis-copy';
import { FormulaBadge } from './formula-badge';

/**
 * A8 · Análisis de una sesión (B3.1; docs/BLOCK3_SPEC.md §9.3). Componente de servidor, sin
 * estado. Orden: resumen, prescrito y registrado, diferencias, datos ausentes y advertencias,
 * detalle por ejercicio y serie, observaciones y «Qué se puede concluir y qué no».
 *
 * Sin índice global, sin porcentajes de cumplimiento, sin colores de semáforo para las
 * diferencias y sin interpretación: describe lo prescrito, lo registrado y lo que falta.
 */
export interface AnalysisLinks {
  original: string;
  current: string;
  /** Totales del día de ejecución (si se empezó). */
  day: string | null;
  /** A7 (prescripción vigente). */
  session: string;
}

const H3 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h3 id={id} className="text-lg font-bold text-ink-900">
    {children}
  </h3>
);

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('rounded-3xl bg-white p-5 shadow-soft', className)}>
      <H3 id={id}>{title}</H3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  term,
  children,
  formula,
}: {
  term: string;
  children: ReactNode;
  formula?: FormulaRef;
}) {
  return (
    <div className="grid gap-1 border-t border-line py-2.5 first:border-t-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-ink-500">{term}</dt>
      <dd className="min-w-0 text-sm text-ink-900">
        {children}
        {formula ? (
          <span className="ml-1.5">
            <FormulaBadge formula={formula} />
          </span>
        ) : null}
      </dd>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function weekText(week: NonNullable<SessionAnalysis['executedWeek']>): string {
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

function Aside({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return <span className="block text-ink-500">Aparte: {items.join(' · ')}</span>;
}

function DimensionCounts({ counts, label }: { counts: ConditionCounts; label?: string }) {
  const { main, aside } = countsText(counts);
  if (!main && aside.length === 0) return null;
  return (
    <span className="block">
      {label ? <span className="font-semibold">{label}: </span> : null}
      {main ?? 'ninguna serie comparable'}
      <Aside items={aside} />
    </span>
  );
}

/** Resumen: duración y cumplimiento por dimensiones, cada una con su denominador. */
function Summary({ a, timeZone }: { a: SessionAnalysis; timeZone: string }) {
  const { structural, quantitative, intensity, effort, proposal } = a.profile;
  const d = a.duration;
  const reps = a.prescribed.reps;
  const quantity: ReactNode[] = [];
  if (a.executed.reps !== null) {
    quantity.push(
      <DimensionCounts
        key="reps"
        counts={quantitative.reps}
        label={
          reps && reps.min === reps.max
            ? `Repeticiones ${formatNumber(a.executed.reps)} de ${formatNumber(reps.min)} prescritas`
            : `Repeticiones ${formatNumber(a.executed.reps)} registradas${reps ? ` (prescrito ${intervalText(reps)})` : ''}`
        }
      />,
    );
  }
  if (a.executed.seconds !== null) {
    quantity.push(
      <DimensionCounts
        key="s"
        counts={quantitative.seconds}
        label={`Tiempo ${formatNumber(a.executed.seconds)} s${a.prescribed.seconds !== null ? ` de ${formatNumber(a.prescribed.seconds)} s prescritos` : ''}`}
      />,
    );
  }
  if (a.executed.meters !== null) {
    quantity.push(
      <DimensionCounts
        key="m"
        counts={quantitative.meters}
        label={`Distancia ${formatNumber(a.executed.meters)} m${a.prescribed.meters !== null ? ` de ${formatNumber(a.prescribed.meters)} m prescritos` : ''}`}
      />,
    );
  }
  return (
    <Section id="resumen" title="Resumen">
      <dl>
        <Row
          term="Duración"
          formula={d.state.kind === 'calculated' ? ANALYSIS_FORMULAS.calculatedDuration : undefined}
        >
          {d.state.kind === 'not_started' ? (
            'Sin duración: la sesión no se ha empezado.'
          ) : d.state.kind === 'unfinished' ? (
            <>
              Sin duración: la sesión no se ha terminado. Empezó el{' '}
              {dateTimeText(d.state.startedAt, timeZone)}; última actividad,{' '}
              {dateTimeText(d.state.lastActivityAt, timeZone)}
              {d.state.paused ? ' (en pausa)' : ''}.
            </>
          ) : d.state.kind === 'incoherent' ? (
            <>
              <strong>Datos de tiempo incoherentes</strong>:{' '}
              {d.state.reason === 'finish_before_start'
                ? 'el fin es anterior al inicio'
                : 'las pausas registradas superan el tiempo transcurrido'}
              . No se calcula ninguna duración. Horas tal como están: inicio{' '}
              {dateTimeText(d.state.startedAt, timeZone)} · fin{' '}
              {dateTimeText(d.state.finishedAt, timeZone)}.
            </>
          ) : d.state.kind === 'not_calculable' ? (
            <>
              <strong>Sin calcular</strong>: la hora de {d.state.adjusted.start ? 'inicio' : ''}
              {d.state.adjusted.start && d.state.adjusted.finish ? ' y de ' : ''}
              {d.state.adjusted.finish ? 'fin' : ''} se ajustó porque el reloj del móvil no era
              fiable. Horas tal como están: inicio {dateTimeText(d.state.startedAt, timeZone)} · fin{' '}
              {dateTimeText(d.state.finishedAt, timeZone)}.
            </>
          ) : (
            <>
              Transcurrida {minutesText(d.state.elapsedSeconds)} · pausas registradas{' '}
              {minutesText(d.pausedSeconds)} · calculada {minutesText(d.state.calculatedSeconds)}
              {d.estimatedMinutes !== null ? ` · prevista ${d.estimatedMinutes} min` : ''}
              <span className="block text-ink-500">
                La duración calculada no es tiempo activo: no se descuentan los huecos sin pausa.
              </span>
            </>
          )}
        </Row>
        <Row term="Estructural" formula={ANALYSIS_FORMULAS.complianceProfile}>
          {structural.sets.total === 0 ? (
            'Sin series que contar con esta referencia.'
          ) : (
            <>
              {structural.sets.done} de{' '}
              {plural(structural.sets.total, 'serie hecha', 'series hechas')} ·{' '}
              {plural(structural.sets.notDone, 'no realizada', 'no realizadas')} ·{' '}
              {structural.sets.unregistered} sin registrar
              <span className="block text-ink-500">
                Ejercicios: {plural(structural.exercises.complete, 'completo', 'completos')} ·{' '}
                {plural(structural.exercises.partial, 'parcial', 'parciales')} ·{' '}
                {plural(structural.exercises.not_done, 'no realizado', 'no realizados')} ·{' '}
                {structural.exercises.unregistered} sin registrar
              </span>
            </>
          )}
        </Row>
        <Row term="Cuantitativa">{quantity.length > 0 ? quantity : 'No aplica'}</Row>
        <Row term="Intensidad">
          <DimensionCounts counts={intensity} label="Carga" />
          {Object.values(intensity).every((n) => n === 0) ? 'Sin series hechas' : null}
        </Row>
        <Row term="Esfuerzo">
          <DimensionCounts counts={effort.rir} label="RIR" />
          <DimensionCounts counts={effort.rpe} label="RPE" />
          {Object.values(effort.rir).every((n) => n === 0) &&
          Object.values(effort.rpe).every((n) => n === 0)
            ? 'Sin objetivo de esfuerzo en las series hechas'
            : null}
        </Row>
        <Row term="Valores propuestos" formula={ANALYSIS_FORMULAS.proposedValueMatch}>
          {proposal.done === 0 ? (
            'Sin series hechas.'
          ) : (
            <>
              {proposal.equal} de {plural(proposal.done, 'serie hecha', 'series hechas')} con los
              valores iguales a lo propuesto · {proposal.different} con algún valor distinto
              <span className="block text-ink-500">
                La app propone lo prescrito y la clienta lo cambia si hace falta: un valor igual al
                propuesto puede haberse aceptado sin revisarlo.
              </span>
            </>
          )}
        </Row>
      </dl>
      <p className="mt-3 text-xs text-ink-500">
        Cada dimensión va por separado, con su denominador. «Sin dato», «no aplica», «no comparable»
        y «no evaluable» se cuentan aparte. No hay puntuación global.
      </p>
    </Section>
  );
}

function VolumeTable({ a }: { a: SessionAnalysis }) {
  const p = a.prescribed;
  const e = a.executed;
  const perspective = a.perspective === 'original' ? 'original' : 'vigente';
  const rows: {
    name: string;
    prescribed: string | null;
    executed: string | null;
    formula: FormulaRef;
    note?: string;
  }[] = [
    {
      name: 'Series',
      prescribed:
        [
          p.sets.reps ? `${p.sets.reps} por repeticiones` : null,
          p.sets.seconds ? `${p.sets.seconds} por tiempo` : null,
          p.sets.meters ? `${p.sets.meters} por distancia` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
      executed:
        [
          e.sets.reps ? `${e.sets.reps} por repeticiones` : null,
          e.sets.seconds ? `${e.sets.seconds} por tiempo` : null,
          e.sets.meters ? `${e.sets.meters} por distancia` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '0',
      formula: ANALYSIS_FORMULAS.completedSets,
      note: 'hechas',
    },
  ];
  if (p.reps !== null || e.reps !== null) {
    rows.push({
      name: 'Repeticiones',
      prescribed: intervalText(p.reps),
      executed: e.reps === null ? null : formatNumber(e.reps),
      formula: ANALYSIS_FORMULAS.totalReps,
    });
  }
  if (p.repsPerSide !== null || e.repsPerSide !== null) {
    rows.push({
      name: 'Repeticiones «por lado» (aparte)',
      prescribed: intervalText(p.repsPerSide),
      executed: e.repsPerSide === null ? null : formatNumber(e.repsPerSide),
      formula: ANALYSIS_FORMULAS.totalReps,
    });
  }
  if (p.seconds !== null || e.seconds !== null) {
    rows.push({
      name: 'Tiempo (series por tiempo)',
      prescribed: p.seconds === null ? null : `${formatNumber(p.seconds)} s`,
      executed: e.seconds === null ? null : `${formatNumber(e.seconds)} s`,
      formula: ANALYSIS_FORMULAS.durationTotal,
    });
  }
  if (p.meters !== null || e.meters !== null) {
    rows.push({
      name: 'Distancia',
      prescribed: p.meters === null ? null : `${formatNumber(p.meters)} m`,
      executed: e.meters === null ? null : `${formatNumber(e.meters)} m`,
      formula: ANALYSIS_FORMULAS.distanceTotal,
    });
  }
  if (p.tonnageKg !== null || e.tonnageKg !== null) {
    rows.push({
      name: 'Tonelaje externo (nominal)',
      prescribed: intervalText(p.tonnageKg, 'kg', 1),
      executed: e.tonnageKg === null ? null : `${formatNumber(e.tonnageKg, 1)} kg`,
      formula: ANALYSIS_FORMULAS.volumeLoad,
    });
  }
  const excluded = Object.entries(e.tonnageExcluded) as [
    keyof typeof TONNAGE_EXCLUSION_TEXT,
    number,
  ][];
  return (
    <Section id="volumen" title="Prescrito y registrado">
      <p className="text-sm text-ink-500">
        Cada magnitud en su fila: no se suman repeticiones, segundos, metros ni tipos de carga.
        Prescrito según la referencia {perspective}.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <caption className="sr-only">Volumen prescrito y registrado, magnitud a magnitud</caption>
          <thead>
            <tr className="border-b border-line text-ink-500">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Magnitud
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Prescrito
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Registrado
              </th>
              <th scope="col" className="py-2 font-semibold">
                Definición
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-line/60 align-top">
                <th scope="row" className="py-2 pr-3 font-semibold text-ink-900">
                  {r.name}
                </th>
                <td className="py-2 pr-3 tabular-nums">{r.prescribed ?? 'no aplica'}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {r.executed ?? 'no aplica'}
                  {r.note ? <span className="text-ink-500"> {r.note}</span> : null}
                </td>
                <td className="py-2">
                  <FormulaBadge formula={r.formula} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink-500">
        {p.unregisteredUnknown ? (
          <li>
            Lo prescrito solo incluye las series registradas: para el resto, la referencia histórica
            no está determinada.
          </li>
        ) : null}
        {excluded.map(([reason, n]) => (
          <li key={reason}>
            Sin calcular en el tonelaje: {plural(n, 'serie', 'series')} con{' '}
            {TONNAGE_EXCLUSION_TEXT[reason]}.
          </li>
        ))}
        <li>
          El tonelaje suma kg declarados: no es la carga realmente desplazada ni el trabajo
          mecánico. No incluye peso corporal, lastre ni asistencia.
        </li>
      </ul>
    </Section>
  );
}

const DIFFERENT = new Set<Comparison['condition']>(['differs', 'below', 'above']);

function Differences({ a }: { a: SessionAnalysis }) {
  const items = a.exercises.flatMap((e) =>
    e.sets.flatMap((s) => {
      const diffs = [s.quantity, s.load, ...s.effort].filter(
        (c): c is Comparison => c !== null && DIFFERENT.has(c.condition),
      );
      return diffs.length === 0 ? [] : [{ e, s, diffs }];
    }),
  );
  return (
    <Section id="diferencias" title="Diferencias respecto a lo prescrito">
      {items.length === 0 ? (
        <p className="text-sm text-ink-700">Ninguna en las series hechas que se pueden comparar.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-ink-900">
          {items.map(({ e, s, diffs }) => (
            <li
              key={`${e.prescriptionId}#${s.setNumber}`}
              className="rounded-2xl bg-cream-50 px-3 py-2"
            >
              <span className="font-semibold">
                {e.slot} · {e.name} · serie {s.setNumber}:
              </span>{' '}
              {diffs.map(comparisonText).join(' · ')}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-500">
        Tolerancia cero: se muestra toda diferencia. Mostrarla no es un juicio; la interpretación es
        del entrenador.
      </p>
    </Section>
  );
}

function sumCondition(
  a: SessionAnalysis,
  condition: Comparison['condition'],
  pick: (s: AnalyzedSet) => (Comparison | null)[],
) {
  return a.exercises
    .flatMap((e) => e.sets)
    .flatMap(pick)
    .filter((c) => c?.condition === condition).length;
}

function MissingAndWarnings({ vm, timeZone }: { vm: SessionAnalysisVM; timeZone: string }) {
  const a = vm.analysis;
  const items: string[] = [];
  if (a.reference.kind === 'undetermined') items.push(referenceText(a.reference));
  const sets = a.profile.structural.sets;
  if (sets.unregistered > 0)
    items.push(`${plural(sets.unregistered, 'serie sin registrar', 'series sin registrar')}.`);
  if (sets.notDone > 0)
    items.push(
      `${plural(sets.notDone, 'serie marcada como no realizada', 'series marcadas como no realizadas')}: no hay motivos registrados.`,
    );
  const effortNoData = sumCondition(a, 'no_data', (s) => s.effort);
  if (effortNoData > 0)
    items.push(
      `${plural(effortNoData, 'dato de esfuerzo', 'datos de esfuerzo')} sin registrar (RIR o RPE prescrito y no anotado). No se cuentan como cero.`,
    );
  const loadNoData = sumCondition(a, 'no_data', (s) => [s.load]);
  if (loadNoData > 0)
    items.push(
      `${plural(loadNoData, 'serie', 'series')} sin el valor de carga (por ejemplo, la asistencia).`,
    );
  const notComparable = sumCondition(a, 'not_comparable', (s) => [s.quantity, s.load, ...s.effort]);
  if (notComparable > 0)
    items.push(
      `${plural(notComparable, 'comparación no comparable', 'comparaciones no comparables')} (otra magnitud, modalidad o escala).`,
    );
  const notEvaluable = sumCondition(a, 'not_evaluable', (s) => [s.quantity, s.load, ...s.effort]);
  if (notEvaluable > 0)
    items.push(
      `${plural(notEvaluable, 'objetivo no evaluable', 'objetivos no evaluables')} (carácter o calidad del esfuerzo, o %1RM sin resolver).`,
    );
  if (a.outsideReferenceSets > 0)
    items.push(
      `${plural(a.outsideReferenceSets, 'serie registrada que ya no está', 'series registradas que ya no están')} en la versión vigente: se listan sin comparar.`,
    );
  if (a.status === 'in_progress' || a.status === 'paused' || a.status === 'interrupted') {
    items.push(
      `La sesión no está terminada: solo se ve lo confirmado por el servidor; lo que ${vm.clientFirstName} tenga pendiente de envío en su móvil no aparece.`,
    );
  }
  if (a.startedVersion !== null && !a.startVersionObserved)
    items.push(
      'La versión de inicio es anterior a su registro en la base: se dedujo al actualizarla y no se usa como referencia.',
    );
  if (a.duration.anyAdjusted)
    items.push(
      'Alguna hora de la sesión se ajustó porque el reloj del móvil no era fiable: se muestra tal como está.',
    );
  if (a.executedOnFromAdjustedTime)
    items.push('La fecha de ejecución sale de una hora de inicio ajustada.');
  for (const gap of a.duration.gaps) items.push(gapText(gap, timeZone));
  if (a.plannedDateChanged)
    items.push('La fecha prevista cambió entre versiones: se muestra la de la versión vigente.');
  return (
    <Section id="ausentes" title="Datos ausentes y advertencias">
      {items.length === 0 ? (
        <p className="text-sm text-ink-700">Ninguno.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-ink-900">
          {items.map((text) => (
            <li key={text} className="flex gap-2">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-700" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function conditionsOf(s: AnalyzedSet): string {
  const all = [s.quantity, s.load, ...s.effort].filter((c): c is Comparison => c !== null);
  return all.length === 0
    ? '—'
    : all
        .map(
          (c) =>
            `${c.label === 'added_kg' ? 'Lastre' : c.label === 'assistance_kg' ? 'Asistencia' : { reps: 'Rep.', seconds: 'Tiempo', meters: 'Distancia', load: 'Carga', rir: 'RIR', rpe: 'RPE' }[c.measure]}: ${CONDITION_LABEL[c.condition]}`,
        )
        .join(' · ');
}

function differencesOf(s: AnalyzedSet): string {
  const all = [s.quantity, s.load, ...s.effort]
    .map((c) => (c ? differenceText(c) : null))
    .filter(Boolean);
  return all.length === 0 ? '—' : all.join(' · ');
}

function setVersion(s: AnalyzedSet): string {
  if (s.outsideReference) return `v${s.loggedVersion} · fuera de la vigente`;
  if (s.referenceVersion === null) return 'No determinada';
  return s.loggedVersion !== null && s.loggedVersion !== s.referenceVersion
    ? `v${s.referenceVersion} (registrada con la v${s.loggedVersion})`
    : `v${s.referenceVersion}`;
}

function SetExtras({ s, timeZone }: { s: AnalyzedSet; timeZone: string }) {
  const extras: string[] = [];
  if (s.performedAt)
    extras.push(
      `a las ${timeText(s.performedAt, timeZone)}${s.clockAdjusted ? ' (hora ajustada)' : ''}`,
    );
  if (s.corrected) extras.push(`corregida; antes: ${s.previous.join(' → ')}`);
  if (s.perSide) extras.push('repeticiones «por lado»');
  if (s.note) extras.push(`observación: «${s.note}»`);
  return extras.length > 0 ? (
    <span className="block text-xs text-ink-500">{extras.join(' · ')}</span>
  ) : null;
}

function Exercise({ e, timeZone }: { e: AnalyzedExercise; timeZone: string }) {
  const id = `ej-${e.prescriptionId}`;
  return (
    <section aria-labelledby={id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id={id} className="font-bold text-ink-900">
          {e.slot} · {e.name}
        </h4>
        <Badge tone="neutral">
          {e.status ? EXERCISE_STATUS_LABEL[e.status] : 'fuera de la versión vigente'}
        </Badge>
      </div>
      {e.prescribed ? <p className="text-sm text-ink-500">Prescrito: {e.prescribed}</p> : null}

      {/* Escritorio: tabla. */}
      <div className="mt-2 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Series de {e.name}: prescrito, registrado, diferencia y condición
          </caption>
          <thead>
            <tr className="border-b border-line text-ink-500">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Serie
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Versión
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Prescrito
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Registrado
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Diferencia
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Condición
              </th>
              <th scope="col" className="py-1.5 font-semibold">
                Propuesto
              </th>
            </tr>
          </thead>
          <tbody>
            {e.sets.map((s) => (
              <tr key={s.setNumber} className="border-b border-line/60 align-top">
                <th scope="row" className="py-2 pr-3 font-semibold text-ink-900">
                  {s.setNumber}
                </th>
                <td className="py-2 pr-3">{setVersion(s)}</td>
                <td className="py-2 pr-3">{s.prescribed ?? 'Referencia no determinada'}</td>
                <td className="py-2 pr-3">
                  {s.status === 'done' ? s.performed : SET_STATUS_LABEL[s.status]}
                  <SetExtras s={s} timeZone={timeZone} />
                </td>
                <td className="py-2 pr-3 tabular-nums">{differencesOf(s)}</td>
                <td className="py-2 pr-3">{conditionsOf(s)}</td>
                <td className="py-2">{s.proposal ? PROPOSAL_LABEL[s.proposal.overall] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: una tarjeta por serie. */}
      <ol className="mt-2 space-y-2 md:hidden" aria-label={`Series de ${e.name}`}>
        {e.sets.map((s) => (
          <li key={s.setNumber} className="rounded-2xl bg-cream-50 p-3 text-sm">
            <p className="font-semibold text-ink-900">
              Serie {s.setNumber} · {setVersion(s)}
            </p>
            <dl className="mt-1 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
              <dt className="text-ink-500">Prescrito</dt>
              <dd>{s.prescribed ?? 'Referencia no determinada'}</dd>
              <dt className="text-ink-500">Registrado</dt>
              <dd>
                {s.status === 'done' ? s.performed : SET_STATUS_LABEL[s.status]}
                <SetExtras s={s} timeZone={timeZone} />
              </dd>
              <dt className="text-ink-500">Diferencia</dt>
              <dd>{differencesOf(s)}</dd>
              <dt className="text-ink-500">Condición</dt>
              <dd>{conditionsOf(s)}</dd>
              <dt className="text-ink-500">Propuesto</dt>
              <dd>{s.proposal ? PROPOSAL_LABEL[s.proposal.overall] : '—'}</dd>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SessionAnalysisView({
  vm,
  links,
}: {
  vm: SessionAnalysisVM;
  links: AnalysisLinks;
}) {
  const a = vm.analysis;
  const timeZone = a.executionTimeZone ?? vm.appTimeZone;
  const offset = offsetText(a.daysFromPlanned);
  const notes = a.exercises.flatMap((e) => e.sets.filter((s) => s.note).map((s) => ({ e, s })));
  const perspectives = [
    { key: 'original' as const, href: links.original, label: 'Prescripción original' },
    { key: 'current' as const, href: links.current, label: 'Prescripción vigente' },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-sun-800">
          {vm.label ? `${vm.label} · ` : ''}Análisis de la sesión
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink-900">{vm.title}</h2>
        <p className="mt-1 text-ink-700">{vm.focus}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ExecutionStatusBadge status={a.status} />
          {a.finishReason === 'ended_early' ? (
            <span className="text-sm text-ink-700">
              Cerrada antes de terminar
              {a.pendingSetsConfirmed !== null
                ? ` (${plural(a.pendingSetsConfirmed, 'serie pendiente confirmada', 'series pendientes confirmadas')})`
                : ''}
            </span>
          ) : null}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-500">Prevista</dt>
            <dd className="font-semibold text-ink-900 first-letter:uppercase">
              {formatDate(a.plannedDate, 'long')}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-500">Realizada</dt>
            <dd className="font-semibold text-ink-900">
              {a.executedOn
                ? `${formatDate(a.executedOn, 'long')}${offset ? ` (${offset})` : ''}`
                : 'Sin empezar'}
            </dd>
          </div>
          {a.executedWeek ? (
            <div className="flex flex-wrap gap-x-2 sm:col-span-2">
              <dt className="text-ink-500">Semana de ejecución</dt>
              <dd className="text-ink-900">{weekText(a.executedWeek)}</dd>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-2 sm:col-span-2">
            <dt className="text-ink-500">Versiones</dt>
            <dd className="text-ink-900">
              vigente v{a.currentVersion}
              {a.startedVersion !== null ? ` · empezada con la v${a.startedVersion}` : ''}
              {a.versionsUsed.length > 0
                ? ` · series registradas con ${a.versionsUsed.map((v) => `v${v}`).join(' y ')}`
                : ''}
            </dd>
          </div>
        </dl>
        <nav aria-label="Prescripción con la que se compara" className="mt-4">
          <ul className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-cream-50 p-1">
            {perspectives.map((p) => (
              <li key={p.key}>
                <Link
                  href={p.href}
                  aria-current={a.perspective === p.key ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-semibold',
                    a.perspective === p.key
                      ? 'bg-sun-400 text-ink-900'
                      : 'text-ink-500 hover:text-ink-900',
                  )}
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-2 text-sm text-ink-700">
          {a.perspective === 'original'
            ? 'Original: cada serie registrada frente a la versión con la que se registró.'
            : 'Vigente: cada serie frente a la prescripción actual.'}{' '}
          Lo no registrado: {referenceText(a.reference)}
        </p>
      </header>

      <Summary a={a} timeZone={timeZone} />
      <VolumeTable a={a} />
      <Differences a={a} />
      <MissingAndWarnings vm={vm} timeZone={timeZone} />

      <Section id="detalle" title="Detalle por ejercicio y serie">
        {a.exercises.length === 0 ? (
          <p className="text-sm text-ink-700">
            {a.reference.kind === 'undetermined'
              ? 'No hay series que mostrar con esta referencia: no se registró ninguna y la referencia histórica no está determinada. Puedes ver la prescripción vigente.'
              : 'Esta versión no tiene ejercicios.'}
          </p>
        ) : (
          <div className="space-y-5">
            {a.status === 'planned' || a.status === 'overdue' ? (
              <p className="text-sm text-ink-700">
                {vm.clientFirstName} aún no ha empezado esta sesión.
              </p>
            ) : null}
            {a.exercises.map((e) => (
              <Exercise key={e.prescriptionId} e={e} timeZone={timeZone} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-500">
          Horas en{' '}
          {timeZone === vm.appTimeZone
            ? 'la zona de la aplicación'
            : `la zona del móvil al empezar (${timeZone})`}
          . Descanso real: no se registra.
        </p>
      </Section>

      <Section id="observaciones" title="Observaciones">
        <ul className="space-y-2 text-sm text-ink-900">
          <li className="flex gap-2">
            <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-700" />
            <span>
              <span className="font-semibold">Comentario de {vm.clientFirstName}: </span>
              {a.comment ?? 'ninguno'}
            </span>
          </li>
          {notes.map(({ e, s }) => (
            <li key={`${e.prescriptionId}#${s.setNumber}`} className="pl-6">
              {e.slot} · {e.name} · serie {s.setNumber}: «{s.note}»
            </li>
          ))}
          <li className="pl-6">
            {a.corrections === 0
              ? 'Sin correcciones.'
              : `${plural(a.corrections, 'serie corregida', 'series corregidas')}: se cuenta solo el valor corregido.`}
          </li>
        </ul>
      </Section>

      <section
        aria-labelledby="concluir"
        className="rounded-3xl border border-sun-300 bg-sun-100 p-5"
      >
        <h3 id="concluir" className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Info aria-hidden className="size-5" /> Qué se puede concluir y qué no
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>
            «Serie hecha» confirma el registro de la serie, no una medición independiente de cada
            valor. Las repeticiones, el tiempo y la carga se proponen con lo prescrito: un valor
            igual al propuesto puede haberse aceptado sin revisarlo.
          </li>
          <li>
            El RIR y el RPE son estimaciones de la propia persona, con error. Nunca se convierten
            entre sí.
          </li>
          <li>No hay motivos registrados de lo que no se hizo.</li>
          <li>
            La duración calculada no es tiempo activo; el tonelaje es nominal (kg declarados).
          </li>
          <li>
            Este análisis describe diferencias: no las valora, no indica fatiga ni adaptación y no
            recomienda cambios. La interpretación es tuya.
          </li>
        </ul>
      </section>

      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
        {links.day && a.executedOn ? (
          <Link
            href={links.day}
            className="inline-flex min-h-10 items-center gap-1.5 text-sun-800 hover:text-ink-900"
          >
            <CalendarDays aria-hidden className="size-4" /> Totales del{' '}
            {formatDate(a.executedOn, 'long')} (día de ejecución)
          </Link>
        ) : null}
        <Link
          href={links.session}
          className="inline-flex min-h-10 items-center text-sun-800 hover:text-ink-900"
        >
          Ver la sesión publicada
        </Link>
      </p>
    </div>
  );
}
