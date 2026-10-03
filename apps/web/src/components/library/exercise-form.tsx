'use client';

import type { ExerciseDetail, LibraryTaxonomies } from '@tp/application';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { label, LABELS } from '@/lib/labels';

type Role = 'primary' | 'secondary' | 'stabilizer';
type Kind = 'cue' | 'common_error' | 'precaution' | 'setup' | 'execution';

export interface ExerciseDraft {
  name: string;
  altNames: string;
  movementPatternId: string;
  bodyRegion: string;
  laterality: string;
  planes: string[];
  contractionEmphasis: string[];
  intendedVelocity: string;
  level: string;
  spaceRequired: string;
  technicalComplexity: string;
  axialLoad: string;
  impactLevel: string;
  clientDescription: string;
  trainerDescription: string;
  prescriptionProfileId: string;
  supportsVbt: boolean;
  contactsPerRep: string;
  categoryIds: string[];
  muscles: { muscleId: string; role: Role }[];
  equipment: { equipmentId: string; optional: boolean }[];
  instructions: { kind: Kind; text: string; audience: 'client' | 'trainer' | 'both' }[];
}

export const emptyExercise: ExerciseDraft = {
  name: '',
  altNames: '',
  movementPatternId: '',
  bodyRegion: '',
  laterality: '',
  planes: [],
  contractionEmphasis: [],
  intendedVelocity: '',
  level: '',
  spaceRequired: '',
  technicalComplexity: '',
  axialLoad: '',
  impactLevel: '',
  clientDescription: '',
  trainerDescription: '',
  prescriptionProfileId: '',
  supportsVbt: false,
  contactsPerRep: '',
  categoryIds: [],
  muscles: [],
  equipment: [],
  instructions: [],
};

export function draftFrom(e: ExerciseDetail): ExerciseDraft {
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    name: e.name,
    altNames: e.altNames.join(', '),
    movementPatternId: s(e.movementPatternId),
    bodyRegion: s(e.bodyRegion),
    laterality: s(e.laterality),
    planes: e.planes,
    contractionEmphasis: e.contractionEmphasis,
    intendedVelocity: s(e.intendedVelocity),
    level: s(e.level),
    spaceRequired: s(e.spaceRequired),
    technicalComplexity: s(e.technicalComplexity),
    axialLoad: s(e.axialLoad),
    impactLevel: s(e.impactLevel),
    clientDescription: s(e.clientDescription),
    trainerDescription: s(e.trainerDescription),
    prescriptionProfileId: s(e.prescriptionProfileId),
    supportsVbt: e.supportsVbt,
    contactsPerRep: s(e.contactsPerRep),
    categoryIds: e.categories.map((c) => c.id),
    muscles: e.muscles.map((m) => ({ muscleId: m.muscleId, role: m.role })),
    equipment: e.equipment.map((q) => ({ equipmentId: q.equipmentId, optional: q.optional })),
    instructions: e.instructions.map((i) => ({
      kind: i.kind,
      text: i.text,
      audience: i.audience as 'client' | 'trainer' | 'both',
    })),
  };
}

const orNull = (v: string) => (v === '' ? null : v);
const numOrNull = (v: string) => (v === '' ? null : Number(v));
export function payloadFrom(d: ExerciseDraft) {
  return {
    name: d.name,
    altNames: d.altNames
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    movementPatternId: orNull(d.movementPatternId),
    bodyRegion: orNull(d.bodyRegion),
    laterality: orNull(d.laterality),
    planes: d.planes,
    contractionEmphasis: d.contractionEmphasis,
    intendedVelocity: orNull(d.intendedVelocity),
    level: orNull(d.level),
    spaceRequired: orNull(d.spaceRequired),
    technicalComplexity: numOrNull(d.technicalComplexity),
    axialLoad: orNull(d.axialLoad),
    impactLevel: orNull(d.impactLevel),
    clientDescription: d.clientDescription,
    trainerDescription: d.trainerDescription,
    prescriptionProfileId: orNull(d.prescriptionProfileId),
    supportsVbt: d.supportsVbt,
    contactsPerRep: numOrNull(d.contactsPerRep),
    categoryIds: d.categoryIds,
    muscles: d.muscles,
    equipment: d.equipment,
    instructions: d.instructions.filter((i) => i.text.trim()),
  };
}

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));

