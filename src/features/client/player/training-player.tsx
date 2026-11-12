'use client';

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CloudOff,
  CloudUpload,
  ExternalLink,
  Flag,
  Gauge,
  ListChecks,
  LoaderCircle,
  MessageCircle,
  PencilLine,
  Play,
  RefreshCw,
  Timer,
  TriangleAlert,
  Weight,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type PlayerItemVM, type PlayerSetVM, type PlayerVM } from '@/contracts/execution';
import { formatDate } from '@/domain/format';
import { describePerformed, type PerformedSetInput } from '@/domain/training/performance';
import { reviewExecution } from '@/domain/training/review';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { ExecutionReview, durationText } from '@/features/shared/execution-review';
import { Meter } from '@/ui/meter';
import { cn } from '@/ui/cn';
import { openLocalStore, type LocalStore } from './local-store';
import {
  asSetLogs,
  deviceNow,
  executionFlags,
  type LocalRecord,
  mergeSets,
  newCommandId,
  type SetEntry,
  setKey,
} from './player-model';
import { RestPanel } from './rest-panel';
import { SetForm } from './set-form';
import { useExecutionSync } from './use-execution-sync';
import { useRestTimer } from './use-rest-timer';

const SYNC_LABEL = {
  queued: 'Pendiente de envío',
  sending: 'Enviando…',
  confirmed: 'Confirmada',
  error: 'Error de envío',
} as const;

function SetStatusIcon({ entry }: { entry: SetEntry | undefined }) {
  if (!entry?.record) return <CircleDashed aria-hidden className="size-5 text-ink-300" />;
  if (entry.sync === 'error')
    return <TriangleAlert aria-hidden className="size-5 text-coral-700" />;
  if (entry.sync === 'sending')
    return (
      <LoaderCircle
        aria-hidden
        className="size-5 animate-spin text-sky-700 motion-reduce:animate-none"
      />
    );
  if (entry.sync === 'queued') return <CloudUpload aria-hidden className="size-5 text-sky-700" />;
  if (!entry.record.completed) return <CircleMinus aria-hidden className="size-5 text-ink-500" />;
  if (entry.record.supersedes) return <PencilLine aria-hidden className="size-5 text-plum-700" />;
  return <CircleCheck aria-hidden className="size-5 text-leaf-700" />;
}

/** Primera serie sin registro (o con error) de un ejercicio. */
const firstOpenSet = (item: PlayerItemVM, entries: Map<string, SetEntry>) =>
  item.sets.find((s) => {
    const entry = entries.get(setKey(item.id, s.setNumber));
    return !entry?.record || entry.sync === 'error';
  }) ?? null;

const nextLabel = (item: PlayerItemVM, set: PlayerSetVM, sameExercise: boolean) =>
  sameExercise
    ? `Serie ${set.setNumber} de ${item.sets.length} · ${set.repsLabel}${set.loadLabel !== 'Sin carga' ? ` × ${set.loadLabel}` : ''}${set.effortLabel ? ` · ${set.effortLabel}` : ''}`
    : `${item.name} · ${item.sets.length} × ${set.repsLabel}${set.loadLabel !== 'Sin carga' ? ` · ${set.loadLabel}` : ''}`;

/**
 * Reproductor de entrenamiento (B3–B6 del bloque 2). Cada acción es un comando que se guarda en
 * el dispositivo y se envía al servidor; la interfaz distingue siempre lo pendiente de envío de
 * lo confirmado por el servidor.
 */
