'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { LABELS } from '@/lib/labels';

export interface ProfileDraft {
  experienceLevel: string;
  yearsTraining: string;
  sessionsPerWeek: string;
  sessionDurationMin: string;
  location: string;
  notes: string;
}
export const emptyProfile: ProfileDraft = {
  experienceLevel: 'none',
  yearsTraining: '',
  sessionsPerWeek: '',
  sessionDurationMin: '',
  location: '',
  notes: '',
};
const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, label]) => ({ value, label }));

export function ProfileFields({
  value,
  onChange,
  errors,
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  errors: (k: string) => string[] | undefined;
}) {
  const set = (k: keyof ProfileDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });
  const err = (k: string) => errors(`profile.${k}`) ?? errors(k);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Experiencia" htmlFor="experienceLevel">
        <Select
          id="experienceLevel"
          value={value.experienceLevel}
          onChange={set('experienceLevel')}
          options={opts(LABELS.experience)}
        />
      </Field>
      <Field label="Años entrenando" htmlFor="yearsTraining" error={err('yearsTraining')}>
        <Input
          id="yearsTraining"
          type="number"
          min={0}
          step={0.5}
          value={value.yearsTraining}
          onChange={set('yearsTraining')}
        />
      </Field>
      <Field label="Lugar habitual" htmlFor="location">
        <Select
          id="location"
          placeholder="—"
          value={value.location}
          onChange={set('location')}
          options={opts(LABELS.location)}
        />
      </Field>
      <Field label="Sesiones por semana" htmlFor="sessionsPerWeek" error={err('sessionsPerWeek')}>
        <Input
          id="sessionsPerWeek"
          type="number"
          min={1}
          max={14}
          value={value.sessionsPerWeek}
          onChange={set('sessionsPerWeek')}
        />
      </Field>
      <Field
        label="Duración por sesión (min)"
        htmlFor="sessionDurationMin"
        error={err('sessionDurationMin')}
      >
        <Input
          id="sessionDurationMin"
          type="number"
          min={10}
          max={300}
          value={value.sessionDurationMin}
          onChange={set('sessionDurationMin')}
        />
      </Field>
      <div className="md:col-span-3">
        <Field label="Notas de entrenamiento" htmlFor="notes">
          <Textarea id="notes" value={value.notes} onChange={set('notes')} />
        </Field>
      </div>
    </div>
  );
}

const num = (v: string) => (v === '' ? null : Number(v));
export const profilePayload = (p: ProfileDraft) => ({
  experienceLevel: p.experienceLevel,
  yearsTraining: num(p.yearsTraining),
  sessionsPerWeek: num(p.sessionsPerWeek),
  sessionDurationMin: num(p.sessionDurationMin),
  location: p.location || null,
  notes: p.notes,
});
