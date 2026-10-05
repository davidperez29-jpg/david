'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { LABELS } from '@/lib/labels';

export interface ProfileOption {
  slug: string;
  name: string;
}

const DAY_LETTERS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** Usual days for N sessions a week (the trainer changes them with one click). */
export const DEFAULT_DAYS: Record<number, number[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};
const DURATIONS = [3, 6, 9, 12];
const LEVELS = [
  { value: '1', label: 'Nivel 1 · Inicial' },
  { value: '2', label: 'Nivel 2 · Intermedio' },
  { value: '3', label: 'Nivel 3 · Avanzado' },
];
export const POPULATION_LABELS: Record<string, string> = {
  adultos: 'Adultos',
  adulto_mayor: 'Adulto mayor',
  deportistas: 'Deportistas',
  jovenes: 'Jóvenes',
  pc_leve: 'Parálisis cerebral leve',
};
export const KIND_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  risk_reduction: 'Reducción de factores de riesgo',
  readaptation: 'Readaptación',
};

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
              {DAY_LETTERS[d]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * «Usar plantilla»: start date, days and duration → an independent plan for the client
 * (decision A17: the duration is chosen here). Opens the new plan to review and activate it.
 */
export function UseTemplateForm({
  template,
  clientId,
  clients,
}: {
  template: {
    id: string;
    name: string;
    sessionsPerWeek: number;
    durationMonths: number;
    fixedLength: boolean;
  };
  /** The client the trainer came from; otherwise they choose one. */
  clientId?: string;
  clients?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const a = useApiAction();
  const [client, setClient] = useState(clientId ?? '');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(DEFAULT_DAYS[template.sessionsPerWeek] ?? [1, 3, 5]);
  const durations = template.fixedLength
    ? DURATIONS.filter((d) => d <= template.durationMonths)
    : DURATIONS;
  const [months, setMonths] = useState(
    String(template.fixedLength ? template.durationMonths : Math.min(3, template.durationMonths)),
  );
  const [name, setName] = useState('');
  const id = `use-${template.id}`;
  const ok = !!client && !!startDate && days.length === template.sessionsPerWeek;
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={`Usar «${template.name}»`}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          `/clients/${client}/plans/from-template`,
          'POST',
          {
            templateId: template.id,
            name: name.trim() || null,
            startDate,
            weekdays: days,
            durationMonths: Number(months),
          },
          { refresh: false },
        );
        if (r) router.push(`/app/plans/${r.id}`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {clientId ? null : (
          <Field label="Cliente" htmlFor={`${id}-client`}>
            <Select
              id={`${id}-client`}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Elige…"
              options={(clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        )}
        <Field label="Inicio" htmlFor={`${id}-start`}>
          <Input
            id={`${id}-start`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Duración"
          htmlFor={`${id}-months`}
          hint={
            template.fixedLength ? 'Guardada desde un plan real: solo puede acortarse.' : undefined
          }
        >
          <Select
            id={`${id}-months`}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            options={durations.map((d) => ({ value: String(d), label: `${d} meses` }))}
          />
        </Field>
        <Field label="Nombre del plan" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={name}
            placeholder={template.name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>
      <Weekdays value={days} onChange={setDays} />
      {days.length !== template.sessionsPerWeek ? (
        <p className="text-xs text-warn">
          Elige {template.sessionsPerWeek} días: la plantilla tiene {template.sessionsPerWeek}{' '}
          sesiones por semana.
        </p>
      ) : null}
      <FormError error={a.error} />
      <Button disabled={a.pending || !ok} className="self-start">
        {a.pending ? 'Creando…' : 'Crear plan'}
      </Button>
    </form>
  );
}

/** «Crear desde cero»: name, days, profile and level; opens the template to fill its sessions. */
export function NewTemplateForm({ profiles }: { profiles: ProfileOption[] }) {
  const router = useRouter();
  const a = useApiAction();
  const [name, setName] = useState('');
  const [days, setDays] = useState('3');
  const [profile, setProfile] = useState('');
  const [level, setLevel] = useState('');
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          '/plan-templates',
          'POST',
          {
            name,
            sessionsPerWeek: Number(days),
            profileSlug: profile || null,
            levelN: level ? Number(level) : null,
          },
          { refresh: false },
        );
        if (r) router.push(`/app/plans/templates/${r.id}`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Nombre" htmlFor="nt-name" error={a.fieldError('name')}>
          <Input id="nt-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Sesiones por semana" htmlFor="nt-days">
          <Select
            id="nt-days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: String(d) }))}
          />
        </Field>
        <Field label="Perfil" htmlFor="nt-profile">
          <Select
            id="nt-profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="Cualquiera"
            options={profiles.map((p) => ({ value: p.slug, label: p.name }))}
          />
        </Field>
        <Field label="Nivel" htmlFor="nt-level">
          <Select
            id="nt-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="Cualquiera"
            options={LEVELS}
          />
        </Field>
      </div>
      <FormError error={a.error} />
      <Button disabled={a.pending || name.trim().length < 2} className="self-start">
        Crear y rellenar
      </Button>
    </form>
  );
}

export function DuplicateTemplateButton({ id, global }: { id: string; global: boolean }) {
  const router = useRouter();
  const a = useApiAction();
  return (
    <span className="flex flex-col gap-1">
      <Button
        size="sm"
        variant={global ? 'primary' : 'secondary'}
        disabled={a.pending}
        onClick={async () => {
          const r = await a.run<{ id: string }>(
            `/plan-templates/${id}/duplicate`,
            'POST',
            {},
            { refresh: false },
          );
          if (r) router.push(`/app/plans/templates/${r.id}`);
        }}
      >
        {global ? 'Duplicar en mis plantillas' : 'Duplicar'}
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

export function ArchiveTemplateButton({ id, archived }: { id: string; archived: boolean }) {
  const a = useApiAction();
  return (
    <span className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={a.pending}
        onClick={() => a.run(`/plan-templates/${id}/archive`, 'POST', { archived: !archived })}
      >
        {archived ? 'Recuperar' : 'Archivar'}
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

export function RestoreVersionButton({
  id,
  version,
  expectedVersion,
}: {
  id: string;
  version: number;
  expectedVersion: number;
}) {
  const a = useApiAction();
  return (
    <span className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={a.pending}
        aria-label={`Restaurar la versión ${version}`}
        onClick={() => {
          if (
            confirm(
              `¿Volver al contenido de la versión ${version}? Se guarda como una versión nueva.`,
            )
          )
            void a.run(`/plan-templates/${id}/restore`, 'POST', { version, expectedVersion });
        }}
      >
        Restaurar
      </Button>
      <FormError error={a.error} />
    </span>
  );
}

/** Name, description and library filters of an own template. */
export function TemplateDetailsForm({
  t,
  profiles,
}: {
  t: {
    id: string;
    version: number;
    name: string;
    description: string | null;
    profileSlug: string | null;
    levelN: number | null;
    population: string[];
    kind: string;
  };
  profiles: ProfileOption[];
}) {
  const a = useApiAction();
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? '');
  const [profile, setProfile] = useState(t.profileSlug ?? '');
  const [level, setLevel] = useState(t.levelN ? String(t.levelN) : '');
  const [kind, setKind] = useState(t.kind);
  const [population, setPopulation] = useState<string[]>(t.population);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(`/plan-templates/${t.id}`, 'PATCH', {
          expectedVersion: t.version,
          name,
          description,
          profileSlug: profile || null,
          levelN: level ? Number(level) : null,
          kind,
          population,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="td-name" error={a.fieldError('name')}>
          <Input id="td-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Tipo" htmlFor="td-kind">
          <Select
            id="td-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={Object.entries(KIND_LABELS).map(([value, l]) => ({ value, label: l }))}
          />
        </Field>
        <Field label="Perfil" htmlFor="td-profile">
          <Select
            id="td-profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="Cualquiera"
            options={profiles.map((p) => ({ value: p.slug, label: p.name }))}
          />
        </Field>
        <Field label="Nivel" htmlFor="td-level">
          <Select
            id="td-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="Cualquiera"
            options={LEVELS}
          />
        </Field>
      </div>
      <Field label="Descripción" htmlFor="td-description">
        <Textarea
          id="td-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Población</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(POPULATION_LABELS).map(([value, l]) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={population.includes(value)}
                onChange={() =>
                  setPopulation((p) =>
                    p.includes(value) ? p.filter((x) => x !== value) : [...p, value],
                  )
                }
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError error={a.error} />
      {a.done ? (
        <p role="status" className="text-sm text-ok">
          Guardado.
        </p>
      ) : null}
      <Button size="sm" disabled={a.pending} className="self-start">
        Guardar datos
      </Button>
    </form>
  );
}
