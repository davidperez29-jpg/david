'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

export function AlertActions({ alertId, status }: { alertId: string; status: string }) {
  const a = useApiAction();
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  if (status === 'resolved') return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status === 'open' ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={a.pending}
          onClick={() => void a.run(`/alerts/${alertId}/status`, 'POST', { status: 'seen' })}
        >
          Marcar vista
        </Button>
      ) : null}
      {open ? (
        <span className="flex flex-wrap items-center gap-1">
          <input
            aria-label="Nota de resolución"
            placeholder="Qué se ha hecho (se audita)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 w-56 rounded-md border border-border bg-bg px-2 text-sm"
          />
          <Button
            size="sm"
            disabled={a.pending}
            onClick={() =>
              void a.run(`/alerts/${alertId}/status`, 'POST', {
                status: 'resolved',
                note: note.trim() || null,
              })
            }
          >
            Resolver
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Resolver…
        </Button>
      )}
      <FormError error={a.error} />
    </span>
  );
}

export function RefreshAlertsButton({ clientId }: { clientId: string }) {
  const a = useApiAction();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={a.pending}
      onClick={() => void a.run(`/clients/${clientId}/alerts/refresh`, 'POST', {})}
    >
      {a.pending ? 'Recalculando…' : 'Recalcular alertas'}
    </Button>
  );
}

/** Switch a rule off (or back on) for one client, with a reason (audited). */
export function RuleOverrideToggle({
  clientId,
  ruleKey,
  name,
  disabled,
  reason,
}: {
  clientId: string;
  ruleKey: string;
  name: string;
  disabled: boolean;
  reason: string | null;
}) {
  const a = useApiAction();
  const [why, setWhy] = useState('');
  return (
    <li className="flex flex-wrap items-center gap-2 py-1 text-sm">
      <span className={disabled ? 'text-muted line-through' : ''}>{name}</span>
      {disabled ? (
        <>
          <span className="text-xs text-muted">{reason ? `· ${reason}` : ''}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={a.pending}
            onClick={() =>
              void a.run(`/clients/${clientId}/rule-overrides`, 'PUT', { ruleKey, enabled: true })
            }
          >
            Reactivar
          </Button>
        </>
      ) : (
        <span className="flex items-center gap-1">
          <input
            aria-label={`Motivo para desactivar «${name}»`}
            placeholder="Motivo"
            value={why}
            maxLength={300}
            onChange={(e) => setWhy(e.target.value)}
            className="h-8 w-44 rounded-md border border-border bg-bg px-2 text-xs"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={a.pending || !why.trim()}
            onClick={() =>
              void a.run(`/clients/${clientId}/rule-overrides`, 'PUT', {
                ruleKey,
                enabled: false,
                reason: why.trim(),
              })
            }
          >
            Desactivar para este cliente
          </Button>
        </span>
      )}
      <FormError error={a.error} />
    </li>
  );
}

type Rule = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters: {
    key: string;
    label: string;
    value: number;
    default: number;
    min: number;
    max: number;
  }[];
};

/** Organization thresholds (ADMIN edits; trainers read). Saving creates a new audited version. */
export function RulesEditor({ rules, editable }: { rules: Rule[]; editable: boolean }) {
  const a = useApiAction();
  const [state, setState] = useState(rules);
  const [notes, setNotes] = useState('');
  const set = (k: string, patch: Partial<Rule>) =>
    setState((s) => s.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run('/monitoring/rules', 'PUT', {
          rules: state.map((r) => ({
            key: r.key,
            enabled: r.enabled,
            parameters: Object.fromEntries(r.parameters.map((p) => [p.key, p.value])),
          })),
          notes: notes.trim() || null,
        });
      }}
    >
      {state.map((r) => (
        <fieldset key={r.key} className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold">{r.name}</legend>
          <p className="text-xs text-muted">
            {r.description} Nivel F: recomendación práctica configurable.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={!editable}
              onChange={(e) => set(r.key, { enabled: e.target.checked })}
            />
            Activa
          </label>
          <div className="mt-2 flex flex-wrap gap-3">
            {r.parameters.map((p) => {
              const err = a.fieldError(`${r.key}.${p.key}`);
              return (
                <label key={p.key} className="flex flex-col gap-1 text-xs">
                  {p.label}
                  <input
                    type="number"
                    min={p.min}
                    max={p.max}
                    value={p.value}
                    disabled={!editable}
                    onChange={(e) =>
                      set(r.key, {
                        parameters: r.parameters.map((x) =>
                          x.key === p.key ? { ...x, value: Number(e.target.value) } : x,
                        ),
                      })
                    }
                    className="h-9 w-24 rounded-md border border-border bg-bg px-2 text-sm"
                  />
                  <span className="text-muted">
                    Por defecto {p.default} · {p.min}–{p.max}
                  </span>
                  {err ? <span className="text-danger">{err.join(' ')}</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Motivo del cambio (se audita)
            <input
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 w-80 rounded-md border border-border bg-bg px-2"
            />
          </label>
          <Button disabled={a.pending}>Guardar nueva versión</Button>
          {a.done ? <span className="text-sm text-ok">Guardado</span> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Solo la administración puede cambiar los umbrales.</p>
      )}
      <FormError error={a.error} />
    </form>
  );
}
