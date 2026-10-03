'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

export function RunDecisionButton({ clientId, first }: { clientId: string; first: boolean }) {
  const a = useApiAction();
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant={first ? 'primary' : 'secondary'}
        disabled={a.pending}
        onClick={() => void a.run(`/clients/${clientId}/decision/run`, 'POST', {})}
      >
        {a.pending
          ? 'Calculando…'
          : first
            ? 'Calcular propuestas'
            : 'Recalcular con datos actuales'}
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

/** Editable fields per proposal type ("Editar" = accept with changes, audited per field). */
const EDITABLE: Record<string, { key: string; label: string; kind: 'number' | 'direction' }[]> = {
  need: [{ key: 'direction', label: 'Dirección', kind: 'direction' }],
  priority: [
    { key: 'sessionsPerWeek', label: 'Sesiones/semana', kind: 'number' },
    { key: 'minutesPerWeek', label: 'Minutos/semana', kind: 'number' },
  ],
  plan_proposal: [
    { key: 'sessionsPerWeek', label: 'Sesiones/semana', kind: 'number' },
    { key: 'reassessmentEveryWeeks', label: 'Reevaluar cada (semanas)', kind: 'number' },
  ],
};

/** Accept · Edit · Reject · Postpone · Disable a rule for this client (§13.9). */
export function RecommendationActions({
  id,
  clientId,
  type,
  status,
  payload,
  ruleKeys,
}: {
  id: string;
  clientId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  ruleKeys: string[];
}) {
  const a = useApiAction();
  const [mode, setMode] = useState<'none' | 'edit' | 'reject' | 'rule'>('none');
  const [reason, setReason] = useState('');
  const fields = EDITABLE[type] ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, String(payload[f.key] ?? '')])),
  );
  const [ruleKey, setRuleKey] = useState(ruleKeys[0] ?? '');
  if (status !== 'proposed' && status !== 'postponed') return null;

  const decide = (action: string, extra: Record<string, unknown> = {}) =>
    a.run(`/recommendations/${id}/decision`, 'POST', {
      action,
      reason: reason.trim() || null,
      ...extra,
    });
  const changes = () =>
    Object.fromEntries(
      fields
        .filter((f) => values[f.key] !== String(payload[f.key] ?? ''))
        .map((f) => [f.key, f.kind === 'number' ? Number(values[f.key]) : values[f.key]]),
    );
  const reasonInput = (placeholder: string) => (
    <input
      aria-label="Motivo"
      placeholder={placeholder}
      value={reason}
      maxLength={500}
      onChange={(e) => setReason(e.target.value)}
      className="h-8 w-56 rounded-md border border-border bg-bg px-2 text-sm"
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <Button size="sm" disabled={a.pending} onClick={() => void decide('accept')}>
          Aceptar
        </Button>
        {fields.length ? (
          <Button size="sm" variant="secondary" onClick={() => setMode('edit')}>
            Editar
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => setMode('reject')}>
          Rechazar
        </Button>
        {status === 'proposed' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={a.pending}
            onClick={() => void decide('postpone')}
          >
            Posponer
          </Button>
        ) : null}
        {ruleKeys.length ? (
          <Button size="sm" variant="ghost" onClick={() => setMode('rule')}>
            Desactivar regla para este cliente
          </Button>
        ) : null}
      </div>
      {mode === 'edit' ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void decide('accept_with_changes', { changes: changes() });
          }}
        >
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs">
              {f.label}
              {f.kind === 'direction' ? (
                <select
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-sm"
                >
                  <option value="desarrollar">Desarrollar</option>
                  <option value="mantener">Mantener</option>
                  <option value="no prioritario">No prioritario</option>
                </select>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="h-8 w-24 rounded-md border border-border bg-bg px-2 text-sm"
                />
              )}
            </label>
          ))}
          {reasonInput('Motivo del cambio (se audita)')}
          <Button size="sm" disabled={a.pending}>
            Aceptar con cambios
          </Button>
        </form>
      ) : null}
      {mode === 'reject' ? (
        <div className="flex flex-wrap items-center gap-2">
          {reasonInput('Motivo del rechazo')}
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
      {mode === 'rule' ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Regla"
            value={ruleKey}
            onChange={(e) => setRuleKey(e.target.value)}
            className="h-8 rounded-md border border-border bg-bg px-2 font-mono text-xs"
          >
            {ruleKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {reasonInput('Motivo (obligatorio)')}
          <Button
            size="sm"
            variant="secondary"
            disabled={a.pending || !reason.trim()}
            onClick={() =>
              void a.run(`/clients/${clientId}/rule-overrides`, 'PUT', {
                ruleKey,
                enabled: false,
                reason: reason.trim(),
              })
            }
          >
            Desactivar
          </Button>
          <span className="text-xs text-muted">Se aplica al recalcular.</span>
        </div>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}

/** The trainer's judgement of a trait when there is no applicable reference (§13.10). */
export function TraitFlagControl({
  clientId,
  trait,
  name,
  value,
}: {
  clientId: string;
  trait: string;
  name: string;
  value: boolean | null;
}) {
  const a = useApiAction();
  const set = (v: boolean | null) =>
    void a.run(`/clients/${clientId}/trait-flags`, 'PUT', { trait, value: v });
  return (
    <span
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={`Tu valoración: ${name}`}
    >
      <Button
        size="sm"
        variant={value === true ? 'primary' : 'secondary'}
        aria-pressed={value === true}
        disabled={a.pending}
        onClick={() => set(true)}
      >
        Sí
      </Button>
      <Button
        size="sm"
        variant={value === false ? 'primary' : 'secondary'}
        aria-pressed={value === false}
        disabled={a.pending}
        onClick={() => set(false)}
      >
        No
      </Button>
      {value !== null ? (
        <Button size="sm" variant="ghost" disabled={a.pending} onClick={() => set(null)}>
          Quitar
        </Button>
      ) : null}
      <FormError error={a.error} />
    </span>
  );
}

type Rule = {
  key: string;
  domain: string;
  description: string;
  enabled: boolean;
  evidenceLevel: string;
  evidenceClaimKeys: string[];
  limitations: string;
  condition: unknown;
  pending: boolean;
  parameters: {
    key: string;
    label: string;
    value: number | string | null;
    unit?: string;
    source: string;
  }[];
  stats: { decided: number; rejected: number; changed: number; rejectionRate: number } | null;
};

const DOMAINS: [string, string][] = [
  ['screening', 'Cribado'],
  ['needs', 'Necesidades'],
  ['prioritization', 'Priorización'],
  ['method_selection', 'Métodos'],
  ['exercise_selection', 'Ejercicios'],
  ['dosing', 'Dosis'],
  ['progression', 'Progresión'],
];

/** Decision rules as data (ADMIN edits; trainers read). Saving creates a new audited version. */
export function DecisionRulesEditor({ rules, editable }: { rules: Rule[]; editable: boolean }) {
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
        void a.run('/decision/rules', 'PUT', {
          rules: state.map((r) => ({
            key: r.key,
            enabled: r.enabled,
            parameters: Object.fromEntries(
              r.parameters
                .filter((p) => typeof p.value !== 'string')
                .map((p) => [p.key, p.value === '' ? null : p.value]),
            ),
          })),
          notes: notes.trim() || null,
        });
      }}
    >
      {DOMAINS.map(([domain, name]) => {
        const list = state.filter((r) => r.domain === domain);
        if (!list.length) return null;
        return (
          <section key={domain} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{name}</h2>
            {list.map((r) => (
              <fieldset key={r.key} className="rounded-lg border border-border p-3">
                <legend className="px-1 font-mono text-xs">{r.key}</legend>
                <p className="text-sm">{r.description}</p>
                <p className="mt-1 text-xs text-muted">
                  Nivel {r.evidenceLevel}
                  {r.evidenceClaimKeys.length
                    ? ` · Evidencia: ${r.evidenceClaimKeys.join(', ')}`
                    : ''}
                  {r.limitations ? ` · Limitaciones: ${r.limitations}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      disabled={!editable}
                      onChange={(e) => set(r.key, { enabled: e.target.checked })}
                    />
                    Activa
                  </label>
                  {r.stats ? (
                    <span
                      className={`text-xs ${r.stats.rejectionRate >= 50 && r.stats.decided >= 5 ? 'text-warn' : 'text-muted'}`}
                    >
                      {r.stats.decided} decididas · {r.stats.rejected} rechazadas (
                      {r.stats.rejectionRate.toLocaleString('es-ES')} %) · {r.stats.changed}{' '}
                      cambiadas
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Sin decisiones aún</span>
                  )}
                </div>
                {r.parameters.length ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {r.parameters.map((p) => {
                      const err = a.fieldError(`${r.key}.${p.key}`);
                      if (typeof p.value === 'string') return null;
                      return (
                        <label key={p.key} className="flex flex-col gap-1 text-xs">
                          {p.label}
                          {p.unit ? ` (${p.unit})` : ''}
                          <input
                            type="number"
                            step="any"
                            min={0}
                            value={p.value ?? ''}
                            placeholder="Sin definir"
                            disabled={!editable}
                            onChange={(e) =>
                              set(r.key, {
                                parameters: r.parameters.map((x) =>
                                  x.key === p.key
                                    ? {
                                        ...x,
                                        value:
                                          e.target.value === '' ? null : Number(e.target.value),
                                      }
                                    : x,
                                ),
                              })
                            }
                            className={`h-9 w-28 rounded-md border bg-bg px-2 text-sm ${p.value === null ? 'border-warn' : 'border-border'}`}
                          />
                          <span className="max-w-60 text-muted">{p.source}</span>
                          {p.value === null ? (
                            <span className="text-warn">
                              Pendiente: el motor no inventa este valor.
                            </span>
                          ) : null}
                          {err ? <span className="text-danger">{err.join(' ')}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted">Condición (DSL)</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-surface p-2">
                    {JSON.stringify(r.condition, null, 2)}
                  </pre>
                </details>
              </fieldset>
            ))}
          </section>
        );
      })}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Motivo del cambio (se audita)
            <input
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 w-80 max-w-full rounded-md border border-border bg-bg px-2"
            />
          </label>
          <Button disabled={a.pending}>Guardar nueva versión</Button>
          {a.done ? <span className="text-sm text-ok">Guardado</span> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Solo la administración puede cambiar las reglas.</p>
      )}
      <FormError error={a.error} />
    </form>
  );
}
