'use client';

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  Minus,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  type BuilderVariantVM,
  type PublishOutcome,
  type SaveDraftOutcome,
  type SessionBuilderVM,
} from '@/contracts/sessions';
import { formatClock, formatDate } from '@/domain/format';
import { type Issue } from '@/domain/issues';
import { normalizeForSearch } from '@/domain/text';
import { type EffortTargetV2 } from '@/domain/training/effort';
import { type LoadSpec } from '@/domain/training/load';
import { type RepTarget } from '@/domain/training/prescription';
import {
  blockLetter,
  normalizeContent,
  publishIssues,
  publishWarnings,
  sameContent,
  type SessionContent,
  type SessionItem,
} from '@/domain/training/session-v2';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { ConfirmSubmit } from '@/features/shared/confirm-submit';
import { Button } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Notice } from '@/ui/notice';
import { fieldClasses } from './new-session-form';

type DraftInput = { sessionId: string; expectedRevision: number; content: unknown };

const parseNumber = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return value.trim() === '' || Number.isNaN(n) ? 0 : n;
};

const newItem = (variant: BuilderVariantVM, order: number, block: string): SessionItem => ({
  id: crypto.randomUUID(),
  variantId: variant.id,
  variantName: variant.name,
  order,
  block,
  blockMode: 'sequential',
  sets: 3,
  defaults: {
    reps: { kind: 'fixed', reps: 10 },
    load: { kind: 'none' },
    effort: { kind: 'none' },
    restSeconds: 90,
  },
  perSet: [],
});

/** Mensaje de una incidencia con el nombre del ejercicio («Sentadilla goblet: …»). */
function describeIssue(issue: Issue, content: SessionContent) {
  const match = /^items\.(\d+)/.exec(issue.path);
  if (!match) return issue.message;
  const item = content.items[Number(match[1])];
  return item ? `${item.variantName ?? 'Ejercicio'}: ${issue.message}` : issue.message;
}

/**
 * A5 · Constructor de un borrador que nunca se ha publicado (A6 con la prescripción común:
 * series, repeticiones, kg / peso corporal / sin carga, RIR / RPE / nada, descanso y notas).
 * Guarda con la revisión esperada: si otra pestaña cambió el borrador, avisa en lugar de pisarlo.
 */
