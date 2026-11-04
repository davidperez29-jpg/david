'use client';

import {
  Check,
  ChevronDown,
  Clock,
  PartyPopper,
  Plus,
  SkipForward,
  VideoOff,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { type ExerciseInSessionVM, type SessionDetailVM } from '@/contracts/shared';
import { formatClock, formatNumber } from '@/domain/format';
import { summarizeVolume, VOLUME_FORMULAS } from '@/domain/training/volume';
import { PatternPictogram } from '@/features/brand/pictogram';
import { OriginBadge } from '@/features/shared/provenance';
import { PrescriptionChips } from '@/features/shared/prescription';
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
  const [effort, setEffort] = useState<number | null>(null);

  const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const doneSets = Object.values(records)
    .flat()
    .filter((set) => set.done).length;

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
    setRecords((current) => ({
      ...current,
      [prescriptionId]: current[prescriptionId]!.map((set, i) =>
        i === index ? { ...set, ...patch } : set,
      ),
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

  const summary = useMemo(
    () =>
      summarizeVolume(
        session.exercises.flatMap((exercise) =>
          records[exercise.prescriptionId]!.map((set) => ({
            completed: set.done,
            reps: exercise.repUnit === 'reps' && set.done ? parseNumber(set.reps) : 0,
            loadKg:
              exercise.tracksLoadKg && set.done && set.kg.trim() !== ''
                ? parseNumber(set.kg)
                : null,
          })),
        ),
      ),
    [records, session.exercises],
  );

  if (finished) {
    return (
      <SessionSummary
        summary={summary}
        totalSets={totalSets}
        effort={effort}
        onEffort={setEffort}
        onBack={() => setFinished(false)}
      />
    );
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 bg-cream-100/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="text-ink-700">Progreso</span>
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
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => {
          setRest(null);
          setFinished(true);
          window.scrollTo({ top: 0 });
        }}
        className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 hover:bg-ink-700"
      >
        <Check aria-hidden className="size-5" /> Terminar sesión
      </button>
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
}: {
  exercise: ExerciseInSessionVM;
  sets: SetState[];
  onChange: (index: number, patch: Partial<SetState>) => void;
  onToggle: (index: number, at: number) => void;
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
          <PatternPictogram pattern={exercise.pattern} className="size-12" />
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
      </div>
    </article>
  );
}

function SessionSummary({
  summary,
  totalSets,
  effort,
  onEffort,
  onBack,
}: {
  summary: ReturnType<typeof summarizeVolume>;
  totalSets: number;
  effort: number | null;
  onEffort: (value: number) => void;
  onBack: () => void;
}) {
  return (
    <section aria-labelledby="resumen" className="space-y-4">
      <div className="rounded-[2rem] bg-sun-400 p-6 text-center shadow-lift">
        <PartyPopper aria-hidden className="mx-auto size-10 text-ink-900" />
        <h2 id="resumen" className="mt-2 text-2xl font-extrabold text-ink-900">
          ¡Sesión terminada!
        </h2>
        <p className="mt-1 text-ink-700">
          Has completado {summary.completedSets} de {totalSets} series.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-ink-900">Resumen</h3>
          <OriginBadge origin="calculated" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Series', formatNumber(summary.completedSets)],
            ['Repeticiones', formatNumber(summary.totalReps)],
            ['Tonelaje', `${formatNumber(summary.volumeLoadKg, 0)} kg`],
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
          {summary.setsWithoutExternalLoad > 0
            ? ` ${summary.setsWithoutExternalLoad} series sin carga externa no suman tonelaje.`
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
                onChange={() => onEffort(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="rounded-2xl bg-cream-50 p-3 text-center text-sm text-ink-500 ring-1 ring-line">
        Demostración: este registro no se guarda. Con la base de datos, llegará a tu entrenador.
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