export function TrainingPlayer({ vm }: { vm: PlayerVM }) {
  const router = useRouter();
  const sync = useExecutionSync(vm.sessionId, vm.state);
  const [store, setStore] = useState<LocalStore | null>(null);
  useEffect(() => {
    void openLocalStore().then(setStore);
  }, []);
  const timer = useRestTimer(store, `descanso:${vm.sessionId}`);

  const entries = useMemo(
    () => mergeSets(sync.serverState, sync.queue),
    [sync.serverState, sync.queue],
  );
  const flags = executionFlags(sync.serverState, sync.queue);
  const allSets = vm.items.flatMap((item) => item.sets.map((s) => ({ item, set: s })));
  const registered = allSets.filter(
    ({ item, set }) => entries.get(setKey(item.id, set.setNumber))?.record,
  );
  const doneCount = registered.filter(
    ({ item, set }) => entries.get(setKey(item.id, set.setNumber))?.record?.completed,
  ).length;
  const pendingCount = allSets.length - registered.length;

  // Ejercicio visible: el guardado (se recupera al volver) o el primero con series pendientes.
  const positionKey = `posicion:${vm.sessionId}`;
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState<LocalRecord | null>(null);
  const [resumeNote, setResumeNote] = useState<string | null>(null);
  useEffect(() => {
    if (!store || itemIndex !== null) return;
    void store.getUi<number>(positionKey).then((saved) => {
      const firstOpen = vm.items.findIndex((item) => firstOpenSet(item, entries));
      const index = saved !== undefined && saved < vm.items.length ? saved : Math.max(0, firstOpen);
      setItemIndex(index);
      if (saved !== undefined && flags.started && !flags.finished) {
        const item = vm.items[index]!;
        const open = firstOpenSet(item, entries);
        setResumeNote(`Seguimos en ${item.name}${open ? `, serie ${open.setNumber}` : ''}.`);
      }
    });
    // Solo al cargar: la posición inicial no debe recalcularse con cada registro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  const goTo = (index: number) => {
    setItemIndex(index);
    setFocus(null);
    setCorrecting(null);
    void store?.setUi(positionKey, index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sessionDialog = useRef<HTMLDialogElement>(null);
  const finishDialog = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState('');

  const send = (command: Parameters<typeof sync.enqueue>[0]) => void sync.enqueue(command);

  const start = () =>
    send({
      commandId: newCommandId(),
      type: 'start',
      versionNumber: vm.version,
      device: deviceNow(),
    });

  const [leaving, setLeaving] = useState(false);
  const pauseAndLeave = async () => {
    setLeaving(true);
    timer.skip();
    if (flags.started && !flags.finished && !flags.paused) {
      // Se intenta enviar antes de salir; si no hay conexión, queda en el móvil.
      await sync.sendNow({ commandId: newCommandId(), type: 'pause', device: deviceNow() });
    }
    router.push('/cliente');
  };

  const finish = (confirmEndEarly: boolean) => {
    finishDialog.current?.close();
    timer.skip();
    send({
      commandId: newCommandId(),
      type: 'finish',
      confirmEndEarly,
      comment: comment.trim() === '' ? null : comment.trim(),
      device: deviceNow(),
    });
  };

  const versionChanged = sync.serverState.currentVersion > vm.version;

  // ── Pantallas ──────────────────────────────────────────────────────────────

  const syncBar = (
    <SyncBar
      summary={sync.summary}
      online={sync.online}
      storage={sync.storage}
      count={sync.queue.length}
      errors={sync.queue.filter((e) => e.status === 'error').length}
      onRetry={sync.retryNow}
    />
  );

  if (!sync.ready || itemIndex === null) {
    return (
      <p className="mt-10 flex items-center justify-center gap-2 text-ink-500" role="status">
        <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />{' '}
        Preparando tu sesión…
      </p>
    );
  }

  if (!flags.started) {
    return <StartScreen vm={vm} onStart={start} syncBar={syncBar} />;
  }

  if (flags.finished) {
    const review = reviewExecution({
      status: sync.serverState.status,
      currentVersion: vm.version,
      versions: new Map([[vm.version, vm.content]]),
      log: sync.serverState.startedAt
        ? {
            startedVersion: sync.serverState.startedVersion ?? vm.version,
            startedAt: sync.serverState.startedAt,
            ...(sync.serverState.finishedAt ? { finishedAt: sync.serverState.finishedAt } : {}),
            pausedSeconds: 0,
          }
        : null,
      setLogs: asSetLogs(sync.serverState, sync.queue, vm.sessionId),
      exercise: (variantId, name) => {
        const item = vm.items.find((i) => i.variantId === variantId);
        return { name: name ?? item?.name ?? 'Ejercicio', silhouette: item?.silhouette ?? 'squat' };
      },
    });
    const allDone = review.completedSets === review.plannedSets;
    return (
      <div className="space-y-4">
        {syncBar}
        <header className="rounded-[2rem] bg-sun-400 p-6 shadow-lift">
          <p className="text-sm font-bold tracking-wide text-ink-900/70 uppercase">
            {vm.label ? `${vm.label} · ` : ''}
            {vm.title}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink-900">
            {allDone ? '¡Sesión completada!' : 'Sesión terminada parcialmente'}
          </h1>
          <p className="mt-2 font-semibold text-ink-900">
            {review.completedSets} de {review.plannedSets} series hechas
            {review.notDoneSets > 0
              ? ` · ${review.notDoneSets} no ${review.notDoneSets === 1 ? 'realizada' : 'realizadas'}`
              : ''}
            {review.pendingSets > 0 ? ` · ${review.pendingSets} sin registrar` : ''}
          </p>
          {sync.serverState.finishedAt && sync.serverState.startedAt ? (
            <p className="mt-1 text-sm text-ink-700">
              Duración:{' '}
              {durationText({
                elapsedSeconds: Math.round(
                  (Date.parse(sync.serverState.finishedAt) -
                    Date.parse(sync.serverState.startedAt)) /
                    1000,
                ),
                pausedSeconds: 0,
              })}{' '}
              (de la hora de inicio a la de fin)
            </p>
          ) : null}
        </header>
        {flags.finishPending ? (
          <p className="flex gap-2 rounded-2xl border border-sky-100 bg-sky-100/60 p-3 text-sm text-sky-700">
            <CloudUpload aria-hidden className="mt-0.5 size-4 shrink-0" />
            Terminada en este móvil: se guardará en el servidor en cuanto haya conexión. No borres
            los datos del navegador hasta ver «Todo guardado».
          </p>
        ) : null}
        <ExecutionReview
          review={review}
          audience="client"
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        />
        {sync.serverState.comment ? (
          <p className="flex gap-2 rounded-3xl bg-white p-4 text-sm text-ink-700 shadow-soft">
            <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-700" />
            <span>
              <span className="font-bold text-ink-900">
                Tu mensaje para {vm.trainerFirstName}:{' '}
              </span>
              {sync.serverState.comment}
            </span>
          </p>
        ) : null}
        <Link
          href="/cliente"
          className="flex h-14 items-center justify-center rounded-3xl bg-ink-900 font-bold text-cream-50 hover:bg-ink-700"
        >
          Volver a Hoy
        </Link>
      </div>
    );
  }

  const item = vm.items[itemIndex]!;
  const open = firstOpenSet(item, entries);
  const focusedSet =
    item.sets.find((s) => s.setNumber === (correcting ? focus : (focus ?? open?.setNumber))) ??
    null;
  const currentTarget = focusedSet ?? open ?? item.sets.at(-1)!;
  const itemDone = item.sets.filter(
    (s) => entries.get(setKey(item.id, s.setNumber))?.record?.completed,
  ).length;

  /** Tras registrar una serie: siguiente serie o ejercicio, y descanso si toca. */
  const afterLog = (set: PlayerSetVM) => {
    const keyNow = setKey(item.id, set.setNumber);
    const remaining = allSets.filter(
      ({ item: i, set: s }) =>
        setKey(i.id, s.setNumber) !== keyNow && !entries.get(setKey(i.id, s.setNumber))?.record,
    );
    const nextInItem =
      remaining.find(({ item: i, set: s }) => i.id === item.id && s.setNumber > set.setNumber) ??
      remaining.find(({ item: i }) => i.id === item.id);
    const nextOverall =
      nextInItem ??
      remaining.find(({ item: i }) => vm.items.indexOf(i) > itemIndex) ??
      remaining[0];
    setFocus(null);
    if (!nextInItem && nextOverall) goTo(vm.items.indexOf(nextOverall.item));
    if (nextOverall && set.target.restSeconds > 0) {
      timer.start(
        set.target.restSeconds,
        nextLabel(nextOverall.item, nextOverall.set, !!nextInItem),
      );
    }
    if (!nextOverall) {
      timer.skip();
      finishDialog.current?.showModal();
    }
  };

  const logSet = (set: PlayerSetVM, input: PerformedSetInput) => {
    const supersedes = correcting?.clientSetId ?? null;
    send({
      commandId: newCommandId(),
      type: 'log_set',
      versionNumber: vm.version,
      prescriptionId: item.id,
      setNumber: set.setNumber,
      supersedes,
      completed: input.completed,
      reps: input.reps ?? null,
      durationS: input.durationS ?? null,
      distanceM: input.distanceM ?? null,
      load: input.completed ? (input.load ?? null) : null,
      rir: input.rir ?? null,
      rpe: input.rpe ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
      device: deviceNow(),
    });
    if (correcting) {
      setCorrecting(null);
      setFocus(null);
    } else {
      afterLog(set);
    }
  };

  const showForm = !timer.rest && (correcting !== null || open !== null || focus !== null);

  return (
    <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      {/* Cabecera fija: pausar, ejercicio X de Y, tu sesión y progreso. */}
      <div className="sticky top-0 z-20 -mx-4 bg-cream-100/95 px-4 pt-2 pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void pauseAndLeave()}
            disabled={leaving}
            aria-label="Pausar la sesión y volver a Hoy"
            className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl pr-2 text-sm font-semibold text-ink-700 hover:text-ink-900 disabled:opacity-50"
          >
            <X aria-hidden className="size-5" /> Pausar
          </button>
          <p className="min-w-0 truncate text-sm font-bold text-ink-900">
            {vm.label ? `${vm.label} · ` : ''}
            {vm.title}
          </p>
          <button
            type="button"
            onClick={() => sessionDialog.current?.showModal()}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl pl-2 text-sm font-semibold text-ink-700 hover:text-ink-900"
          >
            <ListChecks aria-hidden className="size-5" /> {itemIndex + 1} / {vm.items.length}
            <span className="sr-only">: tu sesión</span>
          </button>
        </div>
        <p className="mt-1 text-sm font-semibold text-ink-700" aria-live="polite">
          {doneCount} de {allSets.length} series
        </p>
        <Meter
          className="mt-1"
          value={doneCount}
          max={allSets.length}
          label="Series hechas"
          tone="leaf"
        />
      </div>

      {syncBar}

      {sync.notice ? (
        <p
          role="status"
          className="flex items-start justify-between gap-2 rounded-2xl bg-sky-100/60 p-3 text-sm text-sky-700"
        >
          {sync.notice}
          <button
            type="button"
            onClick={sync.dismissNotice}
            aria-label="Cerrar aviso"
            className="shrink-0"
          >
            <X aria-hidden className="size-4" />
          </button>
        </p>
      ) : null}

      {versionChanged ? (
        <div className="rounded-2xl border-2 border-sun-400 bg-sun-100 p-4 text-sm text-ink-700">
          <p className="font-bold text-ink-900">{vm.trainerFirstName} ha actualizado la sesión</p>
          <p className="mt-0.5">
            Lo que ya has registrado no cambia. Mientras no la abras, sigues con la versión que
            tienes en pantalla.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ink-900 px-3 font-semibold text-cream-50"
          >
            <RefreshCw aria-hidden className="size-4" /> Ver la versión nueva
          </button>
        </div>
      ) : null}

      {flags.paused ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink-900">Sesión en pausa</p>
          <button
            type="button"
            onClick={() => send({ commandId: newCommandId(), type: 'resume', device: deviceNow() })}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-sun-400 px-4 font-bold text-ink-900"
          >
            <Play aria-hidden className="size-4" /> Reanudar
          </button>
        </div>
      ) : null}

      {resumeNote ? (
        <p
          role="status"
          className="flex items-start justify-between gap-2 rounded-2xl bg-white p-3 text-sm font-semibold text-ink-900 shadow-soft"
        >
          {resumeNote}
          <button
            type="button"
            onClick={() => setResumeNote(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 text-ink-500"
          >
            <X aria-hidden className="size-4" />
          </button>
        </p>
      ) : null}

      {/* B3 · Ejercicio actual. */}
      <section aria-labelledby="ejercicio-actual" className="rounded-3xl bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-cream-100">
            <ExercisePictogram silhouette={item.silhouette} className="size-16" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-sun-700">
              {item.slot} · Ejercicio {itemIndex + 1} de {vm.items.length}
            </p>
            <h1
              id="ejercicio-actual"
              className="text-2xl leading-tight font-extrabold text-ink-900"
            >
              {item.name}
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-ink-700">
              {item.sets.length} series · {itemDone} {itemDone === 1 ? 'hecha' : 'hechas'}
            </p>
          </div>
        </div>

        {/* Lo prescrito para la serie actual: carga y esfuerzo en grande. */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-3xl bg-sun-100 p-4">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold tracking-wide text-ink-700 uppercase">
              <Weight aria-hidden className="size-3.5" /> Carga
            </p>
            <p className="font-display text-2xl leading-tight font-extrabold text-ink-900">
              {currentTarget.loadLabel}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs font-bold tracking-wide text-ink-700 uppercase">
              <Gauge aria-hidden className="size-3.5" /> Esfuerzo
            </p>
            <p className="font-display text-2xl leading-tight font-extrabold text-ink-900">
              {currentTarget.effortLabel ?? 'Sin objetivo'}
            </p>
          </div>
          <p className="col-span-2 text-sm font-semibold text-ink-900">
            Serie {currentTarget.setNumber}: {currentTarget.repsLabel}
            {' · '}
            <Timer aria-hidden className="inline size-4" /> Descanso {currentTarget.restLabel}
            {currentTarget.tempoLabel ? ` · Tempo ${currentTarget.tempoLabel}` : ''}
          </p>
          {currentTarget.note ? (
            <p className="col-span-2 text-sm text-ink-700">{currentTarget.note}</p>
          ) : null}
        </div>

        {item.clientNote ? (
          <p className="mt-3 border-l-4 border-sun-400 pl-3 text-sm text-ink-700">
            <span className="font-bold text-ink-900">Indicación de {vm.trainerFirstName}: </span>
            {item.clientNote}
          </p>
        ) : null}

        <details className="group mt-3 rounded-2xl bg-cream-50 ring-1 ring-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-ink-900">
            Cómo se hace
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="space-y-2 px-3.5 pb-3.5 text-sm text-ink-700">
            {item.summary ? <p>{item.summary}</p> : null}
            {item.steps.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
            {item.cues.length > 0 ? (
              <p>
                <span className="font-semibold text-ink-900">Claves: </span>
                {item.cues.join(' · ')}
              </p>
            ) : null}
            {item.videoUrl ? (
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 font-semibold text-sun-800"
              >
                Ver vídeo <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : (
              <p className="text-ink-500">
                Sin vídeo todavía: guíate por la silueta y las instrucciones.
              </p>
            )}
          </div>
        </details>

        {/* Series del ejercicio. */}
        <ol className="mt-3 divide-y divide-line" aria-label={`Series de ${item.name}`}>
          {item.sets.map((set) => {
            const entry = entries.get(setKey(item.id, set.setNumber));
            const record = entry?.record ?? null;
            const canCorrect = entry?.sync === 'confirmed' && !!record;
            const isFocus = !correcting && (focus ?? open?.setNumber) === set.setNumber && !record;
            return (
              <li key={set.setNumber} className={cn('py-2', isFocus ? 'font-semibold' : '')}>
                <div className="flex items-center gap-2.5">
                  <SetStatusIcon entry={entry} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-ink-900">
                      Serie {set.setNumber}
                      <span className="ml-2 font-normal text-ink-500">
                        {set.repsLabel}
                        {set.loadLabel !== 'Sin carga' ? ` × ${set.loadLabel}` : ''}
                        {set.effortLabel ? ` · ${set.effortLabel}` : ''}
                      </span>
                    </p>
                    {record ? (
                      <p className="text-ink-700">
                        Hecho:{' '}
                        <span className="font-semibold text-ink-900">
                          {describePerformed(record)}
                        </span>
                        <span
                          className={cn(
                            'ml-2 text-xs font-semibold',
                            entry?.sync === 'error'
                              ? 'text-coral-700'
                              : entry?.sync === 'confirmed'
                                ? 'text-leaf-700'
                                : 'text-sky-700',
                          )}
                        >
                          {entry?.sync ? SYNC_LABEL[entry.sync] : ''}
                        </span>
                      </p>
                    ) : null}
                    {entry?.sync === 'error' && entry.error ? (
                      <p className="mt-0.5 text-xs text-coral-700">
                        {entry.error.message}
                        {entry.commandId ? (
                          <button
                            type="button"
                            onClick={() => void sync.discard(entry.commandId!)}
                            className="ml-2 font-bold underline"
                          >
                            Descartar y volver a registrar
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  {canCorrect ? (
                    <button
                      type="button"
                      onClick={() => {
                        timer.skip();
                        setFocus(set.setNumber);
                        setCorrecting(record);
                      }}
                      className="min-h-11 shrink-0 rounded-xl px-2 text-xs font-bold text-sun-800 hover:bg-cream-100"
                    >
                      Corregir<span className="sr-only"> serie {set.setNumber}</span>
                    </button>
                  ) : !record && !isFocus ? (
                    <button
                      type="button"
                      onClick={() => {
                        timer.skip();
                        setCorrecting(null);
                        setFocus(set.setNumber);
                      }}
                      className="min-h-11 shrink-0 rounded-xl px-2 text-xs font-bold text-ink-500 hover:bg-cream-100"
                    >
                      Registrar<span className="sr-only"> serie {set.setNumber}</span>
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {timer.rest ? <RestPanel timer={timer} /> : null}

      {showForm && focusedSet ? (
        <SetForm
          key={`${item.id}-${focusedSet.setNumber}-${correcting?.clientSetId ?? 'nuevo'}`}
          set={focusedSet}
          totalSets={item.sets.length}
          exerciseName={item.name}
          correcting={correcting}
          disabled={!sync.ready}
          onDone={(input) => logSet(focusedSet, input)}
          onSkip={(note) => logSet(focusedSet, { completed: false, note })}
          {...(correcting || focus !== null
            ? {
                onCancel: () => {
                  setCorrecting(null);
                  setFocus(null);
                },
              }
            : {})}
        />
      ) : null}

      {!open && !timer.rest && !correcting ? (
        <p className="flex items-center gap-2 rounded-2xl bg-leaf-100 p-4 font-semibold text-leaf-700">
          <CircleCheck aria-hidden className="size-5" /> {item.name}: todas las series registradas.
        </p>
      ) : null}

      {/* Navegación entre ejercicios y terminar. */}
      <nav aria-label="Ejercicios" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={itemIndex === 0}
          onClick={() => goTo(itemIndex - 1)}
          className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-line bg-white font-semibold text-ink-900 disabled:opacity-40"
        >
          <ArrowLeft aria-hidden className="size-4" /> Anterior
        </button>
        {itemIndex < vm.items.length - 1 ? (
          <button
            type="button"
            onClick={() => goTo(itemIndex + 1)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-line bg-white font-semibold text-ink-900"
          >
            Siguiente ejercicio <ArrowRight aria-hidden className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => finishDialog.current?.showModal()}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-ink-900 font-semibold text-cream-50"
          >
            <Flag aria-hidden className="size-4" /> Terminar
          </button>
        )}
      </nav>

      <dialog
        ref={sessionDialog}
        aria-labelledby="tu-sesion"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-white p-5 shadow-lift backdrop:bg-ink-900/40"
      >
        <div className="flex items-center justify-between">
          <h2 id="tu-sesion" className="text-xl font-extrabold text-ink-900">
            Tu sesión
          </h2>
          <button
            type="button"
            onClick={() => sessionDialog.current?.close()}
            aria-label="Cerrar"
            className="grid size-11 place-items-center rounded-xl hover:bg-cream-100"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <ol className="mt-3 divide-y divide-line">
          {vm.items.map((it, index) => {
            const done = it.sets.filter(
              (s) => entries.get(setKey(it.id, s.setNumber))?.record?.completed,
            ).length;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => {
                    sessionDialog.current?.close();
                    goTo(index);
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between gap-2 py-2 text-left',
                    index === itemIndex ? 'font-bold' : '',
                  )}
                >
                  <span className="min-w-0 truncate text-ink-900">
                    {it.slot} · {it.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold',
                      done === it.sets.length ? 'text-leaf-700' : 'text-ink-500',
                    )}
                  >
                    {done}/{it.sets.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => {
            sessionDialog.current?.close();
            finishDialog.current?.showModal();
          }}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-ink-900 font-semibold text-cream-50"
        >
          <Flag aria-hidden className="size-4" /> Terminar sesión
        </button>
      </dialog>

      <dialog
        ref={finishDialog}
        aria-labelledby="terminar-titulo"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-white p-5 shadow-lift backdrop:bg-ink-900/40"
      >
        <h2 id="terminar-titulo" className="text-xl font-extrabold text-ink-900">
          {pendingCount > 0
            ? `Te quedan ${pendingCount} ${pendingCount === 1 ? 'serie' : 'series'} sin registrar`
            : 'Terminar la sesión'}
        </h2>
        <p className="mt-1 text-sm text-ink-700">
          {pendingCount > 0
            ? 'Puedes seguir entrenando o terminar ahora: la sesión quedará como cerrada parcialmente y las series sin registrar, pendientes.'
            : `Has registrado todas las series. Puedes dejar un mensaje para ${vm.trainerFirstName}.`}
        </p>
        <label className="mt-3 block text-sm font-semibold text-ink-900">
          Mensaje para {vm.trainerFirstName}{' '}
          <span className="font-normal text-ink-500">(opcional)</span>
          <textarea
            value={comment}
            maxLength={500}
            rows={3}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-line bg-white p-3 font-normal text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-sun-500"
          />
        </label>
        <div className="mt-4 grid gap-2">
          {pendingCount > 0 ? (
            <>
              <button
                type="button"
                onClick={() => finishDialog.current?.close()}
                className="h-12 rounded-2xl bg-sun-400 font-bold text-ink-900"
              >
                Seguir entrenando
              </button>
              <button
                type="button"
                onClick={() => finish(true)}
                className="h-12 rounded-2xl border border-line bg-white font-semibold text-ink-900"
              >
                Terminar igualmente (cierre parcial)
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => finish(false)}
                className="h-12 rounded-2xl bg-ink-900 font-bold text-cream-50"
              >
                Terminar sesión
              </button>
              <button
                type="button"
                onClick={() => finishDialog.current?.close()}
                className="h-12 rounded-2xl font-semibold text-ink-700"
              >
                Volver
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function StartScreen({
  vm,
  onStart,
  syncBar,
}: {
  vm: PlayerVM;
  onStart: () => void;
  syncBar: React.ReactNode;
}) {
  const otherDay = vm.plannedDate !== vm.today;
  const sets = vm.items.reduce((sum, item) => sum + item.sets.length, 0);
  return (
    <div className="space-y-4 pb-8">
      <Link
        href={`/cliente/sesion/${vm.sessionId}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-700"
      >
        <ArrowLeft aria-hidden className="size-4" /> Detalle de la sesión
      </Link>
      {syncBar}
      <header className="rounded-[2rem] bg-sun-400 p-6 shadow-lift">
        <p className="text-sm font-bold tracking-wide text-ink-900/70 uppercase">
          {vm.label ?? 'Tu sesión'}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink-900">{vm.title}</h1>
        <p className="mt-1 text-ink-700">{vm.focus}</p>
        <p className="mt-3 text-sm font-semibold text-ink-900">
          {vm.items.length} {vm.items.length === 1 ? 'ejercicio' : 'ejercicios'} · {sets} series
          {vm.estimatedMinutes ? ` · ${vm.estimatedMinutes} min` : ''}
        </p>
      </header>
      {vm.coachNote ? (
        <p className="flex gap-2 rounded-3xl bg-white p-4 text-sm text-ink-700 shadow-soft">
          <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-700" />
          <span>
            <span className="font-bold text-ink-900">Nota de {vm.trainerFirstName}: </span>
            {vm.coachNote}
          </span>
        </p>
      ) : null}
      <ol className="divide-y divide-line rounded-3xl bg-white px-4 shadow-soft">
        {vm.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3">
            <span className="font-semibold text-ink-900">
              {item.slot} · {item.name}
            </span>
            <span className="shrink-0 text-sm font-semibold text-ink-500">
              {item.sets.length} × {item.sets[0]?.repsLabel}
            </span>
          </li>
        ))}
      </ol>
      {vm.otherActive ? (
        <p className="rounded-2xl border border-sun-300 bg-sun-100 p-3 text-sm text-ink-700">
          Tienes «{vm.otherActive.name}» a medias. Podrás continuarla después.
        </p>
      ) : null}
      {otherDay ? (
        <p className="text-center text-sm text-ink-700">
          Prevista para el {formatDate(vm.plannedDate, 'long')}. ¿Empezar ahora?
        </p>
      ) : null}
      <button
        type="button"
        onClick={onStart}
        className="flex h-16 w-full items-center justify-center gap-2 rounded-3xl bg-ink-900 text-lg font-bold text-cream-50 hover:bg-ink-700"
      >
        <Play aria-hidden className="size-5" />{' '}
        {vm.otherActive ? 'Empezar igualmente' : 'Empezar entrenamiento'}
      </button>
    </div>
  );
}

/** Estado de sincronización: comprensible y sin saturar (una línea). */
function SyncBar({
  summary,
  online,
  storage,
  count,
  errors,
  onRetry,
}: {
  summary: 'idle' | 'pending' | 'sending' | 'error';
  online: boolean;
  storage: 'indexeddb' | 'memory' | null;
  count: number;
  errors: number;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2">
      {storage === 'memory' ? (
        <p
          role="alert"
          className="flex gap-2 rounded-2xl border border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-700"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Este navegador no puede guardar temporalmente: no cierres la página hasta ver «Todo
          guardado».
        </p>
      ) : null}
      <p
        role="status"
        className={cn(
          'flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold',
          summary === 'idle'
            ? 'text-leaf-700'
            : summary === 'error'
              ? 'bg-coral-100 text-coral-700'
              : 'bg-sky-100/70 text-sky-700',
        )}
      >
        {summary === 'idle' ? (
          <>
            <CircleCheck aria-hidden className="size-4" /> Todo guardado en el servidor
          </>
        ) : summary === 'sending' ? (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />{' '}
            Enviando…
          </>
        ) : summary === 'error' ? (
          <>
            <TriangleAlert aria-hidden className="size-4" /> {errors}{' '}
            {errors === 1 ? 'registro con error' : 'registros con error'} de envío
          </>
        ) : (
          <>
            {online ? (
              <CloudUpload aria-hidden className="size-4" />
            ) : (
              <CloudOff aria-hidden className="size-4" />
            )}
            {count} pendiente{count === 1 ? '' : 's'} de envío{online ? '' : ' · sin conexión'}
          </>
        )}
        {summary === 'pending' || summary === 'error' ? (
          <button
            type="button"
            onClick={onRetry}
            className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-bold underline"
          >
            <RefreshCw aria-hidden className="size-3.5" /> Reintentar
          </button>
        ) : null}
      </p>
    </div>
  );
}
