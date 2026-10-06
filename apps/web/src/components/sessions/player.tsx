'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerSession } from '@tp/application';
import { BodyMap } from '@/components/library/body-map';
import { Button } from '@/components/ui/button';
import { LABELS } from '@/lib/labels';
import {
  enqueue,
  flush,
  newMutationId,
  onChange,
  onResults,
  pending,
  wireAutoSync,
  type SyncResult,
} from '@/lib/offline-queue';

/**
 * Session player (§9.3): one page, one-tap logging (✓ logs the preloaded set), RIR chips, rest
 * timer, "No puedo hacer este ejercicio" and a closing sheet. Every action goes through the
 * offline queue first, so it works without connection and syncs later without duplicates.
 */

const PAIN_MESSAGE = 'Si el dolor persiste o es intenso, consulta con un profesional sanitario.';
const SRPE: { value: number; label: string }[] = [
  { value: 0, label: 'Reposo' },
  { value: 1, label: 'Muy, muy fácil' },
  { value: 2, label: 'Fácil' },
  { value: 3, label: 'Moderado' },
  { value: 4, label: 'Algo duro' },
  { value: 5, label: 'Duro' },
  { value: 6, label: '' },
  { value: 7, label: 'Muy duro' },
  { value: 8, label: '' },
  { value: 9, label: '' },
  { value: 10, label: 'Máximo' },
];
const RIR_CHIPS = [0, 1, 2, 3, 4];
/** «¿Cómo fue?» as in the user's own documents (restructure phase 8). */
const FEEL = [
  ['easy', 'Fácil'],
  ['normal', 'Normal'],
  ['hard', 'Difícil'],
  ['very_hard', 'Muy difícil'],
] as const;
const DISCOMFORT = [
  ['none', 'No'],
  ['some', 'Algo'],
  ['a_lot', 'Mucho'],
] as const;
type Feel = (typeof FEEL)[number][0];
type Discomfort = (typeof DISCOMFORT)[number][0];

type Exercise = PlayerSession['blocks'][number]['exercises'][number];
type Sync = 'synced' | 'pending' | 'flagged' | 'error';
interface SetState {
  loadKg: number | null;
  reps: number | null;
  rir: number | null;
  durationS: number | null;
  done: boolean;
  sync: Sync;
  note?: string | null;
}
type Side = 'left' | 'right' | null;
interface Row {
  key: string;
  setIndex: number;
  side: Side;
}

const keyOf = (seId: string, setIndex: number, side: Side) => `${seId}:${setIndex}:${side ?? ''}`;

function rowsOf(e: Exercise): Row[] {
  const out: Row[] = [];
  for (let i = 1; i <= e.sets; i++) {
    if (e.side === 'each')
      for (const side of ['left', 'right'] as const)
        out.push({ key: keyOf(e.id, i, side), setIndex: i, side });
    else out.push({ key: keyOf(e.id, i, null), setIndex: i, side: null });
  }
  return out;
}