function Checks({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={() =>
                onChange(
                  value.includes(o.value)
                    ? value.filter((x) => x !== o.value)
                    : [...value, o.value],
                )
              }
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExerciseForm({
  tax,
  initial,
  readOnly = false,
  submitLabel,
  onSubmit,
}: {
  tax: LibraryTaxonomies;
  initial: ExerciseDraft;
  readOnly?: boolean;
  submitLabel: string;
  onSubmit: (
    payload: ReturnType<typeof payloadFrom>,
    run: ReturnType<typeof useApiAction>['run'],
  ) => Promise<void>;
}) {
  const action = useApiAction();
  const [d, setD] = useState<ExerciseDraft>(initial);
  const set = <K extends keyof ExerciseDraft>(k: K, v: ExerciseDraft[K]) => setD({ ...d, [k]: v });
  const err = action.fieldError;
  const [muscleToAdd, setMuscleToAdd] = useState('');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(payloadFrom(d), action.run);
      }}
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Card title="Identificación">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" htmlFor="ex-name" error={err('name')}>
              <Input
                id="ex-name"
                required
                value={d.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field
              label="Nombres alternativos"
              htmlFor="ex-alt"
              hint="Separados por comas; también se usan en la búsqueda."
            >
              <Input
                id="ex-alt"
                value={d.altNames}
                onChange={(e) => set('altNames', e.target.value)}
              />
            </Field>
            <Field
              label="Patrón de movimiento"
              htmlFor="ex-pattern"
              error={err('movementPatternId')}
            >
              <Select
                id="ex-pattern"
                placeholder="—"
                value={d.movementPatternId}
                onChange={(e) => set('movementPatternId', e.target.value)}
                options={tax.patterns.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field
              label="Perfil de prescripción"
              htmlFor="ex-profile"
              hint="Qué variables se muestran al programarlo."
            >
              <Select
                id="ex-profile"
                placeholder="—"
                value={d.prescriptionProfileId}
                onChange={(e) => set('prescriptionProfileId', e.target.value)}
                options={tax.profiles.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Checks
              legend="Categorías"
              options={tax.categories.map((c) => ({ value: c.id, label: c.name }))}
              value={d.categoryIds}
              onChange={(v) => set('categoryIds', v)}
            />
          </div>
        </Card>

        <Card title="Características">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Nivel" htmlFor="ex-level">
              <Select
                id="ex-level"
                placeholder="—"
                value={d.level}
                onChange={(e) => set('level', e.target.value)}
                options={opts(LABELS.level)}
              />
            </Field>
            <Field label="Región" htmlFor="ex-region">
              <Select
                id="ex-region"
                placeholder="—"
                value={d.bodyRegion}
                onChange={(e) => set('bodyRegion', e.target.value)}
                options={opts(LABELS.region)}
              />
            </Field>
            <Field label="Lateralidad" htmlFor="ex-lat">
              <Select
                id="ex-lat"
                placeholder="—"
                value={d.laterality}
                onChange={(e) => set('laterality', e.target.value)}
                options={opts(LABELS.laterality)}
              />
            </Field>
            <Field
              label="Complejidad técnica (1–5)"
              htmlFor="ex-cx"
              error={err('technicalComplexity')}
            >
              <Input
                id="ex-cx"
                type="number"
                min={1}
                max={5}
                value={d.technicalComplexity}
                onChange={(e) => set('technicalComplexity', e.target.value)}
              />
            </Field>
            <Field label="Carga axial" htmlFor="ex-axial">
              <Select
                id="ex-axial"
                placeholder="—"
                value={d.axialLoad}
                onChange={(e) => set('axialLoad', e.target.value)}
                options={opts(LABELS.loadLevel)}
              />
            </Field>
            <Field label="Impacto" htmlFor="ex-impact">
              <Select
                id="ex-impact"
                placeholder="—"
                value={d.impactLevel}
                onChange={(e) => set('impactLevel', e.target.value)}
                options={opts(LABELS.loadLevel)}
              />
            </Field>
            <Field label="Espacio" htmlFor="ex-space">
              <Select
                id="ex-space"
                placeholder="—"
                value={d.spaceRequired}
                onChange={(e) => set('spaceRequired', e.target.value)}
                options={opts(LABELS.space)}
              />
            </Field>
            <Field label="Velocidad prevista" htmlFor="ex-vel">
              <Select
                id="ex-vel"
                placeholder="—"
                value={d.intendedVelocity}
                onChange={(e) => set('intendedVelocity', e.target.value)}
                options={opts(LABELS.velocity)}
              />
            </Field>
            <Field label="Contactos por repetición" htmlFor="ex-contacts" hint="Solo pliometría.">
              <Input
                id="ex-contacts"
                type="number"
                min={0}
                max={10}
                value={d.contactsPerRep}
                onChange={(e) => set('contactsPerRep', e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                checked={d.supportsVbt}
                onChange={(e) => set('supportsVbt', e.target.checked)}
              />
              Admite VBT (trayectoria medible y con sentido medir velocidad)
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Checks
              legend="Planos"
              options={opts(LABELS.plane)}
              value={d.planes}
              onChange={(v) => set('planes', v)}
            />
            <Checks
              legend="Énfasis de contracción"
              options={opts(LABELS.contraction)}
              value={d.contractionEmphasis}
              onChange={(v) => set('contractionEmphasis', v)}
            />
          </div>
        </Card>

        <Card title="Músculos">
          <ul className="flex flex-col gap-1">
            {d.muscles.map((m, i) => (
              <li key={m.muscleId} className="flex items-center gap-2 text-sm">
                <span className="w-56">{tax.muscles.find((x) => x.id === m.muscleId)?.name}</span>
                <Select
                  aria-label="Rol"
                  className="h-8 w-40"
                  value={m.role}
                  onChange={(e) =>
                    set(
                      'muscles',
                      d.muscles.map((x, j) =>
                        j === i ? { ...x, role: e.target.value as Role } : x,
                      ),
                    )
                  }
                  options={opts(LABELS.muscleRole)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Quitar músculo"
                  onClick={() =>
                    set(
                      'muscles',
                      d.muscles.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Select
              aria-label="Añadir músculo"
              placeholder="Añadir músculo…"
              className="h-9 max-w-xs"
              value={muscleToAdd}
              onChange={(e) => setMuscleToAdd(e.target.value)}
              options={tax.muscles
                .filter((m) => !d.muscles.some((x) => x.muscleId === m.id))
                .map((m) => ({ value: m.id, label: `${m.name} (${label('region', m.region)})` }))}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!muscleToAdd}
              onClick={() => {
                set('muscles', [
                  ...d.muscles,
                  {
                    muscleId: muscleToAdd,
                    role: d.muscles.some((x) => x.role === 'primary') ? 'secondary' : 'primary',
                  },
                ]);
                setMuscleToAdd('');
              }}
            >
              Añadir
            </Button>
          </div>
        </Card>

        <Card title="Material">
          <div className="grid gap-x-4 gap-y-1 md:grid-cols-3">
            {tax.equipment.map((q) => {
              const sel = d.equipment.find((x) => x.equipmentId === q.id);
              return (
                <div key={q.id} className="flex items-center gap-2 text-sm">
                  <input
                    id={`eq-${q.id}`}
                    type="checkbox"
                    checked={!!sel}
                    onChange={() =>
                      set(
                        'equipment',
                        sel
                          ? d.equipment.filter((x) => x.equipmentId !== q.id)
                          : [...d.equipment, { equipmentId: q.id, optional: false }],
                      )
                    }
                  />
                  <label htmlFor={`eq-${q.id}`} className="flex-1">
                    {q.name}
                  </label>
                  {sel ? (
                    <label className="flex items-center gap-1 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={sel.optional}
                        onChange={() =>
                          set(
                            'equipment',
                            d.equipment.map((x) =>
                              x.equipmentId === q.id ? { ...x, optional: !x.optional } : x,
                            ),
                          )
                        }
                      />
                      opcional
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Explicación e instrucciones">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Para el cliente (breve)"
              htmlFor="ex-cdesc"
              hint="Lenguaje sencillo; lo verá en el móvil."
            >
              <Textarea
                id="ex-cdesc"
                value={d.clientDescription}
                onChange={(e) => set('clientDescription', e.target.value)}
              />
            </Field>
            <Field label="Para el entrenador" htmlFor="ex-tdesc">
              <Textarea
                id="ex-tdesc"
                rows={4}
                value={d.trainerDescription}
                onChange={(e) => set('trainerDescription', e.target.value)}
              />
            </Field>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {d.instructions.map((ins, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Tipo"
                  className="h-9 w-44"
                  value={ins.kind}
                  onChange={(e) =>
                    set(
                      'instructions',
                      d.instructions.map((x, j) =>
                        j === i ? { ...x, kind: e.target.value as Kind } : x,
                      ),
                    )
                  }
                  options={opts(LABELS.instructionKind)}
                />
                <Input
                  aria-label="Texto"
                  className="min-w-60 flex-1"
                  value={ins.text}
                  onChange={(e) =>
                    set(
                      'instructions',
                      d.instructions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                    )
                  }
                />
                <Select
                  aria-label="Visible para"
                  className="h-9 w-36"
                  value={ins.audience}
                  onChange={(e) =>
                    set(
                      'instructions',
                      d.instructions.map((x, j) =>
                        j === i
                          ? { ...x, audience: e.target.value as 'client' | 'trainer' | 'both' }
                          : x,
                      ),
                    )
                  }
                  options={[
                    { value: 'both', label: 'Ambos' },
                    { value: 'client', label: 'Cliente' },
                    { value: 'trainer', label: 'Entrenador' },
                  ]}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Quitar instrucción"
                  onClick={() =>
                    set(
                      'instructions',
                      d.instructions.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() =>
              set('instructions', [...d.instructions, { kind: 'cue', text: '', audience: 'both' }])
            }
          >
            Añadir instrucción
          </Button>
        </Card>
      </fieldset>
      <FormError error={action.error} />
      {!readOnly ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={action.pending || d.name.trim().length < 2}>
            {action.pending ? 'Guardando…' : submitLabel}
          </Button>
          {action.done ? (
            <span role="status" className="text-sm text-ok">
              Guardado
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
