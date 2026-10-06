'use client';

/**
 * Readaptación actions (restructure phase 7, docs/INJURY_MODULE.md). Every change is a person's
 * action: the software never advances a phase nor decides a return to sport.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

type Opt = { value: string; label: string };
const base = (clientId: string, injuryId: string) => `/clients/${clientId}/injuries/${injuryId}`;

export function NewInjuryForm({
  clientId,
  conditions,
  sides,
  today,
}: {
  clientId: string;
  conditions: {
    id: string;
    name: string;
    regionLabel: string;
    protocols: { id: string; name: string; protocolVersion: number }[];
  }[];
  sides: Opt[];
  today: string;
}) {
  const router = useRouter();
  const a = useApiAction();
  const [conditionId, setConditionId] = useState('');
  const cond = conditions.find((c) => c.id === conditionId);
  const [protocolId, setProtocolId] = useState('');
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await a.run<{ id: string }>(
          `/clients/${clientId}/injuries`,
          'POST',
          {
            conditionId,
            protocolId: protocolId || cond?.protocols[0]?.id || null,
            side: f.get('side'),
            occurredOn: f.get('occurredOn'),
            mechanism: f.get('mechanism'),
            diagnosis: f.get('diagnosis'),
            professional: f.get('professional'),
          },
          { refresh: false },
        );
        if (r) router.push(`/app/clients/${clientId}/lesiones/${r.id}`);
      }}
    >
      <Field label="Lesión" htmlFor="inj-condition" error={a.fieldError('conditionId')}>
        <Select
          id="inj-condition"
          required
          value={conditionId}
          onChange={(e) => {
            setConditionId(e.target.value);
            setProtocolId('');
          }}
          placeholder="Elige la lesión…"
          options={conditions.map((c) => ({ value: c.id, label: `${c.name} (${c.regionLabel})` }))}
        />
      </Field>
      <Field label="Protocolo" htmlFor="inj-protocol" error={a.fieldError('protocolId')}>
        <Select
          id="inj-protocol"
          value={protocolId || cond?.protocols[0]?.id || ''}
          onChange={(e) => setProtocolId(e.target.value)}
          disabled={!cond}
          options={(cond?.protocols ?? []).map((p) => ({
            value: p.id,
            label: `${p.name} · v${p.protocolVersion}`,
          }))}
        />
      </Field>
      <Field label="Lado" htmlFor="inj-side">
        <Select id="inj-side" name="side" defaultValue="none" options={sides} />
      </Field>
      <Field label="Fecha de la lesión" htmlFor="inj-date" error={a.fieldError('occurredOn')}>
        <Input id="inj-date" name="occurredOn" type="date" required max={today} />
      </Field>
      <Field label="Mecanismo (opcional)" htmlFor="inj-mech">
        <Input id="inj-mech" name="mechanism" maxLength={500} />
      </Field>
      <Field
        label="Profesional sanitario que la valoró (opcional)"
        htmlFor="inj-prof"
        hint="Nombre o especialidad."
      >
        <Input id="inj-prof" name="professional" maxLength={200} />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Información recibida del profesional sanitario (opcional)"
          htmlFor="inj-diag"
          hint="Se guarda cifrada. La plataforma no diagnostica: copia lo que te han indicado."
        >
          <Textarea id="inj-diag" name="diagnosis" maxLength={2000} />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={a.error} />
        <Button disabled={a.pending || !conditionId} className="self-start">
          Abrir caso
        </Button>
      </div>
    </form>
  );
}

export function CriterionCheck({
  clientId,
  injuryId,
  criterionId,
  met,
  name,
}: {
  clientId: string;
  injuryId: string;
  criterionId: string;
  met: boolean | null;
  name: string;
}) {
  const a = useApiAction();
  const set = (v: boolean) =>
    a.run(`${base(clientId, injuryId)}/criteria`, 'POST', { criterionId, met: v });
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Marcar: ${name}`}>
      <Button
        type="button"
        size="sm"
        variant={met === true ? 'primary' : 'secondary'}
        aria-pressed={met === true}
        disabled={a.pending}
        onClick={() => set(true)}
      >
        Cumplido
      </Button>
      <Button
        type="button"
        size="sm"
        variant={met === false ? 'danger' : 'secondary'}
        aria-pressed={met === false}
        disabled={a.pending}
        onClick={() => set(false)}
      >
        No cumplido
      </Button>
      <FormError error={a.error} />
    </div>
  );
}

export function AdvancePhaseButton({
  clientId,
  injuryId,
  phaseId,
  allowed,
  reasons,
  nextName,
}: {
  clientId: string;
  injuryId: string;
  phaseId: string;
  allowed: boolean;
  reasons: string[];
  nextName: string | null;
}) {
  const a = useApiAction();
  const id = `advance-${phaseId}`;
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={!allowed || a.pending}
        aria-describedby={reasons.length ? id : undefined}
        onClick={() =>
          a.run(`${base(clientId, injuryId)}/advance`, 'POST', { fromPhaseId: phaseId })
        }
        className="self-start"
      >
        Avanzar de fase{nextName ? ` → ${nextName}` : ''}
      </Button>
      {reasons.length ? (
        <ul id={id} className="list-disc pl-5 text-sm text-muted">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}

const FLAGS = [
  ['worseThanBefore', 'Peor que en el registro anterior'],
  ['persistsNextDay', 'Persiste al día siguiente'],
  ['swelling', 'Inflamación importante'],
  ['instability', 'Inestabilidad'],
  ['functionLoss', 'Pérdida importante de función'],
  ['adverseReaction', 'Reacción adversa a la sesión'],
  ['neurological', 'Síntomas neurológicos (hormigueo, pérdida de fuerza o sensibilidad)'],
] as const;

export function SymptomForm({
  clientId,
  injuryId,
  today,
  painThreshold,
}: {
  clientId: string;
  injuryId: string;
  today: string;
  painThreshold: number;
}) {
  const a = useApiAction();
  const [alerts, setAlerts] = useState<{ message: string }[] | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const body: Record<string, unknown> = {
          recordedOn: f.get('recordedOn'),
          pain: Number(f.get('pain')),
          note: f.get('note'),
        };
        for (const [k] of FLAGS) body[k] = f.get(k) === 'on';
        const r = await a.run<{ alerts: { message: string }[] }>(
          `${base(clientId, injuryId)}/symptoms`,
          'POST',
          body,
        );
        if (r) {
          setAlerts(r.alerts);
          form.reset();
        }
      }}
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Fecha" htmlFor="sym-date">
          <Input
            id="sym-date"
            name="recordedOn"
            type="date"
            required
            defaultValue={today}
            max={today}
          />
        </Field>
        <Field
          label="Dolor (0–10)"
          htmlFor="sym-pain"
          hint={`Umbral del protocolo: ${painThreshold}/10`}
          error={a.fieldError('pain')}
        >
          <Input
            id="sym-pain"
            name="pain"
            type="number"
            min={0}
            max={10}
            required
            className="w-24"
          />
        </Field>
      </div>
      <fieldset className="grid gap-1 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Señales</legend>
        {FLAGS.map(([k, text]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={k} /> {text}
          </label>
        ))}
      </fieldset>
      <Field label="Nota (opcional)" htmlFor="sym-note" hint="Se guarda cifrada.">
        <Input id="sym-note" name="note" maxLength={1000} />
      </Field>
      <FormError error={a.error} />
      {alerts ? (
        alerts.length ? (
          <div role="status" className="rounded-md border border-warn p-3 text-sm">
            <p className="font-medium">Alertas generadas:</p>
            <ul className="list-disc pl-5">
              {alerts.map((x) => (
                <li key={x.message}>{x.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted">
            Registro guardado sin alertas.
          </p>
        )
      ) : null}
      <Button disabled={a.pending} className="self-start">
        Registrar síntomas
      </Button>
    </form>
  );
}

export function AlertReviewForm({
  clientId,
  injuryId,
  alertId,
}: {
  clientId: string;
  injuryId: string;
  alertId: string;
}) {
  const a = useApiAction();
  const id = `review-${alertId}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await a.run(`${base(clientId, injuryId)}/alerts/${alertId}/review`, 'POST', {
          note: f.get('note'),
        });
      }}
    >
      <Field label="Qué se ha valorado y con quién" htmlFor={id} error={a.fieldError('note')}>
        <Input id={id} name="note" required minLength={3} maxLength={1000} className="w-80" />
      </Field>
      <Button size="md" variant="secondary" disabled={a.pending}>
        Marcar como revisada
      </Button>
      <FormError error={a.error} />
    </form>
  );
}

export function RequestDecisionButton({
  clientId,
  injuryId,
}: {
  clientId: string;
  injuryId: string;
}) {
  const a = useApiAction();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="self-start"
        disabled={a.pending}
        onClick={() => a.run(`${base(clientId, injuryId)}/request-decision`, 'POST')}
      >
        Pedir valoración al equipo responsable
      </Button>
      <FormError error={a.error} />
    </div>
  );
}

export function DecisionForm({
  clientId,
  injuryId,
  stages,
  outcomes,
  today,
}: {
  clientId: string;
  injuryId: string;
  stages: Opt[];
  outcomes: Opt[];
  today: string;
}) {
  const a = useApiAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const r = await a.run(`${base(clientId, injuryId)}/decisions`, 'POST', {
          stage: f.get('stage'),
          outcome: f.get('outcome'),
          decidedByName: f.get('decidedByName'),
          decidedByRole: f.get('decidedByRole'),
          decidedOn: f.get('decidedOn'),
          rationale: f.get('rationale'),
        });
        if (r) form.reset();
      }}
    >
      <Field label="Etapa" htmlFor="dec-stage">
        <Select id="dec-stage" name="stage" options={stages} />
      </Field>
      <Field label="Decisión" htmlFor="dec-outcome">
        <Select id="dec-outcome" name="outcome" options={outcomes} defaultValue="not_yet" />
      </Field>
      <Field label="Quién decide" htmlFor="dec-name" error={a.fieldError('decidedByName')}>
        <Input id="dec-name" name="decidedByName" required maxLength={120} />
      </Field>
      <Field
        label="Rol"
        htmlFor="dec-role"
        hint="Medicina, fisioterapia, cuerpo técnico…"
        error={a.fieldError('decidedByRole')}
      >
        <Input id="dec-role" name="decidedByRole" required maxLength={120} />
      </Field>
      <Field label="Fecha" htmlFor="dec-date">
        <Input
          id="dec-date"
          name="decidedOn"
          type="date"
          required
          defaultValue={today}
          max={today}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Motivo (opcional)" htmlFor="dec-why" error={a.fieldError('rationale')}>
          <Textarea id="dec-why" name="rationale" maxLength={2000} />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={a.error} />
        <Button disabled={a.pending} className="self-start">
          Registrar decisión
        </Button>
      </div>
    </form>
  );
}

export function CloseInjuryButton({ clientId, injuryId }: { clientId: string; injuryId: string }) {
  const a = useApiAction();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">¿Cerrar el caso? Quedará como histórico.</span>
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={a.pending}
        onClick={() => a.run(`${base(clientId, injuryId)}/close`, 'POST', {})}
      >
        Sí, cerrar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Cancelar
      </Button>
      <FormError error={a.error} />
    </div>
  ) : (
    <Button type="button" variant="secondary" size="sm" onClick={() => setConfirm(true)}>
      Cerrar caso
    </Button>
  );
}