/** Bodyweight exercises without a prescribed or previous load do not show the kg field. */
const usesLoad = (e: Exercise) =>
  e.prescription.loadKg != null ||
  e.prescription.loadPct1rm != null ||
  e.preload.loadKg != null ||
  !!e.last?.sets.some((x) => x.loadKg != null);

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Player({
  session,
  mode,
  backHref,
}: {
  session: PlayerSession;
  mode: 'client' | 'trainer';
  backHref: string;
}) {
  const all = useMemo(() => session.blocks.flatMap((b) => b.exercises), [session]);
  const [sets, setSets] = useState<Record<string, SetState>>(() => {
    const init: Record<string, SetState> = {};
    for (const e of all)
      for (const l of e.logs)
        init[keyOf(e.id, l.setIndex, (l.side as Side) ?? null)] = {
          loadKg: l.loadKg,
          reps: l.reps,
          rir: l.rir,
          durationS: l.durationS,
          done: l.completed,
          sync: l.needsReview ? 'flagged' : 'synced',
          note: l.reviewReason,
        };
    return init;
  });
  const [drafts, setDrafts] = useState<Record<string, Partial<SetState>>>({});
  const [performed, setPerformed] = useState<Record<string, { id: string; name: string }>>(() =>
    Object.fromEntries(
      all.map((e) => [e.id, { id: e.performedExerciseId, name: e.performedName ?? e.name }]),
    ),
  );
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [subFor, setSubFor] = useState<Exercise | null>(null);
  const [closing, setClosing] = useState(false);
  const [finished, setFinished] = useState<{ message: string | null } | null>(
    // Room mode opens in edit mode: the trainer may complete or correct a closed session.
    session.attendance && mode === 'client' ? { message: null } : null,
  );
  const byMutation = useRef(new Map<string, string>());

  // Queue status + replay of what is still pending for this session (reload while offline).
  const refreshQueue = useCallback(async () => {
    const items = await pending();
    setQueued(items.length);
    return items;
  }, []);
  useEffect(() => {
    wireAutoSync();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    void refreshQueue().then((items) => {
      const restored: Record<string, SetState> = {};
      for (const { m } of items) {
        if (m.type !== 'set' || m.sessionId !== session.id) continue;
        const k = keyOf(String(m.sessionExerciseId), Number(m.setIndex), (m.side as Side) ?? null);
        byMutation.current.set(m.clientMutationId, k);
        restored[k] = {
          loadKg: (m.loadKg as number | null) ?? null,
          reps: (m.reps as number | null) ?? null,
          rir: (m.rir as number | null) ?? null,
          durationS: (m.durationS as number | null) ?? null,
          done: true,
          sync: 'pending',
        };
      }
      if (Object.keys(restored).length) setSets((s) => ({ ...s, ...restored }));
    });
    const offChange = onChange(() => void refreshQueue());
    const offResults = onResults((results: SyncResult[]) => {
      setSets((prev) => {
        const next = { ...prev };
        for (const r of results) {
          const k = byMutation.current.get(r.clientMutationId);
          if (!k || !next[k]) continue;
          if (r.status === 'rejected')
            next[k] = { ...next[k]!, done: false, sync: 'error', note: r.message };
          else if (r.status === 'flagged')
            next[k] = { ...next[k]!, sync: 'flagged', note: r.message };
          else next[k] = { ...next[k]!, sync: 'synced', note: null };
        }
        return next;
      });
    });
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      offChange();
      offResults();
    };
  }, [refreshQueue, session.id]);

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [rest]);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      navigator.vibrate?.(300);
      setRest(null);
    }
  }, [rest, restLeft]);

  function valueFor(e: Exercise, row: Row, idx: number): SetState {
    const logged = sets[row.key];
    const draft = drafts[row.key] ?? {};
    // Later sets start from the previous one as logged (what the client actually used).
    const rows = rowsOf(e);
    const prevRow = idx > 0 ? rows[idx - (e.side === 'each' ? 2 : 1)] : undefined;
    const prev = prevRow ? sets[prevRow.key] : undefined;
    const base: SetState = logged ?? {
      loadKg: prev?.loadKg ?? e.preload.loadKg,
      reps: prev?.reps ?? e.preload.reps,
      rir: prev?.rir ?? e.preload.rir,
      durationS: e.preload.durationS,
      done: false,
      sync: 'pending',
    };
    return { ...base, ...draft };
  }

  async function logRow(e: Exercise, row: Row, v: SetState) {
    const id = newMutationId();
    byMutation.current.set(id, row.key);
    setSets((s) => ({ ...s, [row.key]: { ...v, done: true, sync: 'pending', note: null } }));
    setDrafts((d) => {
      const { [row.key]: _, ...rest } = d;
      void _;
      return rest;
    });
    if (e.restS) setRest({ endsAt: Date.now() + e.restS * 1000, total: e.restS });
    await enqueue({
      type: 'set',
      clientMutationId: id,
      sessionId: session.id,
      sessionExerciseId: e.id,
      exerciseId: performed[e.id]!.id,
      setIndex: row.setIndex,
      side: row.side,
      loadKg: v.loadKg,
      reps: v.reps,
      rir: v.rir,
      durationS: v.durationS,
      completed: true,
      loggedAt: new Date().toISOString(),
      downloadedAt: session.downloadedAt,
    });
    void flush();
  }

  const totalRows = all.reduce((a, e) => a + rowsOf(e).length, 0);
  const doneRows = all.reduce((a, e) => a + rowsOf(e).filter((r) => sets[r.key]?.done).length, 0);

  if (finished)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Sesión registrada</h1>
        <p className="text-muted">
          {queued
            ? 'Se enviará en cuanto haya conexión. Puedes cerrar la app.'
            : 'Tu entrenador/a ya puede verla.'}
        </p>
        {finished.message ? (
          <p role="alert" className="rounded-md border border-warn p-3 text-sm">
            {finished.message}
          </p>
        ) : null}
        <SyncChip online={online} queued={queued} />
        <Button variant="secondary" onClick={() => setFinished(null)}>
          Ver mis registros
        </Button>
        <Link href={backHref} className="text-accent underline">
          Volver
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 pb-28">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Link href={backHref} className="text-sm text-muted">
            ← Volver
          </Link>
          <SyncChip online={online} queued={queued} />
        </div>
        {mode === 'trainer' ? (
          <p className="rounded-md bg-surface px-3 py-1 text-xs">
            Modo sala: registras en nombre del cliente.
          </p>
        ) : null}
        <h1 className="text-2xl font-bold">{session.title ?? `Sesión ${session.dayLabel}`}</h1>
        {session.objective ? <p className="text-sm text-muted">{session.objective}</p> : null}
        {session.notesForClient ? (
          <p className="rounded-md border border-border p-3 text-sm">{session.notesForClient}</p>
        ) : null}
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            {session.attendance ? session.tracking : doneRows ? 'Iniciada' : session.tracking}
          </span>
          {doneRows} de {totalRows} series
        </p>
      </header>

      {session.blocks.map((b) => (
        <section key={b.id} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {b.label ?? LABELS.blockType[b.type as keyof typeof LABELS.blockType] ?? b.type}
          </h2>
          {b.exercises.map((e) => {
            const perf = performed[e.id]!;
            const swapped = perf.id !== e.exerciseId;
            return (
              <article
                key={e.id}
                aria-label={perf.name}
                className="flex flex-col gap-3 rounded-xl border border-border p-4"
              >
                <div className="flex gap-3">
                  {e.muscles.length ? (
                    <div className="shrink-0">
                      <BodyMap muscles={e.muscles} size="xs" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">
                      {e.pairingLabel ? `${e.pairingLabel} · ` : ''}
                      {perf.name}
                    </h3>
                    {swapped ? <p className="text-xs text-muted">En lugar de {e.name}</p> : null}
                    <p className="mt-1 text-sm">{e.clientText}</p>
                    {e.notesForClient ? (
                      <p className="mt-1 text-sm text-accent">{e.notesForClient}</p>
                    ) : null}
                    {e.muscles.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Trabaja:{' '}
                        {e.muscles
                          .filter((m) => m.role === 'primary')
                          .map((m) => m.name)
                          .join(', ') || e.muscles.map((m) => m.name).join(', ')}
                      </p>
                    ) : null}
                    {e.last ? (
                      <p className="mt-1 text-xs text-muted">
                        Última vez ({e.last.date}):{' '}
                        {e.last.sets
                          .map((x) =>
                            x.reps == null && x.durationS != null
                              ? `${x.durationS} s`
                              : `${x.loadKg != null ? `${x.loadKg} kg × ` : ''}${x.reps ?? '—'}`,
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </div>
                {e.video?.embedUrl ? <VideoToggle title={e.name} url={e.video.embedUrl} /> : null}
                {e.cues.length || e.description ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-muted">Cómo hacerlo</summary>
                    {e.description ? <p className="mt-2 text-sm">{e.description}</p> : null}
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {e.cues.map((c, i) => (
                        <li key={i} className={c.kind === 'precaution' ? 'text-warn' : ''}>
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <ol className="flex flex-col gap-2">
                  {rowsOf(e).map((row, idx) => {
                    const v = valueFor(e, row, idx);
                    const logged = sets[row.key];
                    const setDraft = (patch: Partial<SetState>) =>
                      setDrafts((d) => ({ ...d, [row.key]: { ...d[row.key], ...patch } }));
                    const label = `Serie ${row.setIndex}${row.side ? (row.side === 'left' ? ' izq.' : ' dcha.') : ''}`;
                    return (
                      <li
                        key={row.key}
                        className={`flex flex-col gap-2 rounded-lg p-2 ${logged?.done ? 'bg-surface' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-sm font-medium">{label}</span>
                          {e.prescription.durationS != null && e.prescription.repsMin == null ? (
                            <NumInput
                              label={`${label}: segundos`}
                              suffix="s"
                              value={v.durationS}
                              onChange={(x) => setDraft({ durationS: x })}
                            />
                          ) : (
                            <>
                              {usesLoad(e) ? (
                                <NumInput
                                  label={`${label}: kg`}
                                  suffix="kg"
                                  step={0.5}
                                  value={v.loadKg}
                                  onChange={(x) => setDraft({ loadKg: x })}
                                />
                              ) : null}
                              <NumInput
                                label={`${label}: repeticiones`}
                                suffix="rep"
                                value={v.reps}
                                onChange={(x) => setDraft({ reps: x })}
                              />
                            </>
                          )}
                          <button
                            type="button"
                            aria-label={`Registrar ${label.toLowerCase()} de ${perf.name}`}
                            aria-pressed={!!logged?.done}
                            onClick={() => void logRow(e, row, v)}
                            className={`ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl ${logged?.done ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
                          >
                            ✓
                          </button>
                        </div>
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label={`${label}: RIR`}
                        >
                          <span className="text-xs text-muted" title="Repeticiones en reserva">
                            RIR
                          </span>
                          {RIR_CHIPS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={v.rir === r}
                              onClick={() => setDraft({ rir: v.rir === r ? null : r })}
                              className={`h-8 min-w-8 rounded-full border px-2 text-xs ${v.rir === r ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
                            >
                              {r === 4 ? '4+' : r}
                            </button>
                          ))}
                          {logged ? <SyncDot s={logged.sync} /> : null}
                        </div>
                        {logged?.note ? <p className="text-xs text-warn">{logged.note}</p> : null}
                      </li>
                    );
                  })}
                </ol>
                {notices[e.id] ? (
                  <p role="status" className="rounded-md border border-warn p-2 text-sm">
                    {notices[e.id]}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="self-start text-sm text-muted underline"
                  onClick={() => setSubFor(e)}
                >
                  No puedo hacer este ejercicio
                </button>
                <ExerciseFeedback
                  name={perf.name}
                  initial={e.feedback}
                  onSend={async (fb) => {
                    await enqueue({
                      type: 'exercise_feedback',
                      clientMutationId: newMutationId(),
                      sessionExerciseId: e.id,
                      ...fb,
                    });
                    void flush();
                    if ((fb.discomfort && fb.discomfort !== 'none') || (fb.pain ?? 0) > 0)
                      setNotices((n) => ({ ...n, [e.id]: PAIN_MESSAGE }));
                  }}
                />
              </article>
            );
          })}
        </section>
      ))}

      <Button size="lg" onClick={() => setClosing(true)}>
        Terminar sesión
      </Button>

      {rest ? (
        <div
          role="timer"
          aria-label="Descanso"
          className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-lg items-center justify-between gap-3 border-t border-border bg-bg px-4 py-3"
        >
          <span className="text-sm text-muted">Descanso</span>
          <span className="text-2xl font-semibold tabular-nums">{fmtTime(restLeft)}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRest({ ...rest, endsAt: rest.endsAt + 30_000 })}
            >
              +30 s
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRest(null)}>
              Saltar
            </Button>
          </div>
        </div>
      ) : null}

      {subFor ? (
        <SubstitutionSheet
          exercise={subFor}
          mode={mode}
          onClose={() => setSubFor(null)}
          onDone={async (reason, alt) => {
            const id = newMutationId();
            await enqueue({
              type: 'substitution',
              clientMutationId: id,
              sessionExerciseId: subFor.id,
              reason,
              chosenExerciseId: alt?.id ?? null,
            });
            void flush();
            if (alt) setPerformed((p) => ({ ...p, [subFor.id]: alt }));
            setNotices((n) => ({
              ...n,
              [subFor.id]:
                reason === 'pain'
                  ? PAIN_MESSAGE
                  : alt
                    ? `Cambiado por ${alt.name}.`
                    : 'Lo hemos anotado y avisado a tu entrenador/a. Puedes pasar al siguiente ejercicio.',
            }));
            setSubFor(null);
          }}
        />
      ) : null}

      {closing ? (
        <CloseSheet
          complete={doneRows >= totalRows && totalRows > 0}
          none={doneRows === 0}
          onClose={() => setClosing(false)}
          onSubmit={async (data) => {
            await enqueue({
              type: 'complete',
              clientMutationId: newMutationId(),
              sessionId: session.id,
              ...data,
            });
            void flush();
            setClosing(false);
            setFinished({
              message: data.pain && Number(data.pain.intensity) > 0 ? PAIN_MESSAGE : null,
            });
          }}
        />
      ) : null}
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1">
      <input
        aria-label={label}
        inputMode="decimal"
        type="number"
        step={step}
        min={0}
        value={value ?? ''}
        onChange={(ev) => onChange(ev.target.value === '' ? null : Number(ev.target.value))}
        className="h-12 w-16 rounded-md border border-border bg-bg px-2 text-center text-base tabular-nums"
      />
      <span className="text-xs text-muted">{suffix}</span>
    </label>
  );
}

function SyncDot({ s }: { s: Sync }) {
  const t = {
    synced: ['Guardado', 'text-ok'],
    pending: ['Pendiente de enviar', 'text-muted'],
    flagged: ['Guardado; tu entrenador/a lo revisará', 'text-warn'],
    error: ['No se pudo guardar', 'text-danger'],
  }[s];
  return <span className={`ml-auto text-xs ${t[1]}`}>{t[0]}</span>;
}

function SyncChip({ online, queued }: { online: boolean; queued: number }) {
  if (!online)
    return (
      <span role="status" className="rounded-full border border-warn px-2 py-0.5 text-xs text-warn">
        Sin conexión{queued ? ` · ${queued} pendientes` : ''}
      </span>
    );
  return (
    <span
      role="status"
      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
    >
      {queued ? `Enviando ${queued}…` : 'Sincronizado'}
    </span>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-auto flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl bg-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const REASONS = Object.entries(LABELS.substitutionReason) as [
  keyof typeof LABELS.substitutionReason,
  string,
][];

function SubstitutionSheet({
  exercise,
  mode,
  onClose,
  onDone,
}: {
  exercise: Exercise;
  mode: 'client' | 'trainer';
  onClose: () => void;
  onDone: (reason: string, alt: { id: string; name: string } | null) => Promise<void>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Sheet title="No puedo hacer este ejercicio" onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">¿Qué ocurre?</legend>
        {REASONS.map(([k, l]) => (
          <label
            key={k}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3"
          >
            <input
              type="radio"
              name="reason"
              checked={reason === k}
              onChange={() => setReason(k)}
            />
            {l}
          </label>
        ))}
      </fieldset>
      {reason === 'pain' ? (
        <p role="alert" className="rounded-md border border-warn p-3 text-sm">
          Para este ejercicio. {PAIN_MESSAGE}
        </p>
      ) : null}
      {reason ? (
        <div className="flex flex-col gap-2">
          {exercise.alternatives.length ? (
            <>
              <p className="text-sm font-medium">
                {mode === 'trainer' ? 'Alternativas previstas' : 'Tu entrenador/a ha aprobado:'}
              </p>
              {exercise.alternatives.map((a) => (
                <Button key={a.id} variant="secondary" onClick={() => void onDone(reason, a)}>
                  Hacer {a.name}
                </Button>
              ))}
            </>
          ) : null}
          <Button
            variant={exercise.alternatives.length ? 'ghost' : 'primary'}
            onClick={() => void onDone(reason, null)}
          >
            {mode === 'trainer' ? 'Registrar y saltar' : 'Avisar a mi entrenador/a y saltar'}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

const ABSENCE = Object.entries(LABELS.absenceReason) as [string, string][];

function CloseSheet({
  complete,
  none,
  onClose,
  onSubmit,
}: {
  complete: boolean;
  none: boolean;
  onClose: () => void;
  onSubmit: (data: {
    status?: 'completed' | 'partial' | 'missed';
    feel?: Feel | null;
    reasonCode?: string | null;
    sessionRpe?: number | null;
    fatigue?: number | null;
    motivation?: number | null;
    comment?: string | null;
    pain?: { intensity: number; bodyRegion: string } | null;
  }) => Promise<void>;
}) {
  const [feel, setFeel] = useState<Feel | null>(null);
  const [srpe, setSrpe] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [motivation, setMotivation] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [hasPain, setHasPain] = useState(false);
  const [painI, setPainI] = useState<number | null>(null);
  const [region, setRegion] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const status = complete ? 'completed' : none ? 'missed' : 'partial';
  return (
    <Sheet title="Terminar sesión" onClose={onClose}>
      {!complete ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {none
              ? '¿Por qué no has podido entrenar?'
              : 'No has completado todas las series. ¿Por qué?'}
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-md border border-border bg-bg px-2"
          >
            <option value="">Elige un motivo</option>
            {ABSENCE.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!none ? (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">¿Cómo fue?</legend>
          <div className="flex gap-1">
            {FEEL.map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={feel === k}
                onClick={() => setFeel(feel === k ? null : k)}
                className={`h-12 flex-1 rounded-md border px-2 text-sm ${feel === k ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {!none ? (
        <Scale
          legend="¿Cómo de dura ha sido la sesión? (0–10)"
          value={srpe}
          onChange={setSrpe}
          anchors={SRPE}
        />
      ) : null}
      <Scale legend="Fatiga ahora (0–10)" value={fatigue} onChange={setFatigue} />
      <Scale legend="Motivación (0–10)" value={motivation} onChange={setMotivation} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasPain} onChange={(e) => setHasPain(e.target.checked)} />
        He tenido dolor o molestias
      </label>
      {hasPain ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Scale legend="Intensidad del dolor (0–10)" value={painI} onChange={setPainI} />
          <label className="flex flex-col gap-1 text-sm">
            Zona
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={60}
              className="h-11 rounded-md border border-border bg-bg px-2"
            />
          </label>
          <p className="text-xs text-muted">
            Solo se guarda si has dado tu consentimiento para datos de salud. {PAIN_MESSAGE}
          </p>
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Comentario para tu entrenador/a
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={2}
          className="rounded-md border border-border bg-bg p-2"
        />
      </label>
      {err ? (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      ) : null}
      <Button
        size="lg"
        onClick={() => {
          if (status !== 'completed' && !reason) return setErr('Indica el motivo.');
          if (hasPain && (painI == null || !region.trim()))
            return setErr('Indica la intensidad y la zona del dolor.');
          void onSubmit({
            status,
            feel: none ? null : feel,
            reasonCode: status === 'completed' ? null : reason,
            sessionRpe: none ? null : srpe,
            fatigue,
            motivation,
            comment: comment.trim() || null,
            pain: hasPain && painI != null ? { intensity: painI, bodyRegion: region.trim() } : null,
          });
        }}
      >
        Guardar sesión
      </Button>
    </Sheet>
  );
}

/** A verified video, opened on demand (no third-party request until the client asks). */
function VideoToggle({ title, url }: { title: string; url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-12 items-center gap-2 text-sm font-medium text-accent"
      >
        {open ? '■ Ocultar vídeo' : '▶ Ver vídeo'}
      </button>
      {open ? (
        <iframe
          title={`Vídeo de ${title}`}
          src={url}
          className="mt-1 aspect-video w-full rounded"
          allow="encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

/**
 * «¿Cómo fue?» and «¿Molestias?» per exercise (restructure phase 8): one tap each, saved through
 * the offline queue on every change. With «Algo» or «Mucho» the client may add how much (0–10),
 * which is what the pain alerts use. Discomfort is health data: stored only with consent.
 */
function ExerciseFeedback({
  name,
  initial,
  onSend,
}: {
  name: string;
  initial: { feel: string | null; discomfort: string | null } | null;
  onSend: (fb: {
    feel: Feel | null;
    discomfort: Discomfort | null;
    pain: number | null;
  }) => Promise<void>;
}) {
  const [feel, setFeel] = useState<Feel | null>((initial?.feel as Feel) ?? null);
  const [discomfort, setDiscomfort] = useState<Discomfort | null>(
    (initial?.discomfort as Discomfort) ?? null,
  );
  const [pain, setPain] = useState<number | null>(null);
  const send = (next: {
    feel?: Feel | null;
    discomfort?: Discomfort | null;
    pain?: number | null;
  }) => {
    const v = {
      feel: next.feel !== undefined ? next.feel : feel,
      discomfort: next.discomfort !== undefined ? next.discomfort : discomfort,
      pain: next.pain !== undefined ? next.pain : pain,
    };
    if (v.discomfort === 'none') v.pain = 0;
    void onSend(v);
  };
  const chip = (on: boolean) =>
    `h-12 min-w-12 flex-1 rounded-md border px-2 text-sm ${on ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">¿Cómo fue {name}?</legend>
        <div className="flex gap-1">
          {FEEL.map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={feel === k}
              className={chip(feel === k)}
              onClick={() => {
                const v = feel === k ? null : k;
                setFeel(v);
                send({ feel: v });
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">¿Molestias?</legend>
        <div className="flex gap-1">
          {DISCOMFORT.map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={discomfort === k}
              className={chip(discomfort === k)}
              onClick={() => {
                const v = discomfort === k ? null : k;
                setDiscomfort(v);
                if (v === 'none' || v == null) setPain(null);
                send({ discomfort: v, pain: v === 'none' || v == null ? null : pain });
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      {discomfort === 'some' || discomfort === 'a_lot' ? (
        <Scale
          legend="¿Cuánto? (0–10, opcional)"
          value={pain}
          onChange={(x) => {
            setPain(x);
            send({ pain: x });
          }}
        />
      ) : null}
      <p className="text-xs text-muted">
        Las molestias solo se guardan si has dado tu consentimiento para datos de salud.
      </p>
    </div>
  );
}

function Scale({
  legend,
  value,
  onChange,
  anchors,
}: {
  legend: string;
  value: number | null;
  onChange: (v: number | null) => void;
  anchors?: { value: number; label: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            aria-label={`${legend}: ${i}${anchors?.find((a) => a.value === i)?.label ? ` (${anchors.find((a) => a.value === i)!.label})` : ''}`}
            onClick={() => onChange(value === i ? null : i)}
            className={`h-10 rounded-md border text-sm ${value === i ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
          >
            {i}
          </button>
        ))}
      </div>
      {anchors && value != null && anchors.find((a) => a.value === value)?.label ? (
        <p className="text-xs text-muted">{anchors.find((a) => a.value === value)!.label}</p>
      ) : null}
    </fieldset>
  );
}
