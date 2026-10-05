'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { LABELS } from '@/lib/labels';

export interface BasicsDraft {
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  email: string;
  phone: string;
  modality: string;
  status: string;
  preferences: string;
}

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, label]) => ({ value, label }));

export function BasicsFields({
  value,
  onChange,
  errors,
}: {
  value: BasicsDraft;
  onChange: (v: BasicsDraft) => void;
  errors: (k: string) => string[] | undefined;
}) {
  const set = (k: keyof BasicsDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label="Nombre"
        htmlFor="firstName"
        error={errors('basics.firstName') ?? errors('firstName')}
      >
        <Input id="firstName" required value={value.firstName} onChange={set('firstName')} />
      </Field>
      <Field
        label="Apellidos"
        htmlFor="lastName"
        error={errors('basics.lastName') ?? errors('lastName')}
      >
        <Input id="lastName" required value={value.lastName} onChange={set('lastName')} />
      </Field>
      <Field
        label="Fecha de nacimiento"
        htmlFor="birthDate"
        error={errors('basics.birthDate') ?? errors('birthDate')}
      >
        <Input id="birthDate" type="date" value={value.birthDate} onChange={set('birthDate')} />
      </Field>
      <Field
        label="Sexo"
        htmlFor="sex"
        hint="Solo se usa para elegir valores de referencia aplicables."
      >
        <Select id="sex" value={value.sex} onChange={set('sex')} options={opts(LABELS.sex)} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors('basics.email') ?? errors('email')}>
        <Input id="email" type="email" value={value.email} onChange={set('email')} />
      </Field>
      <Field label="Teléfono" htmlFor="phone" error={errors('basics.phone') ?? errors('phone')}>
        <Input id="phone" type="tel" value={value.phone} onChange={set('phone')} />
      </Field>
      <Field label="Modalidad" htmlFor="modality">
        <Select
          id="modality"
          value={value.modality}
          onChange={set('modality')}
          options={opts(LABELS.modality)}
        />
      </Field>
      <Field label="Estado" htmlFor="status">
        <Select
          id="status"
          value={value.status}
          onChange={set('status')}
          options={opts(LABELS.status).filter((o) => o.value !== 'archived')}
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Preferencias" htmlFor="preferences">
          <Textarea id="preferences" value={value.preferences} onChange={set('preferences')} />
        </Field>
      </div>
    </div>
  );
}

export const basicsPayload = (b: BasicsDraft) => ({
  firstName: b.firstName,
  lastName: b.lastName,
  birthDate: b.birthDate || null,
  sex: b.sex,
  email: b.email,
  phone: b.phone,
  modality: b.modality,
  status: b.status,
  preferences: b.preferences,
});
