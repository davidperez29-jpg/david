'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';
import { LABELS } from '@/lib/labels';

const DAYS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DEFAULT_DAYS: Record<number, number[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

/** "Generar propuesta de plan" from the latest decision run (§12.2.5). */
export function GenerateProposalForm({
  clientId,
  proposed,
  templates,
  defaultStart,
}: {
  clientId: string;
  /** The template the decision engine proposed (null: none for this goal/frequency). */
  proposed: { id: string; name: string; sessionsPerWeek: number } | null;
  templates: { id: string; name: string; sessionsPerWeek: number }[];
  defaultStart: string;
}) {
  const router = useRouter();
  const a = useApiAction();
  const [templateId, setTemplateId] = useState(proposed?.id ?? templates[0]?.id ?? '');
  const t = templates.find((x) => x.id === templateId) ?? proposed;
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS[t?.sessionsPerWeek ?? 3] ?? [1, 3, 5]);
  const [startDate, setStartDate] = useState(defaultStart);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          `/clients/${clientId}/plan-proposals`,
          'POST',
          { templateId: templateId || undefined, startDate, weekdays: days },
          { refresh: false },
        );
        if (r) router.push(`/app/plans/${r.id}`);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Punto de partida
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            const n = templates.find((x) => x.id === e.target.value)?.sessionsPerWeek;
            if (n) setDays(DEFAULT_DAYS[n] ?? days);
          }}
          className="h-10 rounded-md border border-border bg-bg px-2"
        >
          {templates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.id === proposed?.id ? ' (propuesta del motor)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Fecha de inicio
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 w-48 rounded-md border border-border bg-bg px-2"
        />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Días de entrenamiento ({t?.sessionsPerWeek ?? '?'} por semana)
        </legend>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={LABELS.weekday[d]}
                onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
                className={`h-10 w-10 rounded-md border text-sm font-medium ${on ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-bg'}`}
              >
                {DAYS[d]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <Button disabled={a.pending || !startDate}>
          {a.pending ? 'Generando…' : 'Generar propuesta de plan'}
        </Button>
      </div>
      <FormError error={a.error} />
    </form>
  );
}

/** Banner actions of a PROPOSAL plan: accept as a draft plan or discard. */
export function ProposalActions({
  planId,
  clientId,
  name,
}: {
  planId: string;
  clientId: string;
  name: string;
}) {
  const router = useRouter();
  const a = useApiAction();
  const [newName, setNewName] = useState(name.replace(/^Propuesta · /, ''));
  const [reason, setReason] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Nombre del plan
          <input
            value={newName}
            maxLength={120}
            onChange={(e) => setNewName(e.target.value)}
            className="h-10 w-72 max-w-full rounded-md border border-border bg-bg px-2"
          />
        </label>
        <Button
          disabled={a.pending || newName.trim().length < 2}
          onClick={async () => {
            const r = await a.run(`/plans/${planId}/proposal/accept`, 'POST', {
              name: newName.trim(),
            });
            if (r) router.refresh();
          }}
        >
          Aceptar como plan (borrador)
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Motivo para descartar"
          placeholder="Motivo para descartar (opcional)"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          className="h-8 w-72 max-w-full rounded-md border border-border bg-bg px-2 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={a.pending}
          onClick={async () => {
            const r = await a.run(
              `/plans/${planId}/proposal/discard`,
              'POST',
              { reason: reason.trim() || null },
              { refresh: false },
            );
            if (r !== null) router.push(`/app/clients/${clientId}?tab=planificacion`);
          }}
        >
          Descartar propuesta
        </Button>
      </div>
      <FormError error={a.error} />
    </div>
  );
}

type Adjustment = {
  id: string;
  kind: string;
  status: string;
  params: {
    fromKg?: number;
    toKg?: number;
    setsDelta?: number;
    rirDelta?: number;
    toExerciseId?: string | null;
  };
  options: { id: string; name: string }[];
};

