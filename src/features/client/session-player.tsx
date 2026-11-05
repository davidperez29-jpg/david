'use client';

import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  ChevronDown,
  Clock,
  PartyPopper,
  Plus,
  SkipForward,
  VideoOff,
  ListChecks,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { type ExerciseInSessionVM, type SessionDetailVM } from '@/contracts/shared';
import { formatClock, formatNumber } from '@/domain/format';
import {
  deriveSessionStatus,
  effectiveSetRecords,
  type ExecutionSummary,
  isValidPerceivedEffort,
  type SessionStatus,
  type SetRecord,
  summarizeExecution,
} from '@/domain/training/session';
import { summarizeVolume, VOLUME_FORMULAS } from '@/domain/training/volume';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { OriginBadge } from '@/features/shared/provenance';
import { PrescriptionChips } from '@/features/shared/prescription';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { cn } from '@/ui/cn';
import { Meter } from '@/ui/meter';

interface SetState {
  reps: string;
  kg: string;
  done: boolean;
  error: string | null;
}

type Records = Record<string, SetState[]>;

function initialRecords(exercises: ExerciseInSessionVM[]): Records {
  return Object.fromEntries(
    exercises.map((exercise) => [
      exercise.prescriptionId,
      Array.from({ length: exercise.sets }, () => ({
        reps: exercise.defaultReps?.toString() ?? '',
        kg: exercise.defaultLoadKg?.toString().replace('.', ',') ?? '',
        done: false,
        error: null,
      })),
    ]),
  );
}

const parseNumber = (value: string) => Number(value.trim().replace(',', '.'));

/** Valida lo que escribe el cliente antes de dar la serie por hecha. */
function validateSet(exercise: ExerciseInSessionVM, set: SetState): string | null {
  if (exercise.repUnit === 'reps') {
    const reps = parseNumber(set.reps);
    if (set.reps.trim() === '' || !Number.isInteger(reps) || reps < 0 || reps > 200) {
      return 'Escribe las repeticiones (un número entero).';
    }
  }
  if (exercise.tracksLoadKg && set.kg.trim() !== '') {
    const kg = parseNumber(set.kg);
    if (!Number.isFinite(kg) || kg < 0 || kg > 1000) return 'La carga debe ser un número en kg.';
  }
  return null;
}

