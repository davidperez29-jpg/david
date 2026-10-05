'use client';

import type { PlanTemplateSummary, SessionDetail } from '@tp/application';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExercisePicker } from '@/components/library/exercise-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { label, LABELS } from '@/lib/labels';

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));
const nul = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const DAYS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];

function Weekdays({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Días de entrenamiento</legend>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={LABELS.weekday[d]}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
              className={`h-10 w-10 rounded-md border text-sm font-medium ${on ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-bg'}`}
            >
              {DAYS[d]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── New plan ─────────────────────────────────────────────────────────────────

export function NewPlanForm({
  clientId,
  templates,
}: {
  clientId: string;
  templates: PlanTemplateSummary[];
}) {
  const router = useRouter();
  const a = useApiAction();
  const [mode, setMode] = useState<'template' | 'manual'>('template');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const DEFAULT_DAYS: Record<number, number[]> = {
    1: [1],
    2: [2, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  };
  const [days, setDays] = useState<number[]>(
    DEFAULT_DAYS[templates[0]?.sessionsPerWeek ?? 3] ?? [1, 3, 5],
  );
  const [months, setMonths] = useState('3');
  const [weeks, setWeeks] = useState('12');
  const t = templates.find((x) => x.id === templateId);
  const goals = [...new Set(templates.map((x) => x.goalSlug ?? ''))];
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r =
          mode === 'template'
            ? await a.run<{ id: string; conflicts: unknown[] }>(
                `/clients/${clientId}/plans/from-template`,
                'POST',
                { templateId, name: nul(name), startDate, weekdays: days },
                { refresh: false },
              )
            : await a.run<{ id: string }>(
                `/clients/${clientId}/plans`,
                'POST',
                {
                  name: name || 'Plan',
                  durationMonths: Number(months),
                  weeks: Number(weeks),
                  startDate: startDate || null,
                  weekdays: days,
                },
                { refresh: false },
              );
        if (r) router.push(`/app/plans/${r.id}`);
      }}
    >
      <div className="flex gap-2" role="radiogroup" aria-label="Cómo crear el plan">
        <Button
          type="button"
          variant={mode === 'template' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('template')}
        >
          Desde plantilla
        </Button>
        <Button
          type="button"
          variant={mode === 'manual' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('manual')}
        >
          En blanco
        </Button>
      </div>
      {mode === 'template' ? (
        <Field label="Plantilla" htmlFor="np-template">
          <select
            id="np-template"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const nt = templates.find((x) => x.id === e.target.value);
              if (nt && days.length !== nt.sessionsPerWeek)
                setDays(DEFAULT_DAYS[nt.sessionsPerWeek] ?? days);
            }}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
          >
            {goals.map((g) => (
              <optgroup key={g} label={label('goalSlug', g)}>
                {templates
                  .filter((x) => (x.goalSlug ?? '') === g)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.isGlobal ? '' : ' (propia)'}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
      ) : null}
      {mode === 'template' && t ? (
        <p className="text-xs text-muted">
          {t.sessionsPerWeek} sesiones/semana · {t.durationMonths} meses · métodos:{' '}
          {t.methodSlugs.join(', ') || '—'}.{' '}
          <a
            className="underline"
            href={`/app/plans/templates/${t.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver plantilla
          </a>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre" htmlFor="np-name">
          <Input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t && mode === 'template' ? t.name : 'Plan'}
          />
        </Field>
        <Field label="Inicio" htmlFor="np-start">
          <Input
            id="np-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required={mode === 'template'}
          />
        </Field>
        {mode === 'manual' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Meses" htmlFor="np-months">
              <Select
                id="np-months"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                options={['3', '6', '9', '12'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Semanas" htmlFor="np-weeks">
              <Input
                id="np-weeks"
                inputMode="numeric"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </div>
      <Weekdays value={days} onChange={setDays} />
      {mode === 'template' && t && days.length !== t.sessionsPerWeek ? (
        <p className="text-xs text-warn">Elige {t.sessionsPerWeek} días para esta plantilla.</p>
      ) : null}
      <FormError error={a.error} />
      <Button
        disabled={
          a.pending ||
          (mode === 'template' && (!t || days.length !== t.sessionsPerWeek || !startDate))
        }
        className="self-start"
      >
        Crear plan
      </Button>
    </form>
  );
}

// ── Plan actions ─────────────────────────────────────────────────────────────

export function PlanActions({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const a = useApiAction();
  const [reason, setReason] = useState('');
  const [tplName, setTplName] = useState('');
  const [copyName, setCopyName] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'draft' ? (
          <Button
            size="sm"
            disabled={a.pending}
            onClick={() => a.run(`/plans/${planId}/status`, 'POST', { status: 'active' })}
          >
            Activar plan
          </Button>
        ) : null}
        {status === 'active' ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={a.pending}
            onClick={() => a.run(`/plans/${planId}/status`, 'POST', { status: 'completed' })}
          >
            Marcar como completado
          </Button>
        ) : null}
        {status !== 'archived' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={a.pending}
            onClick={() => a.run(`/plans/${planId}/status`, 'POST', { status: 'archived' })}
          >
            Archivar
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          aria-label="Motivo de la revisión"
          placeholder="Motivo de la revisión"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={a.pending || reason.trim().length < 3}
          onClick={async () => {
            if (await a.run(`/plans/${planId}/revisions`, 'POST', { reason })) setReason('');
          }}
        >
          Guardar revisión
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          aria-label="Nombre de la copia"
          placeholder="Nombre de la copia"
          value={copyName}
          onChange={(e) => setCopyName(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={a.pending || copyName.trim().length < 2}
          onClick={async () => {
            const r = await a.run<{ id: string }>(
              `/plans/${planId}/duplicate`,
              'POST',
              { name: copyName },
              { refresh: false },
            );
            if (r) router.push(`/app/plans/${r.id}`);
          }}
        >
          Duplicar plan
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          aria-label="Nombre de la plantilla"
          placeholder="Nombre de la plantilla"
          value={tplName}
          onChange={(e) => setTplName(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={a.pending || tplName.trim().length < 2}
          onClick={async () => {
            if (await a.run(`/plans/${planId}/template`, 'POST', { name: tplName })) setTplName('');
          }}
        >
          Guardar como plantilla
        </Button>
        <span className="text-xs text-muted">Sin cliente, sin fechas y con cargas relativas.</span>
      </div>
      {a.done ? <p className="text-sm text-ok">Hecho.</p> : null}
      <FormError error={a.error} />
    </div>
  );
}

export function WeekTypeSelect({ microcycleId, value }: { microcycleId: string; value: string }) {
  const a = useApiAction();
  return (
    <select
      aria-label="Tipo de semana"
      value={value}
      disabled={a.pending}
      onChange={(e) =>
        void a.run(`/microcycles/${microcycleId}`, 'PATCH', { weekType: e.target.value })
      }
      className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
    >
      {Object.entries(LABELS.weekType).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function CopyWeekButton({
  microcycleId,
  weeks,
}: {
  microcycleId: string;
  weeks: { id: string; weekIndex: number }[];
}) {
  const a = useApiAction();
  const [target, setTarget] = useState('');
  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label="Duplicar esta semana en"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
      >
        <option value="">Duplicar esta semana en…</option>
        {weeks
          .filter((w) => w.id !== microcycleId)
          .map((w) => (
            <option key={w.id} value={w.id}>
              Semana {w.weekIndex}
            </option>
          ))}
      </select>
      <Button
        size="sm"
        variant="ghost"
        disabled={!target || a.pending}
        onClick={() => {
          if (confirm('Se reemplazarán las sesiones de la semana de destino. ¿Continuar?'))
            void a.run(`/microcycles/${microcycleId}/duplicate`, 'POST', {
              targetMicrocycleId: target,
            });
        }}
      >
        Duplicar semana
      </Button>
    </span>
  );
}

// ── Session editor ───────────────────────────────────────────────────────────

type Ex = SessionDetail['blocks'][number]['exercises'][number];
const ALL_VARS = [
  'sets',
  'repsMin',
  'repsMax',
  'loadKg',
  'loadPct1rm',
  'rirMin',
  'rirMax',
  'rpeTarget',
  'restS',
  'tempo',
  'durationS',
  'distanceM',
  'contacts',
  'velocityTargetMps',
  'velocityLossPct',
  'repsPerCluster',
  'intraClusterRestS',
  'chainLoadKg',
  'effortCharacter',
  'intensityNote',
] as const;
/** Profile variable keys (catalogue) → prescription fields shown by default (§12.5). */
const PROFILE_FIELDS: Record<string, string[]> = {
  sets: ['sets'],
  reps: ['repsMin', 'repsMax'],
  load: ['loadKg'],
  pct_1rm: ['loadPct1rm'],
  rir: ['rirMin', 'rirMax'],
  rpe: ['rpeTarget'],
  rest: ['restS'],
  tempo: ['tempo'],
  duration: ['durationS'],
  distance: ['distanceM'],
  contacts: ['contacts'],
  velocity_target: ['velocityTargetMps'],
  velocity_loss: ['velocityLossPct'],
  chain_load: ['chainLoadKg'],
  pct_mvc: ['intensityNote'],
  pct_vmax: ['intensityNote'],
  heart_rate_zone: ['intensityNote'],
};
const TEXT_FIELDS = new Set(['tempo', 'effortCharacter', 'intensityNote']);

function visibleFields(e: Ex): string[] {
  const base = new Set<string>(e.visibleVariables.flatMap((v) => PROFILE_FIELDS[v] ?? []));
  if (!base.size) ['sets', 'repsMin', 'repsMax', 'restS'].forEach((f) => base.add(f));
  base.add('restS');
  for (const [k, v] of Object.entries(e.prescription)) if (v != null && v !== '') base.add(k);
  return ALL_VARS.filter((f) => base.has(f));
}

export function ExerciseRow({ e, editable }: { e: Ex; editable: boolean }) {
  const a = useApiAction();
  const [all, setAll] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(
      ALL_VARS.map((k) => [
        k,
        e.prescription[k as keyof typeof e.prescription] == null
          ? ''
          : String(e.prescription[k as keyof typeof e.prescription]),
      ]),
    ),
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(e.notesForClient ?? '');
  const fields = all ? [...ALL_VARS] : visibleFields(e);
  const needsReason = e.derived || e.source !== 'manual';
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        {e.pairingLabel ? <Badge>{e.pairingLabel}</Badge> : null}
        <span className="font-medium">{e.exercise.name}</span>
        <span className="text-sm text-muted">{e.short}</span>
        {e.derived ? <Badge tone="accent">Progresión automática</Badge> : null}
        {e.source === 'template' && !e.derived ? <Badge>De plantilla</Badge> : null}
        {e.methods.map((m) => (
          <a
            key={m.id}
            href={`/app/science/methods/${m.id}`}
            className="text-xs text-accent underline"
          >
            {m.name}
          </a>
        ))}
        {editable ? (
          <span className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Subir ${e.exercise.name}`}
              onClick={() => a.run(`/session-exercises/${e.id}/move`, 'POST', { direction: 'up' })}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Bajar ${e.exercise.name}`}
              onClick={() =>
                a.run(`/session-exercises/${e.id}/move`, 'POST', { direction: 'down' })
              }
            >
              ↓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Quitar ${e.exercise.name}`}
              onClick={() => a.run(`/session-exercises/${e.id}`, 'DELETE')}
            >
              Quitar
            </Button>
          </span>
        ) : null}
      </div>
      <p className="text-xs">
        <span className="text-muted">Para el cliente: </span>
        {e.clientText || '—'}
      </p>
      {e.coachNotes ? <p className="text-xs text-muted">{e.coachNotes}</p> : null}
      {Object.values(e.issues)
        .flat()
        .map((m) => (
          <p key={m} className="text-xs text-warn">
            {m}
          </p>
        ))}
      <AlternativesEditor e={e} editable={editable} />
      {editable ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const prescription = Object.fromEntries(
              fields.map((k) => [
                k,
                TEXT_FIELDS.has(k) ? nul(vals[k] ?? '') : numOrNull(vals[k] ?? ''),
              ]),
            );
            void a.run(`/session-exercises/${e.id}`, 'PATCH', {
              expectedVersion: e.version,
              prescription,
              notesForClient: nul(notes),
              overrideReason: nul(reason),
            });
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            {fields.map((k) => (
              <Field
                key={k}
                label={label('prescriptionVar', k)}
                htmlFor={`${e.id}-${k}`}
                error={a.fieldError(k)}
              >
                <Input
                  id={`${e.id}-${k}`}
                  value={vals[k] ?? ''}
                  inputMode={TEXT_FIELDS.has(k) ? 'text' : 'decimal'}
                  className="w-24"
                  onChange={(ev) => setVals({ ...vals, [k]: ev.target.value })}
                />
              </Field>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll(!all)}>
              {all ? 'Menos variables' : '＋ variable'}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              aria-label={`Nota para el cliente de ${e.exercise.name}`}
              placeholder="Nota para el cliente"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              className="max-w-sm"
            />
            {needsReason ? (
              <Input
                aria-label={`Motivo del cambio de ${e.exercise.name}`}
                placeholder="Motivo del cambio (se audita)"
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                className="max-w-xs"
              />
            ) : null}
            <Button size="sm" disabled={a.pending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <FormError error={a.error} />
    </li>
  );
}

/** Pre-approved alternatives the client may switch to during the session (§9.3). */
function AlternativesEditor({ e, editable }: { e: Ex; editable: boolean }) {
  const a = useApiAction();
  const ids = e.alternatives.map((x) => x.id);
  const save = (next: string[]) =>
    void a.run(`/session-exercises/${e.id}`, 'PATCH', {
      expectedVersion: e.version,
      alternativeExerciseIds: next,
    });
  if (!editable && !ids.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted">Alternativas aprobadas para el cliente:</span>
      {e.alternatives.length ? null : <span className="text-muted">ninguna</span>}
      {e.alternatives.map((x) => (
        <span
          key={x.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
        >
          {x.name}
          {editable ? (
            <button
              type="button"
              aria-label={`Quitar alternativa ${x.name}`}
              onClick={() => save(ids.filter((i) => i !== x.id))}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {editable && ids.length < 5 ? (
        <span className="w-64">
          <ExercisePicker
            ariaLabel={`Añadir alternativa a ${e.exercise.name}`}
            onPick={(hit) => save([...ids, hit.id])}
          />
        </span>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}

export function AddExercise({ blockId }: { blockId: string }) {
  const a = useApiAction();
  return (
    <div className="max-w-md">
      <ExercisePicker
        ariaLabel="Añadir ejercicio al bloque"
        onPick={(hit) =>
          void a.run(`/session-blocks/${blockId}/exercises`, 'POST', {
            exerciseId: hit.id,
            prescription: { sets: 3 },
          })
        }
      />
      <FormError error={a.error} />
    </div>
  );
}

export function BlockActions({ blockId }: { blockId: string }) {
  const a = useApiAction();
  return (
    <span className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Subir bloque"
        onClick={() => a.run(`/session-blocks/${blockId}/move`, 'POST', { direction: 'up' })}
      >
        ↑
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Bajar bloque"
        onClick={() => a.run(`/session-blocks/${blockId}/move`, 'POST', { direction: 'down' })}
      >
        ↓
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (confirm('¿Eliminar el bloque y sus ejercicios?'))
            void a.run(`/session-blocks/${blockId}`, 'DELETE');
        }}
      >
        Eliminar bloque
      </Button>
    </span>
  );
}

export function AddBlock({ sessionId }: { sessionId: string }) {
  const a = useApiAction();
  const [type, setType] = useState('main_strength');
  const [org, setOrg] = useState('straight_sets');
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.run(`/plan-sessions/${sessionId}/blocks`, 'POST', {
          type,
          organization: org,
          label: nul(name),
        });
      }}
    >
      <Field label="Tipo de bloque" htmlFor="nb-type">
        <Select
          id="nb-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={opts(LABELS.blockType)}
        />
      </Field>
      <Field label="Organización" htmlFor="nb-org">
        <Select
          id="nb-org"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          options={opts(LABELS.blockOrganization)}
        />
      </Field>
      <Field label="Nombre" htmlFor="nb-name">
        <Input id="nb-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button size="sm" disabled={a.pending}>
        Añadir bloque
      </Button>
      <FormError error={a.error} />
    </form>
  );
}

export function SessionMetaForm({ s }: { s: SessionDetail }) {
  const a = useApiAction();
  const [f, setF] = useState({
    title: s.title ?? '',
    scheduledDate: s.scheduledDate ?? '',
    objective: s.objective ?? '',
    notesForClient: s.notesForClient ?? '',
    targetSessionRpe: s.targetSessionRpe ?? '',
  });
  const [target, setTarget] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void a.run(`/plan-sessions/${s.id}`, 'PATCH', {
            expectedVersion: s.version,
            title: nul(f.title),
            scheduledDate: f.scheduledDate || null,
            objective: nul(f.objective),
            notesForClient: nul(f.notesForClient),
            targetSessionRpe: numOrNull(String(f.targetSessionRpe)),
          });
        }}
      >
        <Field label="Título" htmlFor="sm-title">
          <Input
            id="sm-title"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </Field>
        <Field label="Fecha" htmlFor="sm-date">
          <Input
            id="sm-date"
            type="date"
            value={f.scheduledDate}
            onChange={(e) => setF({ ...f, scheduledDate: e.target.value })}
          />
        </Field>
        <Field label="Objetivo" htmlFor="sm-obj">
          <Input
            id="sm-obj"
            value={f.objective}
            onChange={(e) => setF({ ...f, objective: e.target.value })}
          />
        </Field>
        <Field
          label="RPE previsto de la sesión (0–10)"
          htmlFor="sm-srpe"
          error={a.fieldError('targetSessionRpe')}
        >
          <Input
            id="sm-srpe"
            inputMode="decimal"
            value={String(f.targetSessionRpe)}
            onChange={(e) => setF({ ...f, targetSessionRpe: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-3">
          <Field label="Nota para el cliente" htmlFor="sm-notes">
            <Textarea
              id="sm-notes"
              rows={2}
              value={f.notesForClient}
              onChange={(e) => setF({ ...f, notesForClient: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Button size="sm" disabled={a.pending}>
            Guardar sesión
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Duplicar sesión en la semana"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
        >
          <option value="">Duplicar en la semana…</option>
          {s.weeks.map((w) => (
            <option key={w.id} value={w.id}>
              Semana {w.weekIndex}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!target || a.pending}
          onClick={() =>
            a.run(`/plan-sessions/${s.id}/duplicate`, 'POST', { targetMicrocycleId: target })
          }
        >
          Duplicar sesión
        </Button>
      </div>
      {a.done ? <p className="text-sm text-ok">Guardado.</p> : null}
      <FormError error={a.error} />
    </div>
  );
}