export function SessionBuilder({
  vm,
  saveAction,
  publishAction,
  deleteAction,
  publishedHref,
}: {
  vm: SessionBuilderVM;
  saveAction: (input: DraftInput) => Promise<SaveDraftOutcome>;
  publishAction: (input: DraftInput) => Promise<PublishOutcome>;
  deleteAction: (form: FormData) => void | Promise<void>;
  publishedHref: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<SessionContent>(vm.content);
  const [saved, setSaved] = useState<SessionContent>(vm.content);
  const [revision, setRevision] = useState(vm.revision);
  const [savedAt, setSavedAt] = useState(vm.updatedAt);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [problem, setProblem] = useState<'conflict' | 'error' | null>(null);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(vm.content.items.length === 0);
  const dialog = useRef<HTMLDialogElement>(null);

  const dirty = !sameContent(normalizeContent(content), normalizeContent(saved));
  const known = useMemo(() => new Set(vm.variants.map((v) => v.id)), [vm.variants]);
  const checklist = publishIssues(normalizeContent(content), {
    isUsableVariant: (id) => known.has(id),
  });
  const warnings = publishWarnings(normalizeContent(content), vm.today);
  const totalSets = content.items.reduce((sum, item) => sum + item.sets, 0);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<SessionContent>) => setContent((c) => ({ ...c, ...patch }));
  const updateItem = (id: string, patch: (item: SessionItem) => SessionItem) =>
    setContent((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? patch(i) : i)) }));
  const ordered = [...content.items].sort((a, b) => a.order - b.order);
  const move = (id: string, delta: -1 | 1) => {
    const index = ordered.findIndex((i) => i.id === id);
    const other = ordered[index + delta];
    if (!other) return;
    const items = ordered.map((item, i) => ({ ...item, order: i + 1 }));
    [items[index]!.order, items[index + delta]!.order] = [index + delta + 1, index + 1];
    update({ items });
  };
  const remove = (id: string) =>
    update({
      items: ordered.filter((i) => i.id !== id).map((item, i) => ({ ...item, order: i + 1 })),
    });
  const add = (variant: BuilderVariantVM) => {
    const used = new Set(content.items.map((i) => i.block));
    let n = content.items.length + 1;
    while (used.has(blockLetter(n))) n += 1;
    update({ items: [...ordered, newItem(variant, ordered.length + 1, blockLetter(n))] });
  };

  const handleOutcome = (outcome: SaveDraftOutcome | PublishOutcome) => {
    if (outcome.ok) return true;
    if (outcome.reason === 'invalid') setIssues(outcome.issues);
    else setProblem(outcome.reason === 'conflict' ? 'conflict' : 'error');
    return false;
  };

  const save = () =>
    startTransition(async () => {
      setIssues([]);
      setProblem(null);
      const outcome = await saveAction({
        sessionId: vm.sessionId,
        expectedRevision: revision,
        content,
      });
      if (outcome.ok) {
        setRevision(outcome.revision);
        setSavedAt(outcome.updatedAt);
        setSaved(content);
      } else handleOutcome(outcome);
    });

  const publish = () =>
    startTransition(async () => {
      setIssues([]);
      setProblem(null);
      const outcome = await publishAction({
        sessionId: vm.sessionId,
        expectedRevision: revision,
        content,
      });
      dialog.current?.close();
      if (handleOutcome(outcome)) {
        setSaved(content); // ya no hay nada sin guardar: no avisar al salir
        router.push(publishedHref);
      }
    });

  const savedLabel = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(savedAt));

  return (
    <div className="pb-28 lg:pb-0">
      {problem === 'conflict' ? (
        <Notice
          tone="sun"
          icon={<TriangleAlert />}
          title="Hay una versión más reciente de este borrador"
          className="mb-4"
        >
          Se ha guardado desde otra pestaña o en otro momento. Para no pisarla, no se ha guardado lo
          tuyo.{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => window.location.reload()}
          >
            Recargar el borrador
          </button>{' '}
          (perderás los cambios de esta pantalla que no estén guardados).
        </Notice>
      ) : null}
      {problem === 'error' ? (
        <Notice
          tone="sun"
          icon={<TriangleAlert />}
          title="No se ha podido guardar"
          className="mb-4"
        >
          Este borrador ya no se puede editar aquí (quizá se publicó o se eliminó). Vuelve a la
          lista de sesiones.
        </Notice>
      ) : null}
      {issues.length > 0 ? (
        <div role="alert" className="mb-4 rounded-2xl border border-coral-500 bg-coral-100 p-4">
          <p className="font-bold text-coral-700">Revisa estos datos antes de continuar:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-coral-700">
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>{describeIssue(issue, content)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section aria-labelledby="datos-sesion" className="rounded-3xl bg-white p-5 shadow-soft">
            <h2 id="datos-sesion" className="text-lg font-bold text-ink-900">
              Datos de la sesión
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                label="Fecha prevista"
                type="date"
                value={content.plannedDate}
                onChange={(v) => update({ plannedDate: v })}
              />
              <TextField
                label="Contexto (opcional)"
                value={content.label ?? ''}
                maxLength={40}
                onChange={(v) => update({ label: v })}
              />
              <TextField
                label="Título"
                value={content.title}
                maxLength={80}
                onChange={(v) => update({ title: v })}
              />
              <TextField
                label="Duración (min)"
                type="number"
                value={
                  content.estimatedMinutes === undefined ? '' : String(content.estimatedMinutes)
                }
                onChange={(v) =>
                  update({ estimatedMinutes: v.trim() === '' ? undefined : parseNumber(v) })
                }
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Objetivo"
                  value={content.focus}
                  maxLength={120}
                  onChange={(v) => update({ focus: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label={`Nota para ${vm.clientFirstName} (opcional)`}
                  value={content.coachNote ?? ''}
                  maxLength={500}
                  multiline
                  onChange={(v) => update({ coachNote: v })}
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="ejercicios" className="space-y-4">
            <h2 id="ejercicios" className="text-lg font-bold text-ink-900">
              Ejercicios
            </h2>
            {ordered.length === 0 ? (
              <p className="text-sm text-ink-500">Todavía no hay ejercicios.</p>
            ) : null}
            <ol className="space-y-4">
              {ordered.map((item, index) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  slot={`${item.block}${ordered.filter((o) => o.block === item.block && o.order <= item.order).length}`}
                  silhouette={
                    vm.variants.find((v) => v.id === item.variantId)?.silhouette ?? 'squat'
                  }
                  first={index === 0}
                  last={index === ordered.length - 1}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onMove={(delta) => move(item.id, delta)}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </ol>
            {picking ? (
              <VariantPicker variants={vm.variants} onAdd={add} onClose={() => setPicking(false)} />
            ) : (
              <Button variant="secondary" onClick={() => setPicking(true)}>
                <Plus aria-hidden className="size-4" /> Añadir ejercicio
              </Button>
            )}
          </section>

          <form action={deleteAction} className="pt-2">
            <input type="hidden" name="sessionId" value={vm.sessionId} />
            <input type="hidden" name="clientId" value={vm.clientId} />
            <ConfirmSubmit
              variant="ghost"
              size="sm"
              message={`¿Eliminar este borrador? ${vm.clientFirstName} nunca lo ha visto. No se puede deshacer.`}
            >
              <Trash2 aria-hidden className="size-4" /> Eliminar borrador
            </ConfirmSubmit>
          </form>
        </div>

        <aside aria-labelledby="resumen" className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-3xl bg-white p-5 shadow-soft">
            <h2 id="resumen" className="text-sm font-bold tracking-wide text-ink-500 uppercase">
              Resumen
            </h2>
            <p className="mt-1 text-lg font-bold text-ink-900">
              {ordered.length} {ordered.length === 1 ? 'ejercicio' : 'ejercicios'} · {totalSets}{' '}
              {totalSets === 1 ? 'serie' : 'series'}
            </p>
            <h3 className="mt-4 text-sm font-bold text-ink-900">Para publicar</h3>
            {checklist.length === 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-leaf-700">
                <CircleCheck aria-hidden className="size-4" /> Lista para publicar
              </p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-ink-700">
                {checklist.map((issue, index) => (
                  <li key={`${issue.path}-${index}`} className="flex gap-1.5">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-coral-700" />
                    {describeIssue(issue, content)}
                  </li>
                ))}
              </ul>
            )}
            {warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-sun-800">
                {warnings.map((warning, index) => (
                  <li key={`${warning.path}-${index}`} className="flex gap-1.5">
                    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {describeIssue(warning, content)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </aside>
      </div>

      {/* Barra de acciones: fija abajo en el móvil, al pie en el escritorio. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream-50/95 px-4 py-3 backdrop-blur lg:static lg:mt-6 lg:rounded-3xl lg:border lg:bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm font-semibold text-ink-500">
            {pending
              ? 'Guardando…'
              : dirty
                ? 'Cambios sin guardar'
                : `Borrador guardado · ${savedLabel}`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save} disabled={pending || !dirty}>
              <Save aria-hidden className="size-4" /> Guardar
            </Button>
            <Button
              onClick={() => dialog.current?.showModal()}
              disabled={pending || checklist.length > 0}
            >
              <Send aria-hidden className="size-4" /> Publicar versión 1
            </Button>
          </div>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="confirmar-publicar"
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl bg-white p-6 shadow-lift backdrop:bg-ink-900/40"
      >
        <h2 id="confirmar-publicar" className="text-xl font-extrabold text-ink-900">
          ¿Publicar la versión 1?
        </h2>
        <p className="mt-2 text-ink-700">
          {vm.clientFirstName} verá «{content.title}»{content.label ? ` (${content.label})` : ''} el{' '}
          {formatDate(content.plannedDate, 'long')}: {ordered.length}{' '}
          {ordered.length === 1 ? 'ejercicio' : 'ejercicios'} y {totalSets} series. Lo que no esté
          guardado se guarda antes de publicar.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Cancelar
          </Button>
          <Button onClick={publish} disabled={pending}>
            Publicar
          </Button>
        </div>
      </dialog>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number';
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <label className="block font-semibold text-ink-900">
      {label}
      {multiline ? (
        <textarea
          value={value}
          maxLength={maxLength}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClasses(false)}
        />
      ) : (
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          inputMode={type === 'number' ? 'numeric' : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClasses(false)}
        />
      )}
    </label>
  );
}

const smallField = cn(fieldClasses(false), 'mt-1 py-2.5');
const stepClass =
  'grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink-900 hover:border-ink-300 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-50';

function ItemEditor({
  item,
  slot,
  silhouette,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  item: SessionItem;
  slot: string;
  silhouette: BuilderVariantVM['silhouette'];
  first: boolean;
  last: boolean;
  onChange: (patch: (item: SessionItem) => SessionItem) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [more, setMore] = useState(!!(item.clientNote || item.privateNote));
  const name = item.variantName ?? 'Ejercicio';
  const d = item.defaults;
  const setDefaults = (patch: Partial<SessionItem['defaults']>) =>
    onChange((i) => ({ ...i, defaults: { ...i.defaults, ...patch } }));
  const reps = d.reps;
  const setReps = (next: RepTarget) => setDefaults({ reps: next });
  const load = d.load;
  const effort = d.effort;

  return (
    <li className="rounded-3xl bg-white p-5 shadow-soft" aria-label={`${slot} · ${name}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sun-200 font-display font-extrabold text-sun-800">
          {slot}
        </span>
        <ExercisePictogram silhouette={silhouette} className="size-10 shrink-0" />
        <h3 className="min-w-0 flex-1 pt-2 font-bold text-ink-900">{name}</h3>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={first}
            onClick={() => onMove(-1)}
            aria-label={`Subir ${name}`}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={last}
            onClick={() => onMove(1)}
            aria-label={`Bajar ${name}`}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Quitar ${name}`}>
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <span id={`series-${item.id}`} className="font-semibold text-ink-900">
            Series
          </span>
          <div
            className="mt-1 flex items-center gap-2"
            role="group"
            aria-labelledby={`series-${item.id}`}
          >
            <button
              type="button"
              className={stepClass}
              disabled={item.sets <= 1}
              onClick={() => onChange((i) => ({ ...i, sets: Math.max(1, i.sets - 1) }))}
              aria-label={`Una serie menos de ${name}`}
            >
              <Minus aria-hidden className="size-5" />
            </button>
            <output
              className="w-10 text-center font-display text-2xl font-extrabold tabular-nums"
              aria-label={`Series de ${name}`}
            >
              {item.sets}
            </output>
            <button
              type="button"
              className={stepClass}
              disabled={item.sets >= 50}
              onClick={() => onChange((i) => ({ ...i, sets: Math.min(50, i.sets + 1) }))}
              aria-label={`Una serie más de ${name}`}
            >
              <Plus aria-hidden className="size-5" />
            </button>
          </div>
        </div>

        <fieldset>
          <legend className="font-semibold text-ink-900">Repeticiones</legend>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              aria-label={`Tipo de repeticiones de ${name}`}
              className={cn(smallField, 'mt-0 w-auto')}
              value={reps.kind === 'range' ? 'range' : 'fixed'}
              onChange={(e) =>
                setReps(
                  e.target.value === 'range'
                    ? {
                        kind: 'range',
                        min: reps.kind === 'fixed' ? Math.max(1, reps.reps - 2) : 8,
                        max: reps.kind === 'fixed' ? reps.reps : 10,
                      }
                    : { kind: 'fixed', reps: reps.kind === 'range' ? reps.max : 10 },
                )
              }
            >
              <option value="fixed">Fijas</option>
              <option value="range">Rango</option>
            </select>
            {reps.kind === 'range' ? (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Repeticiones mínimas de ${name}`}
                  className={cn(smallField, 'mt-0 w-20')}
                  value={reps.min}
                  onChange={(e) => setReps({ ...reps, min: parseNumber(e.target.value) })}
                />
                <span aria-hidden>–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Repeticiones máximas de ${name}`}
                  className={cn(smallField, 'mt-0 w-20')}
                  value={reps.max}
                  onChange={(e) => setReps({ ...reps, max: parseNumber(e.target.value) })}
                />
              </>
            ) : reps.kind === 'fixed' ? (
              <input
                type="number"
                inputMode="numeric"
                aria-label={`Repeticiones de ${name}`}
                className={cn(smallField, 'mt-0 w-24')}
                value={reps.reps}
                onChange={(e) => setReps({ kind: 'fixed', reps: parseNumber(e.target.value) })}
              />
            ) : (
              <span className="text-sm text-ink-500">
                Por tiempo o distancia (aún no editable aquí)
              </span>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-semibold text-ink-900">Carga</legend>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              aria-label={`Carga de ${name}`}
              className={cn(smallField, 'mt-0 w-auto')}
              value={['external', 'bodyweight', 'none'].includes(load.kind) ? load.kind : 'other'}
              onChange={(e) => {
                const kind = e.target.value;
                const next: LoadSpec =
                  kind === 'external'
                    ? { kind: 'external', kg: 20, basis: 'total' }
                    : kind === 'bodyweight'
                      ? { kind: 'bodyweight' }
                      : { kind: 'none' };
                setDefaults({ load: next });
              }}
            >
              <option value="external">Kilogramos</option>
              <option value="bodyweight">Peso corporal</option>
              <option value="none">Sin carga externa</option>
              {['external', 'bodyweight', 'none'].includes(load.kind) ? null : (
                <option value="other" disabled>
                  Otra modalidad (bloque 4)
                </option>
              )}
            </select>
            {load.kind === 'external' ? (
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  aria-label={`Kilogramos de ${name}`}
                  className={cn(smallField, 'mt-0 w-24')}
                  value={load.kg}
                  onChange={(e) =>
                    setDefaults({ load: { ...load, kg: parseNumber(e.target.value) } })
                  }
                />
                <span className="font-semibold text-ink-700">kg</span>
              </span>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-semibold text-ink-900">Esfuerzo</legend>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              aria-label={`Esfuerzo de ${name}`}
              className={cn(smallField, 'mt-0 w-auto')}
              value={['none', 'rir', 'rpe'].includes(effort.kind) ? effort.kind : 'other'}
              onChange={(e) => {
                const kind = e.target.value;
                const next: EffortTargetV2 =
                  kind === 'rir'
                    ? { kind: 'rir', rir: 2 }
                    : kind === 'rpe'
                      ? { kind: 'rpe', rpe: 8, scale: 'rir_based' }
                      : { kind: 'none' };
                setDefaults({ effort: next });
              }}
            >
              <option value="none">Sin objetivo</option>
              <option value="rir">RIR</option>
              <option value="rpe">RPE (escala basada en RIR)</option>
              {['none', 'rir', 'rpe'].includes(effort.kind) ? null : (
                <option value="other" disabled>
                  Otro objetivo (bloque 4)
                </option>
              )}
            </select>
            {effort.kind === 'rir' && typeof effort.rir === 'number' ? (
              <input
                type="number"
                inputMode="numeric"
                aria-label={`RIR de ${name}`}
                className={cn(smallField, 'mt-0 w-20')}
                value={effort.rir}
                onChange={(e) =>
                  setDefaults({ effort: { kind: 'rir', rir: parseNumber(e.target.value) } })
                }
              />
            ) : null}
            {effort.kind === 'rpe' && typeof effort.rpe === 'number' ? (
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                aria-label={`RPE de ${name}`}
                className={cn(smallField, 'mt-0 w-20')}
                value={effort.rpe}
                onChange={(e) =>
                  setDefaults({ effort: { ...effort, rpe: parseNumber(e.target.value) } })
                }
              />
            ) : null}
          </div>
        </fieldset>

        <div>
          <span id={`descanso-${item.id}`} className="font-semibold text-ink-900">
            Descanso
          </span>
          <div
            className="mt-1 flex items-center gap-2"
            role="group"
            aria-labelledby={`descanso-${item.id}`}
          >
            <button
              type="button"
              className={cn(stepClass, 'w-auto px-3 text-sm font-semibold')}
              disabled={d.restSeconds <= 0}
              onClick={() => setDefaults({ restSeconds: Math.max(0, d.restSeconds - 15) })}
              aria-label={`−15 s de descanso en ${name}`}
            >
              −15 s
            </button>
            <output
              className="w-16 text-center font-display text-xl font-extrabold whitespace-nowrap tabular-nums"
              aria-label={`Descanso de ${name}`}
            >
              {formatClock(d.restSeconds)}
            </output>
            <button
              type="button"
              className={cn(stepClass, 'w-auto px-3 text-sm font-semibold')}
              disabled={d.restSeconds >= 1800}
              onClick={() => setDefaults({ restSeconds: Math.min(1800, d.restSeconds + 15) })}
              aria-label={`+15 s de descanso en ${name}`}
            >
              +15 s
            </button>
          </div>
        </div>
      </div>

      {more ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Observación para el cliente"
            value={item.clientNote ?? ''}
            maxLength={300}
            multiline
            onChange={(v) => onChange((i) => ({ ...i, clientNote: v }))}
          />
          <TextField
            label="Nota privada (solo la ves tú)"
            value={item.privateNote ?? ''}
            maxLength={500}
            multiline
            onChange={(v) => onChange((i) => ({ ...i, privateNote: v }))}
          />
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 min-h-9 text-sm font-semibold text-sun-800 hover:text-ink-900"
          onClick={() => setMore(true)}
        >
          Más opciones: notas <span className="sr-only">de {name}</span>
        </button>
      )}
    </li>
  );
}

function VariantPicker({
  variants,
  onAdd,
  onClose,
}: {
  variants: BuilderVariantVM[];
  onAdd: (variant: BuilderVariantVM) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  const matches = variants.filter((v) => words.every((w) => v.searchText.includes(w))).slice(0, 12);
  return (
    <section
      aria-labelledby="anadir-ejercicio"
      className="rounded-3xl border border-line bg-cream-50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="anadir-ejercicio" className="font-bold text-ink-900">
          Añadir ejercicio de la biblioteca
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar la biblioteca">
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <label className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-white px-3">
        <Search aria-hidden className="size-4 text-ink-500" />
        <span className="sr-only">Buscar ejercicio</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: sentadilla, remo…"
          className="h-12 min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
        {matches.map((variant) => (
          <li key={variant.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <ExercisePictogram silhouette={variant.silhouette} className="size-8 shrink-0" />
              <span className="truncate font-semibold text-ink-900">{variant.name}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAdd(variant)}
              aria-label={`Añadir ${variant.name}`}
            >
              <Plus aria-hidden className="size-4" /> Añadir
            </Button>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="py-2 text-sm text-ink-500">Sin resultados.</li>
        ) : null}
      </ul>
    </section>
  );
}