export function SessionPlayer({ session }: { session: SessionDetailVM }) {
  const [records, setRecords] = useState<Records>(() => initialRecords(session.exercises));
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  // Tiempos en la escala de performance.now() / event.timeStamp (mismo origen).
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [effort, setEffort] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<string, number | null>>({});
  const [note, setNote] = useState('');
  // Lo registrado, en el formato del dominio: una entrada por serie (ejercicio + número de serie).
  const prescribed = useMemo(
    () => ({ exercises: session.exercises.map((e) => ({ id: e.prescriptionId, sets: e.sets })) }),
    [session.exercises],
  );
  const loggedRecords = useMemo<SetRecord[]>(
    () =>
      session.exercises.flatMap((exercise) =>
        records[exercise.prescriptionId]!.map((set, index) => ({
          prescriptionId: exercise.prescriptionId,
          setNumber: index + 1,
          completed: set.done,
          reps: exercise.repUnit === 'reps' && set.done ? parseNumber(set.reps) : 0,
          loadKg:
            exercise.tracksLoadKg && set.done && set.kg.trim() !== '' ? parseNumber(set.kg) : null,
        })),
      ),
    [records, session.exercises],
  );
  // Misma lógica que el servidor: series sin duplicados y estado según lo realizado.
  const execution = useMemo(
    () => summarizeExecution(prescribed, loggedRecords),
    [prescribed, loggedRecords],
  );
  const status = deriveSessionStatus(execution, { started, finished, dayPassed: false });
  const totalSets = execution.plannedSets;
  const doneSets = execution.completedSets;

  useEffect(() => {
    if (!rest) return;
    const timer = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [rest]);

  const remaining = rest ? Math.max(0, (rest.endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (rest && remaining === 0) {
      if ('vibrate' in navigator) navigator.vibrate?.(200);
      const timeout = window.setTimeout(() => setRest(null), 2500);
      return () => window.clearTimeout(timeout);
    }
  }, [rest, remaining]);

  function updateSet(prescriptionId: string, index: number, patch: Partial<SetState>) {
    if (patch.done) setStarted(true);
    setRecords((current) => ({
      ...current,
      [prescriptionId]: current[prescriptionId]!.map((set, i) =>
        i === index ? { ...set, ...patch } : set,
      ),
    }));
  }

  /** Un toque: da por hechas todas las series del ejercicio con los valores escritos. */
  function completeExercise(exercise: ExerciseInSessionVM) {
    setStarted(true);
    setRecords((current) => ({
      ...current,
      [exercise.prescriptionId]: current[exercise.prescriptionId]!.map((set) => {
        if (set.done) return set;
        const error = validateSet(exercise, set);
        return { ...set, done: !error, error };
      }),
    }));
  }

  function toggleSet(exercise: ExerciseInSessionVM, index: number, at: number) {
    const set = records[exercise.prescriptionId]![index]!;
    if (set.done) return updateSet(exercise.prescriptionId, index, { done: false });
    const error = validateSet(exercise, set);
    updateSet(exercise.prescriptionId, index, { done: !error, error });
    if (!error && exercise.restSeconds > 0) {
      setNow(at);
      setRest({ endsAt: at + exercise.restSeconds * 1000, total: exercise.restSeconds });
    }
  }

  const volume = useMemo(
    () => summarizeVolume(effectiveSetRecords(prescribed, loggedRecords)),
    [prescribed, loggedRecords],
  );

  function finish() {
    setRest(null);
    setConfirming(false);
    setFinished(true);
    window.scrollTo({ top: 0 });
  }

  if (finished) {
    return (
      <SessionSummary
        status={status}
        execution={execution}
        volume={volume}
        exercises={session.exercises}
        effort={effort}
        onEffort={setEffort}
        note={note}
        onNote={setNote}
        onBack={() => setFinished(false)}
      />
    );
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 bg-cream-100/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2 text-ink-700">
            Progreso <SessionStatusBadge status={status} />
          </span>
          <span className="text-ink-900 tabular-nums" aria-live="polite">
            {doneSets} de {totalSets} series
          </span>
        </div>
        <Meter
          className="mt-2"
          value={doneSets}
          max={totalSets}
          label="Series completadas"
          tone="leaf"
        />
      </div>

      <ol className="mt-2 space-y-4">
        {session.exercises.map((exercise) => (
          <li key={exercise.prescriptionId}>
            <ExerciseCard
              exercise={exercise}
              sets={records[exercise.prescriptionId]!}
              onChange={(index, patch) => updateSet(exercise.prescriptionId, index, patch)}
              onToggle={(index, at) => toggleSet(exercise, index, at)}
              onCompleteAll={() => completeExercise(exercise)}
              feedback={feedback[exercise.prescriptionId] ?? null}
              onFeedback={(value) =>
                setFeedback((current) => ({ ...current, [exercise.prescriptionId]: value }))
              }
            />
          </li>
        ))}
      </ol>

      {confirming ? (
        <section
          aria-labelledby="confirmar-fin"
          className="mt-6 rounded-3xl border-2 border-sun-400 bg-sun-100 p-5"
        >
          <h2 id="confirmar-fin" className="text-lg font-bold text-ink-900">
            {doneSets === 0
              ? 'No has registrado ninguna serie'
              : `Te faltan ${totalSets - doneSets} series`}
          </h2>
          <p className="mt-1 text-sm text-ink-700">
            {doneSets === 0
              ? 'Si terminas ahora, la sesión quedará como «No realizada».'
              : `Has hecho ${doneSets} de ${totalSets} series y has completado ${execution.completedExercises} de ${execution.plannedExercises} ejercicios. Si terminas ahora, la sesión quedará como «Parcial o interrumpida».`}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-12 rounded-2xl border border-line bg-white font-semibold text-ink-900 hover:border-ink-300"
            >
              Seguir entrenando
            </button>
            <button
              type="button"
              onClick={finish}
              className="h-12 rounded-2xl bg-ink-900 font-bold text-cream-50 hover:bg-ink-700"
            >
              Terminar igualmente
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => (doneSets >= totalSets && totalSets > 0 ? finish() : setConfirming(true))}
          className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 hover:bg-ink-700"
        >
          <Check aria-hidden className="size-5" /> Terminar sesión
        </button>
      )}
      <p className="mt-3 text-center text-xs text-ink-500">
        Demostración: lo que registres no se guarda al salir.
      </p>

      {rest ? (
        <div
          role="timer"
          aria-live="off"
          aria-label="Descanso"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="flex items-center gap-3 rounded-3xl bg-ink-900 p-3 pl-5 text-cream-50 shadow-lift">
            <Clock aria-hidden className="size-5 shrink-0 text-sun-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-cream-200">
                {remaining > 0 ? 'Descanso' : '¡A por la siguiente serie!'}
              </p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatClock(remaining)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRest((r) => (r ? { ...r, endsAt: r.endsAt + 15_000 } : r))}
              className="flex h-11 items-center gap-1 rounded-2xl bg-white/10 px-3 text-sm font-semibold hover:bg-white/20"
            >
              <Plus aria-hidden className="size-4" /> 15 s
            </button>
            <button
              type="button"
              onClick={() => setRest(null)}
              className="flex h-11 items-center gap-1 rounded-2xl bg-sun-400 px-3 text-sm font-bold text-ink-900 hover:bg-sun-300"
            >
              <SkipForward aria-hidden className="size-4" /> Saltar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ExerciseCard({
  exercise,
  sets,
  onChange,
  onToggle,
  onCompleteAll,
  feedback,
  onFeedback,
}: {
  exercise: ExerciseInSessionVM;
  sets: SetState[];
  onChange: (index: number, patch: Partial<SetState>) => void;
  onToggle: (index: number, at: number) => void;
  onCompleteAll: () => void;
  feedback: number | null;
  onFeedback: (value: number | null) => void;
}) {
  const allDone = sets.every((set) => set.done);
  const headingId = `ejercicio-${exercise.prescriptionId}`;
  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'rounded-3xl bg-white p-4 shadow-soft ring-1',
        allDone ? 'ring-leaf-500' : 'ring-line/70',
      )}
    >
      <div className="flex gap-3">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-cream-100">
          <ExercisePictogram silhouette={exercise.silhouette} className="size-12" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-sun-700">{exercise.slot}</p>
          <h2 id={headingId} className="text-lg leading-tight font-bold text-ink-900">
            {exercise.name}
          </h2>
          {allDone ? <p className="mt-0.5 text-sm font-semibold text-leaf-700">¡Hecho!</p> : null}
        </div>
      </div>

      <PrescriptionChips exercise={exercise} className="mt-3" />
      {exercise.notes ? <p className="mt-2 text-sm text-ink-700">{exercise.notes}</p> : null}

      <details className="group mt-3 rounded-2xl bg-cream-50 ring-1 ring-line">
        <summary className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-sm font-semibold text-ink-900">
          Cómo se hace
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-3.5 pb-3.5 text-sm text-ink-700">
          <ol className="list-decimal space-y-1 pl-5">
            {exercise.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {exercise.cues.length ? (
            <p>
              <span className="font-semibold text-ink-900">Claves: </span>
              {exercise.cues.join(' · ')}
            </p>
          ) : null}
          {exercise.tempo ? (
            <div>
              <p className="font-semibold text-ink-900">Tempo {exercise.tempo.code}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {exercise.tempo.description.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {exercise.videoUrl ? (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-sun-700"
            >
              Ver vídeo <ExternalLink aria-hidden className="size-4" />
            </a>
          ) : (
            <p className="flex items-center gap-1.5 text-ink-500">
              <VideoOff aria-hidden className="size-4" /> Tu entrenador aún no ha añadido un vídeo.
            </p>
          )}
        </div>
      </details>

      <div className="mt-3">
        <div
          className="grid grid-cols-[3.5rem_1fr_1fr_3rem] gap-2 px-1 text-xs font-semibold text-ink-500"
          aria-hidden
        >
          <span>Serie</span>
          <span>{exercise.repUnit === 'reps' ? 'Rep.' : 'Objetivo'}</span>
          <span>{exercise.tracksLoadKg ? 'Kg' : ''}</span>
          <span />
        </div>
        <ul className="mt-1 space-y-2">
          {sets.map((set, index) => (
            <li key={index}>
              <div
                className={cn(
                  'grid grid-cols-[3.5rem_1fr_1fr_3rem] items-center gap-2 rounded-2xl p-1',
                  set.done ? 'bg-leaf-100' : set.error ? 'bg-coral-100' : 'bg-cream-50',
                )}
              >
                <span className="pl-2 text-sm font-bold text-ink-700">{index + 1}</span>
                {exercise.repUnit === 'reps' ? (
                  <input
                    inputMode="numeric"
                    value={set.reps}
                    disabled={set.done}
                    aria-label={`Repeticiones, serie ${index + 1} de ${exercise.name}`}
                    aria-invalid={set.error ? true : undefined}
                    onChange={(event) => onChange(index, { reps: event.target.value, error: null })}
                    className="h-12 w-full min-w-0 rounded-xl border border-line bg-white text-center text-lg font-bold text-ink-900 disabled:border-transparent disabled:bg-transparent"
                  />
                ) : (
                  <span className="text-center text-sm font-semibold text-ink-900">
                    {exercise.repTargetLabel}
                  </span>
                )}
                {exercise.tracksLoadKg ? (
                  <input
                    inputMode="decimal"
                    value={set.kg}
                    disabled={set.done}
                    aria-label={`Carga en kg, serie ${index + 1} de ${exercise.name}`}
                    aria-invalid={set.error ? true : undefined}
                    onChange={(event) => onChange(index, { kg: event.target.value, error: null })}
                    className="h-12 w-full min-w-0 rounded-xl border border-line bg-white text-center text-lg font-bold text-ink-900 disabled:border-transparent disabled:bg-transparent"
                  />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={(event) => onToggle(index, event.timeStamp)}
                  aria-pressed={set.done}
                  aria-label={`${set.done ? 'Desmarcar' : 'Marcar como hecha'} la serie ${index + 1} de ${exercise.name}`}
                  className={cn(
                    'grid size-12 place-items-center rounded-xl transition-colors',
                    set.done
                      ? 'bg-leaf-500 text-white'
                      : 'border-2 border-ink-300 bg-white text-ink-300 hover:border-ink-900 hover:text-ink-900',
                  )}
                >
                  <Check aria-hidden className="size-6" strokeWidth={3} />
                </button>
              </div>
              {set.error ? (
                <p role="alert" className="mt-1 px-2 text-xs font-semibold text-coral-700">
                  {set.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {!allDone ? (
          <button
            type="button"
            onClick={onCompleteAll}
            className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-line bg-white text-sm font-semibold text-ink-700 hover:border-ink-300 hover:text-ink-900"
          >
            <ListChecks aria-hidden className="size-4" /> Marcar todas como hechas
          </button>
        ) : null}
      </div>

      {exercise.effortFeedback ? (
        <EffortFeedback exercise={exercise} value={feedback} onChange={onFeedback} />
      ) : null}
    </article>
  );
}

/** RIR o RPE real del ejercicio, según lo prescrito. Opcional y autodeclarado. */
function EffortFeedback({
  exercise,
  value,
  onChange,
}: {
  exercise: ExerciseInSessionVM;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const isRir = exercise.effortFeedback === 'rir';
  const options = isRir ? [0, 1, 2, 3, 4, 5] : [5, 6, 7, 8, 9, 10];
  return (
    <fieldset className="mt-3 rounded-2xl bg-cream-50 p-3 ring-1 ring-line">
      <legend className="sr-only">
        {isRir ? 'Repeticiones en reserva' : 'Esfuerzo percibido'} de {exercise.name}
      </legend>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">
          {isRir ? '¿Cuántas repeticiones te quedaban? (RIR)' : '¿Cómo de duro ha sido? (RPE)'}
        </p>
        <OriginBadge origin="self_reported" />
      </div>
      <p className="mt-0.5 text-xs text-ink-500">
        Objetivo: {exercise.effortLabel}. {isRir ? '5 significa «5 o más».' : 'De 1 a 10.'}{' '}
        Opcional.
      </p>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              'grid h-10 cursor-pointer place-items-center rounded-xl text-sm font-bold ring-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink-900',
              value === option
                ? 'bg-ink-900 text-cream-50 ring-ink-900'
                : 'bg-white text-ink-900 ring-line hover:ring-ink-300',
            )}
          >
            <input
              type="radio"
              name={`esfuerzo-${exercise.prescriptionId}`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {isRir && option === 5 ? '5+' : option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SUMMARY_HEADINGS: Record<
  'completed' | 'partial' | 'missed',
  { title: string; tone: string }
> = {
  completed: { title: '¡Sesión completada!', tone: 'bg-sun-400' },
  partial: { title: 'Sesión terminada parcialmente', tone: 'bg-sun-100 ring-2 ring-sun-300' },
  missed: {
    title: 'Sesión terminada sin series registradas',
    tone: 'bg-cream-50 ring-1 ring-line',
  },
};

function SessionSummary({
  status,
  execution,
  volume,
  exercises,
  effort,
  onEffort,
  note,
  onNote,
  onBack,
}: {
  status: SessionStatus;
  execution: ExecutionSummary;
  volume: ReturnType<typeof summarizeVolume>;
  exercises: ExerciseInSessionVM[];
  effort: number | null;
  onEffort: (value: number) => void;
  note: string;
  onNote: (value: string) => void;
  onBack: () => void;
}) {
  const heading =
    SUMMARY_HEADINGS[
      status === 'completed' ? 'completed' : status === 'missed' ? 'missed' : 'partial'
    ];
  return (
    <section aria-labelledby="resumen" className="space-y-4">
      <div className={cn('rounded-[2rem] p-6 text-center shadow-lift', heading.tone)}>
        {status === 'completed' ? (
          <PartyPopper aria-hidden className="mx-auto size-10 text-ink-900" />
        ) : (
          <CircleDashed aria-hidden className="mx-auto size-10 text-sun-800" />
        )}
        <h2 id="resumen" className="mt-2 text-2xl font-extrabold text-ink-900">
          {heading.title}
        </h2>
        <div className="mt-2 flex justify-center">
          <SessionStatusBadge status={status} />
        </div>
        <p className="mt-2 text-ink-700">
          Has completado {execution.completedSets} de {execution.plannedSets} series y{' '}
          {execution.completedExercises} de {execution.plannedExercises} ejercicios
          {execution.startedExercises > 0 ? ` (${execution.startedExercises} a medias)` : ''}.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <h3 className="font-bold text-ink-900">Ejercicio a ejercicio</h3>
        <ul className="mt-2 divide-y divide-line">
          {execution.byExercise.map((item) => {
            const exercise = exercises.find((e) => e.prescriptionId === item.prescriptionId);
            const complete = item.completed >= item.planned;
            return (
              <li
                key={item.prescriptionId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {complete ? (
                    <CircleCheck aria-hidden className="size-4 shrink-0 text-leaf-700" />
                  ) : item.completed > 0 ? (
                    <CircleDashed aria-hidden className="size-4 shrink-0 text-sun-700" />
                  ) : (
                    <CircleMinus aria-hidden className="size-4 shrink-0 text-ink-300" />
                  )}
                  <span className="truncate text-ink-900">
                    <span className="font-semibold text-sun-700">{exercise?.slot}</span>{' '}
                    {exercise?.name}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-ink-700 tabular-nums">
                  {item.completed}/{item.planned} series
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-ink-900">Resumen</h3>
          <OriginBadge origin="calculated" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Series', formatNumber(volume.completedSets)],
            ['Repeticiones', formatNumber(volume.totalReps)],
            ['Tonelaje', `${formatNumber(volume.volumeLoadKg, 0)} kg`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream-50 p-3">
              <dt className="text-xs font-semibold text-ink-500">{label}</dt>
              <dd className="mt-1 font-display text-xl font-bold text-ink-900 tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-500">
          Calculado con {VOLUME_FORMULAS.volumeLoad.id} v{VOLUME_FORMULAS.volumeLoad.version}.
          {volume.setsWithoutExternalLoad > 0
            ? ` ${volume.setsWithoutExternalLoad} series sin carga externa no suman tonelaje.`
            : ''}
        </p>
      </div>

      <fieldset className="rounded-3xl bg-white p-5 shadow-soft">
        <legend className="sr-only">Esfuerzo percibido de la sesión</legend>
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-ink-900">¿Cómo de dura te ha parecido?</p>
          <OriginBadge origin="self_reported" />
        </div>
        <p className="mt-1 text-sm text-ink-500">De 0 (reposo) a 10 (esfuerzo máximo).</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, value) => (
            <label
              key={value}
              className={cn(
                'grid h-12 cursor-pointer place-items-center rounded-xl text-lg font-bold ring-1 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink-900',
                effort === value
                  ? 'bg-ink-900 text-cream-50 ring-ink-900'
                  : 'bg-cream-50 text-ink-900 ring-line hover:ring-ink-300',
              )}
            >
              <input
                type="radio"
                name="esfuerzo"
                value={value}
                checked={effort === value}
                onChange={() => isValidPerceivedEffort(value) && onEffort(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <label htmlFor="observaciones" className="font-bold text-ink-900">
          Observaciones para tu entrenador
        </label>
        <p className="mt-0.5 text-sm text-ink-500">
          Molestias, sensaciones, cambios que hayas hecho… (opcional)
        </p>
        <textarea
          id="observaciones"
          value={note}
          maxLength={500}
          rows={3}
          onChange={(event) => onNote(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-line bg-cream-50 p-3 text-ink-900 placeholder:text-ink-500 focus:border-ink-300"
          placeholder="Escribe aquí"
        />
        <p className="text-right text-xs text-ink-500">{note.length}/500</p>
      </div>

      <p className="rounded-2xl bg-cream-50 p-3 text-center text-sm text-ink-500 ring-1 ring-line">
        Demostración: este registro y tus observaciones no se guardan ni se envían. Con la base de
        datos, llegarán a tu entrenador.
      </p>
      <div className="grid gap-2">
        <Link
          href="/cliente"
          className="flex h-14 items-center justify-center rounded-3xl bg-ink-900 font-bold text-cream-50 hover:bg-ink-700"
        >
          Volver a Hoy
        </Link>
        <button
          type="button"
          onClick={onBack}
          className="h-12 rounded-3xl font-semibold text-ink-700 hover:bg-cream-200"
        >
          Seguir editando la sesión
        </button>
      </div>
    </section>
  );
}
