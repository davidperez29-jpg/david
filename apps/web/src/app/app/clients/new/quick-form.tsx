'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgrammingProfileOption } from '@tp/application';
import { LEVEL_NAMES, suggestLevel, type ProgrammingLevel } from '@tp/domain';
import { EquipmentChips } from '@/components/clients/equipment-chips';
import type { Catalog } from '@/components/clients/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { LABELS } from '@/lib/labels';

type Experience = 'none' | 'beginner' | 'intermediate' | 'advanced';

const FAMILY: Record<string, string> = {
  rendimiento: 'Rendimiento',
  fuerza_hipertrofia: 'Fuerza e hipertrofia',
  salud: 'Salud y función',
  poblacion_especifica: 'Poblaciones específicas',
  readaptacion: 'Readaptación',
  personalizado: 'Personalizado',
};

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, label]) => ({ value, label }));

/** Equipment availability follows where the client usually trains. */
const equipmentLocation = (place: string): 'home' | 'gym' | 'both' =>
  place === 'home' ? 'home' : place === 'mixed' ? 'both' : 'gym';

function ageFrom(birthDate: string): number | null {
  const b = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * New client in one form (docs/UX_FLOW.md §4). Only name, surname and main profile are required;
 * the level is suggested from the experience and the goal from the profile, both editable. Health
 * data are not asked here: they go to Ficha → Salud, after the consent.
 */
export function QuickClientForm({
  catalog,
  profiles,
  trainers,
  defaultTrainerId,
}: {
  catalog: Catalog;
  profiles: ProgrammingProfileOption[];
  trainers: { id: string; firstName: string; lastName: string }[];
  defaultTrainerId: string | null;
}) {
  const router = useRouter();
  const { run, pending, error, fieldError } = useApiAction();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('undisclosed');
  const [email, setEmail] = useState('');
  const [profileId, setProfileId] = useState('');
  const [experience, setExperience] = useState<Experience>('none');
  const [level, setLevel] = useState<ProgrammingLevel>(1);
  const [levelTouched, setLevelTouched] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [goalTouched, setGoalTouched] = useState(false);
  const [sportId, setSportId] = useState('');
  const [days, setDays] = useState('');
  const [place, setPlace] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [trainerId, setTrainerId] = useState(defaultTrainerId ?? '');
  const [invited, setInvited] = useState<{ id: string; link: string | null } | null>(null);

  const profile = profiles.find((p) => p.id === profileId) ?? null;
  const age = birthDate ? ageFrom(birthDate) : null;
  const families = [...new Set(profiles.map((p) => p.family))];
  const err = (k: string) => fieldError(`basics.${k}`) ?? fieldError(`profile.${k}`);
  const canSave = firstName.trim() !== '' && lastName.trim() !== '' && profileId !== '';

  function chooseProfile(id: string) {
    setProfileId(id);
    const p = profiles.find((x) => x.id === id);
    if (!goalTouched) {
      const g = catalog.goals.find((x) => x.slug === p?.defaultGoalSlug);
      setGoalId(g?.id ?? '');
    }
  }

  function chooseExperience(e: Experience) {
    setExperience(e);
    if (!levelTouched) setLevel(suggestLevel(e));
  }

  async function save(invite: boolean) {
    const r = await run<{ id: string }>(
      '/clients',
      'POST',
      {
        basics: {
          firstName,
          lastName,
          birthDate: birthDate || null,
          sex,
          email,
          programmingProfileId: profileId,
          programmingLevel: level,
          sportId: sportId || null,
        },
        profile: {
          experienceLevel: experience,
          sessionsPerWeek: days ? Number(days) : null,
          location: place || null,
          notes,
        },
        ...(goalId ? { goals: [{ goalId, isPrimary: true, priorityWeight: 1 }] } : {}),
        equipment: equipmentIds.map((equipmentId) => ({
          equipmentId,
          location: equipmentLocation(place),
        })),
        ...(trainerId ? { trainerId } : {}),
      },
      { refresh: false },
    );
    if (!r) return;
    if (!invite) {
      router.push(`/app/clients/${r.id}?tab=ficha&nuevo=1#salud`);
      return;
    }
    const inv = await run<{ link: string }>(
      '/invitations',
      'POST',
      { role: 'CLIENT', email, clientId: r.id },
      { refresh: false },
    );
    setInvited({ id: r.id, link: inv?.link ?? null });
  }

  if (invited)
    return (
      <Card>
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-medium">
            {firstName} {lastName} ya está dado de alta.
          </p>
          {invited.link ? (
            <p>
              Invitación creada para {email} (válida 7 días). Mientras no haya proveedor de email
              configurado, comparte este enlace por un canal seguro:
              <code className="mt-1 block break-all rounded bg-surface p-2 text-xs">
                {invited.link}
              </code>
            </p>
          ) : (
            <>
              <FormError error={error} />
              <p className="text-muted">
                La invitación no se pudo crear. Puedes enviarla desde la ficha del cliente.
              </p>
            </>
          )}
          <Link
            href={`/app/clients/${invited.id}?tab=ficha&nuevo=1#salud`}
            className="inline-flex h-10 w-fit items-center rounded-md bg-accent px-4 font-medium text-accent-contrast"
          >
            Ir al cliente
          </Link>
        </div>
      </Card>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !pending) void save(false);
      }}
    >
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre *" htmlFor="firstName" error={err('firstName')}>
            <Input
              id="firstName"
              required
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Apellidos *" htmlFor="lastName" error={err('lastName')}>
            <Input
              id="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
          <Field
            label="Fecha de nacimiento"
            htmlFor="birthDate"
            error={err('birthDate')}
            hint={age != null ? `${age} años` : 'La edad se calcula sola y se mantiene al día.'}
          >
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          <Field
            label="Sexo"
            htmlFor="sex"
            hint="Solo se usa para elegir valores de referencia aplicables."
          >
            <Select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              options={opts(LABELS.sex)}
            />
          </Field>

          <Field
            label="Perfil principal *"
            htmlFor="programmingProfileId"
            error={fieldError('basics.programmingProfileId')}
            hint={profile?.description ?? 'Define cómo se programa: plantillas, tests y radar.'}
          >
            <select
              id="programmingProfileId"
              required
              value={profileId}
              onChange={(e) => chooseProfile(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            >
              <option value="">Elige un perfil…</option>
              {families.map((f) => (
                <optgroup key={f} label={FAMILY[f] ?? f}>
                  {profiles
                    .filter((p) => p.family === f)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field
            label="Nivel"
            htmlFor="programmingLevel"
            hint={
              profile?.levels[String(level)]?.summary ??
              (levelTouched ? undefined : 'Sugerido por la experiencia; puedes cambiarlo.')
            }
          >
            <select
              id="programmingLevel"
              value={level}
              onChange={(e) => {
                setLevel(Number(e.target.value) as ProgrammingLevel);
                setLevelTouched(true);
              }}
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            >
              {([1, 2, 3] as const).map((n) => (
                <option key={n} value={n}>
                  {n} · {LEVEL_NAMES[n]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Experiencia" htmlFor="experienceLevel">
            <Select
              id="experienceLevel"
              value={experience}
              onChange={(e) => chooseExperience(e.target.value as Experience)}
              options={opts(LABELS.experience)}
            />
          </Field>
          <Field
            label="Objetivo"
            htmlFor="goalId"
            hint="Propuesto por el perfil; puedes cambiarlo."
          >
            <Select
              id="goalId"
              placeholder="Sin objetivo por ahora"
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
                setGoalTouched(true);
              }}
              options={catalog.goals.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Field>
          <Field label="Deporte" htmlFor="sportId">
            <Select
              id="sportId"
              placeholder="Ninguno"
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              options={catalog.sports.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
          <Field label="Días por semana" htmlFor="sessionsPerWeek" error={err('sessionsPerWeek')}>
            <Input
              id="sessionsPerWeek"
              type="number"
              inputMode="numeric"
              min={1}
              max={7}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>

          <Field label="Dónde entrena" htmlFor="location">
            <Select
              id="location"
              placeholder="—"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              options={opts(LABELS.location)}
            />
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            error={err('email')}
            hint="Para invitarle a la app (opcional)."
          >
            <Input
              id="email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div
            className="flex flex-col gap-1 md:col-span-2"
            role="group"
            aria-labelledby="equipment-label"
          >
            <span className="text-sm font-medium" id="equipment-label">
              Material disponible
            </span>
            <EquipmentChips catalog={catalog} value={equipmentIds} onChange={setEquipmentIds} />
          </div>

          <div className="md:col-span-2">
            <Field
              label="Observaciones"
              htmlFor="notes"
              hint="Preferencias, horarios, contexto… Los datos de salud van en Ficha → Salud, con su consentimiento."
            >
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

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
        </div>
      </Card>
      <FormError error={error} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canSave ? (
          <span className="mr-auto text-sm text-muted">
            Obligatorio: nombre, apellidos y perfil principal.
          </span>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={!canSave || !email || pending}
          onClick={() => void save(true)}
        >
          Guardar e invitar a la app
        </Button>
        <Button type="submit" disabled={!canSave || pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