/** Aceptar · Editar · Rechazar · Posponer for one adjustment; Deshacer once applied. */
export function AdjustmentActions({ adj }: { adj: Adjustment }) {
  const a = useApiAction();
  const [mode, setMode] = useState<'none' | 'edit' | 'reject'>('none');
  const [reason, setReason] = useState('');
  const [toKg, setToKg] = useState(String(adj.params.toKg ?? ''));
  const [setsDelta, setSetsDelta] = useState(String(adj.params.setsDelta ?? -1));
  const [rirDelta, setRirDelta] = useState(String(adj.params.rirDelta ?? 2));
  const [toEx, setToEx] = useState(adj.params.toExerciseId ?? adj.options[0]?.id ?? '');
  const decide = (action: string, params?: Record<string, unknown>) =>
    a.run(`/adjustments/${adj.id}/decision`, 'POST', {
      action,
      reason: reason.trim() || null,
      ...(params ? { params } : {}),
    });

  if (adj.status === 'accepted' || adj.status === 'accepted_with_changes')
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={a.pending}
          onClick={() => void a.run(`/adjustments/${adj.id}/revert`, 'POST', {})}
        >
          Deshacer
        </Button>
        <FormError error={a.error} />
      </span>
    );
  if (adj.status !== 'proposed' && adj.status !== 'postponed') return null;

  const edited = () => {
    if (adj.kind === 'load_progression') return { toKg: Number(toKg.replace(',', '.')) };
    if (adj.kind === 'deload_week')
      return { setsDelta: Number(setsDelta), rirDelta: Number(rirDelta) };
    if (adj.kind === 'volume_reduction') return { setsDelta: Number(setsDelta) };
    return { toExerciseId: toEx };
  };
  const field = 'h-8 rounded-md border border-border bg-bg px-2 text-sm';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <Button size="sm" disabled={a.pending} onClick={() => void decide('accept')}>
          Aceptar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMode('edit')}>
          Editar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMode('reject')}>
          Rechazar
        </Button>
        {adj.status === 'proposed' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={a.pending}
            onClick={() => void decide('postpone')}
          >
            Posponer
          </Button>
        ) : null}
      </div>
      {mode === 'edit' ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void decide('accept_with_changes', edited());
          }}
        >
          {adj.kind === 'load_progression' ? (
            <label className="flex flex-col gap-1 text-xs">
              Nueva carga (kg)
              <input
                type="number"
                step="0.5"
                min={0}
                value={toKg}
                onChange={(e) => setToKg(e.target.value)}
                className={`${field} w-24`}
              />
            </label>
          ) : null}
          {adj.kind === 'deload_week' || adj.kind === 'volume_reduction' ? (
            <label className="flex flex-col gap-1 text-xs">
              Series (cambio)
              <select
                value={setsDelta}
                onChange={(e) => setSetsDelta(e.target.value)}
                className={field}
              >
                {['0', '-1', '-2', '-3'].map((v) => (
                  <option key={v} value={v}>
                    {v === '0' ? 'Sin cambio' : v}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {adj.kind === 'deload_week' ? (
            <label className="flex flex-col gap-1 text-xs">
              RIR (cambio)
              <select
                value={rirDelta}
                onChange={(e) => setRirDelta(e.target.value)}
                className={field}
              >
                {['0', '1', '2', '3', '4'].map((v) => (
                  <option key={v} value={v}>
                    {v === '0' ? 'Sin cambio' : `+${v}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {adj.kind === 'substitution' ? (
            <label className="flex flex-col gap-1 text-xs">
              Sustituir por
              <select value={toEx} onChange={(e) => setToEx(e.target.value)} className={field}>
                {adj.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <input
            aria-label="Motivo"
            placeholder="Motivo del cambio (se audita)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className={`${field} w-56`}
          />
          <Button size="sm" disabled={a.pending}>
            Aceptar con cambios
          </Button>
        </form>
      ) : null}
      {mode === 'reject' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Motivo"
            placeholder="Motivo del rechazo"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className={`${field} w-56`}
          />
          <Button
            size="sm"
            variant="danger"
            disabled={a.pending}
            onClick={() => void decide('reject')}
          >
            Confirmar rechazo
          </Button>
        </div>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}

export function BulkAcceptButton({ clientId, ids }: { clientId: string; ids: string[] }) {
  const a = useApiAction();
  const [result, setResult] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={a.pending}
        onClick={async () => {
          const r = await a.run<{ applied: number; failed: { id: string; message: string }[] }>(
            `/clients/${clientId}/adjustments/accept`,
            'POST',
            { ids },
          );
          if (r)
            setResult(
              `${r.applied} cambios aplicados${r.failed.length ? ` · ${r.failed.length} sin aplicar: ${r.failed[0]!.message}` : ''}`,
            );
        }}
      >
        Aceptar las {ids.length} progresiones de carga
      </Button>
      {result ? <span className="text-xs text-muted">{result}</span> : null}
      <FormError error={a.error} />
    </span>
  );
}

export function RefreshAdjustmentsButton({ clientId }: { clientId: string }) {
  const a = useApiAction();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={a.pending}
      onClick={() => void a.run(`/clients/${clientId}/adjustments/refresh`, 'POST', {})}
    >
      {a.pending ? 'Recalculando…' : 'Recalcular ajustes'}
    </Button>
  );
}

/** §12.2: off by default; when on, every change is still audited and can be undone. */
export function AutoApplyToggle({ clientId, enabled }: { clientId: string; enabled: boolean }) {
  const a = useApiAction();
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={enabled}
        disabled={a.pending}
        onChange={(e) =>
          void a.run(`/clients/${clientId}/auto-apply`, 'PUT', { enabled: e.target.checked })
        }
        className="mt-1"
      />
      <span>
        Aplicar las progresiones de carga rutinarias sin confirmación
        <span className="block text-xs text-muted">
          Desactivado por defecto. Solo cargas (no descargas ni sustituciones); cada cambio queda
          auditado y se puede deshacer.
        </span>
      </span>
      <FormError error={a.error} />
    </label>
  );
}
