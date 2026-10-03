'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AvailabilityEditor } from '@/components/clients/availability-editor';
import {
  BasicsFields,
  basicsPayload,
  emptyBasics,
  type BasicsDraft,
} from '@/components/clients/basics-fields';
import { EquipmentPicker } from '@/components/clients/equipment-picker';
import { GoalsEditor } from '@/components/clients/goals-editor';
import {
  emptyProfile,
  ProfileFields,
  profilePayload,
  type ProfileDraft,
} from '@/components/clients/profile-fields';
import {
  toGoalPayload,
  toSlotPayload,
  type Catalog,
  type EquipmentDraft,
  type GoalDraft,
  type SlotDraft,
} from '@/components/clients/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

const STEPS = ['Datos', 'Entrenamiento', 'Objetivos', 'Revisión'] as const;

export function NewClientWizard({
  catalog,
  trainers,
  defaultTrainerId,
}: {
  catalog: Catalog;
  trainers: { id: string; firstName: string; lastName: string }[];
  defaultTrainerId: string | null;
}) {
  const router = useRouter();
  const { run, pending, error, fieldError } = useApiAction();
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState<BasicsDraft>(emptyBasics);
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([]);
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [trainerId, setTrainerId] = useState(defaultTrainerId ?? '');

  const canNext = step !== 0 || (basics.firstName.trim() && basics.lastName.trim());

  async function submit() {
    const r = await run<{ id: string }>(
      '/clients',
      'POST',
      {
        basics: basicsPayload(basics),
        profile: profilePayload(profile),
        goals: toGoalPayload(goals),
        availability: toSlotPayload(slots),
        equipment,
        ...(trainerId ? { trainerId } : {}),
      },
      { refresh: false },
    );
    if (r) router.push(`/app/clients/${r.id}?tab=salud&nuevo=1`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full border px-3 py-1 ${i === step ? 'border-accent text-accent' : 'border-border text-muted'}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Card>
        {step === 0 ? (
          <BasicsFields value={basics} onChange={setBasics} errors={fieldError} />
        ) : null}
        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <ProfileFields value={profile} onChange={setProfile} errors={fieldError} />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Días disponibles</h3>
              <AvailabilityEditor value={slots} onChange={setSlots} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Material disponible</h3>
              <EquipmentPicker catalog={catalog} value={equipment} onChange={setEquipment} />
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Un objetivo principal y, si procede, objetivos secundarios con su prioridad relativa.
            </p>
            <GoalsEditor catalog={catalog} value={goals} onChange={setGoals} />
          </div>
        ) : null}
        {step === 3 ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <strong>
                {basics.firstName} {basics.lastName}
              </strong>{' '}
              ·{' '}
              {goals.find((g) => g.isPrimary)
                ? catalog.goals.find((x) => x.id === goals.find((g) => g.isPrimary)!.goalId)?.name
                : 'sin objetivo principal'}
            </p>
            <p>
              {slots.length} día(s) disponibles · {equipment.length} elemento(s) de material
            </p>
            {trainers.length > 0 ? (
              <Field label="Entrenador/a responsable" htmlFor="trainerId">
                <Select
                  id="trainerId"
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  placeholder="Selecciona"
                  options={trainers.map((t) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName}`,
                  }))}
                />
              </Field>
            ) : null}
            <p className="text-muted">
              Tras crear el cliente se abrirá la pestaña de salud para registrar el consentimiento y
              el cribado previo.
            </p>
          </div>
        ) : null}
      </Card>
      <FormError error={error} />
      <div className="flex justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? 'Creando…' : 'Crear cliente'}
          </Button>
        )}
      </div>
    </div>
  );
}
