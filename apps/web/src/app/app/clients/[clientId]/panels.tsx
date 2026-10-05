'use client';

import type { ClientDetail, ProgrammingProfileOption } from '@tp/application';
import { LEVEL_DIMENSIONS, LEVEL_NAMES, type ProgrammingLevel } from '@tp/domain';
import { useState } from 'react';
import { AvailabilityEditor } from '@/components/clients/availability-editor';
import { BasicsFields, basicsPayload, type BasicsDraft } from '@/components/clients/basics-fields';
import { EquipmentPicker } from '@/components/clients/equipment-picker';
import { GoalsEditor } from '@/components/clients/goals-editor';
import {
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
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { formatDate, label, LABELS } from '@/lib/labels';
import { ExercisePicker } from '@/components/library/exercise-picker';

const Saved = ({ show }: { show: boolean }) =>
  show ? (
    <span role="status" className="text-sm text-ok">
      Guardado
    </span>
  ) : null;
const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));

export function BasicsPanel({ client }: { client: ClientDetail }) {
  const { run, pending, error, done, fieldError } = useApiAction();
  const [draft, setDraft] = useState<BasicsDraft>({
    firstName: client.firstName,
    lastName: client.lastName,
    birthDate: client.birthDate ?? '',
    sex: client.sex,
    email: client.email ?? '',
    phone: client.phone ?? '',
    modality: client.modality,
    status: client.status === 'archived' ? 'active' : client.status,
    preferences: client.preferences ?? '',
  });
  const archived = client.status === 'archived';
  return (
    <Card title="Datos personales" actions={<Saved show={done} />}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const payload: Record<string, unknown> = {
            ...basicsPayload(draft),
            expectedVersion: client.version,
          };
          if (archived) delete payload.status;
          await run(`/clients/${client.id}`, 'PATCH', payload);
        }}
      >
        <BasicsFields value={draft} onChange={setDraft} errors={fieldError} />
        <FormError error={error} />
        <div>
          <Button type="submit" disabled={pending}>
            Guardar datos
          </Button>
        </div>
      </form>
    </Card>
  );
}

const FAMILY: Record<string, string> = {
  rendimiento: 'Rendimiento',
  fuerza_hipertrofia: 'Fuerza e hipertrofia',
  salud: 'Salud y función',
  poblacion_especifica: 'Poblaciones específicas',
  readaptacion: 'Readaptación',
  personalizado: 'Personalizado',
};

/** Main profile, level and sport (restructure §2–§4): what the programming is built from. */
export function ProgrammingPanel({
  client,
  profiles,
  catalog,
}: {
  client: ClientDetail;
  profiles: ProgrammingProfileOption[];
  catalog: Catalog;
}) {
  const { run, pending, error, done, fieldError } = useApiAction();
  const [profileId, setProfileId] = useState(client.programmingProfileId ?? '');
  const [level, setLevel] = useState<ProgrammingLevel>(
    (client.programmingLevel as ProgrammingLevel | null) ?? 1,
  );
  const [sportId, setSportId] = useState(client.sportId ?? '');
  const profile = profiles.find((p) => p.id === profileId) ?? null;
  const families = [...new Set(profiles.map((p) => p.family))];
  return (
    <Card title="Perfil y nivel" actions={<Saved show={done} />}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(`/clients/${client.id}`, 'PATCH', {
            programmingProfileId: profileId || null,
            programmingLevel: profileId ? level : null,
            sportId: sportId || null,
            expectedVersion: client.version,
          });
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Perfil principal"
            htmlFor="programmingProfileId"
            error={fieldError('programmingProfileId')}
            hint={profile?.description ?? undefined}
          >
            <select
              id="programmingProfileId"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            >
              <option value="">Sin perfil</option>
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
            hint={profile?.levels[String(level)]?.summary}
          >
            <select
              id="programmingLevel"
              value={level}
              disabled={!profileId}
              onChange={(e) => setLevel(Number(e.target.value) as ProgrammingLevel)}
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm disabled:opacity-50"
            >
              {([1, 2, 3] as const).map((n) => (
                <option key={n} value={n}>
                  {n} · {LEVEL_NAMES[n]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deporte" htmlFor="sportId" error={fieldError('sportId')}>
            <Select
              id="sportId"
              placeholder="Ninguno"
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              options={catalog.sports.map((x) => ({ value: x.id, label: x.name }))}
            />
          </Field>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">¿Qué cambia con el nivel?</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-2">Dimensión</th>
                  {([1, 2, 3] as const).map((n) => (
                    <th key={n} className={`pr-2 ${n === level ? 'text-text' : ''}`}>
                      {n} · {LEVEL_NAMES[n]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {LEVEL_DIMENSIONS.map((d) => (
                  <tr key={d.key}>
                    <th scope="row" className="py-1 pr-2 font-medium">
                      {d.label}
                    </th>
                    {d.levels.map((t, i) => (
                      <td
                        key={i}
                        className={`pr-2 ${i + 1 === level ? 'font-medium' : 'text-muted'}`}
                      >
                        {t}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-muted">
              Descriptores prácticos para orientar la programación; el nivel lo decide el entrenador
              y la evaluación lo ajusta, no la edad ni un diagnóstico por sí solos.
            </p>
          </div>
        </details>
        <FormError error={error} />
        <div>
          <Button type="submit" disabled={pending}>
            Guardar perfil y nivel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfilePanel({ client, catalog }: { client: ClientDetail; catalog: Catalog }) {
  const profileAction = useApiAction();
  const slotsAction = useApiAction();
  const eqAction = useApiAction();
  const p = client.profile;
  const [profile, setProfile] = useState<ProfileDraft>({
    experienceLevel: p?.experienceLevel ?? 'none',
    yearsTraining: p?.yearsTraining?.toString() ?? '',
    sessionsPerWeek: p?.sessionsPerWeek?.toString() ?? '',
    sessionDurationMin: p?.sessionDurationMin?.toString() ?? '',
    location: p?.location ?? '',
    notes: p?.notes ?? '',
  });
  const [slots, setSlots] = useState<SlotDraft[]>(
    client.availability.map((a) => ({
      weekday: a.weekday,
      startTime: a.startTime ?? '',
      endTime: a.endTime ?? '',
    })),
  );
  const [equipment, setEquipment] = useState<EquipmentDraft[]>(
    client.equipment.map((e) => ({ equipmentId: e.equipmentId, location: e.location })),
  );
  return (
    <>
      <Card title="Perfil de entrenamiento" actions={<Saved show={profileAction.done} />}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await profileAction.run(
              `/clients/${client.id}/profile`,
              'PUT',
              profilePayload(profile),
            );
          }}
        >
          <ProfileFields value={profile} onChange={setProfile} errors={profileAction.fieldError} />
          <FormError error={profileAction.error} />
          <div>
            <Button type="submit" disabled={profileAction.pending}>
              Guardar perfil
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Disponibilidad" actions={<Saved show={slotsAction.done} />}>
        <AvailabilityEditor value={slots} onChange={setSlots} />
        <FormError error={slotsAction.error} />
        <Button
          className="mt-3"
          disabled={slotsAction.pending}
          onClick={() =>
            slotsAction.run(`/clients/${client.id}/availability`, 'PUT', {
              slots: toSlotPayload(slots),
            })
          }
        >
          Guardar disponibilidad
        </Button>
      </Card>
      <Card title="Material" actions={<Saved show={eqAction.done} />}>
        <EquipmentPicker catalog={catalog} value={equipment} onChange={setEquipment} />
        <FormError error={eqAction.error} />
        <Button
          className="mt-3"
          disabled={eqAction.pending}
          onClick={() =>
            eqAction.run(`/clients/${client.id}/equipment`, 'PUT', { items: equipment })
          }
        >
          Guardar material
        </Button>
      </Card>
    </>
  );
}

export function GoalsPanel({ client, catalog }: { client: ClientDetail; catalog: Catalog }) {
  const { run, pending, error, done } = useApiAction();
  const [goals, setGoals] = useState<GoalDraft[]>(
    client.goals.map((g) => ({
      goalId: g.goalId,
      isPrimary: g.isPrimary,
      priorityWeight: g.priorityWeight,
      targetDate: g.targetDate ?? '',
      sportId: g.sportId ?? '',
      competitiveLevel: g.competitiveLevel ?? '',
    })),
  );
  return (
    <Card title="Objetivos" actions={<Saved show={done} />}>
      <p className="mb-3 text-sm text-muted">
        Al guardar, los objetivos anteriores se conservan en el historial.
      </p>
      <GoalsEditor catalog={catalog} value={goals} onChange={setGoals} />
      <FormError error={error} />
      <Button
        className="mt-3"
        disabled={pending || goals.length === 0}
        onClick={() => run(`/clients/${client.id}/goals`, 'PUT', { goals: toGoalPayload(goals) })}
      >
        Guardar objetivos
      </Button>
    </Card>
  );
}

export function AccountPanel({
  clientId,
  hasAccount,
  email,
}: {
  clientId: string;
  hasAccount: boolean;
  email: string | null;
}) {
  const { run, pending, error } = useApiAction();
  const [link, setLink] = useState<string | null>(null);
  const [to, setTo] = useState(email ?? '');
  if (hasAccount)
    return (
      <Card title="Acceso del cliente">
        <p className="text-sm">El cliente tiene cuenta activa.</p>
      </Card>
    );
  return (
    <Card title="Acceso del cliente">
      <p className="mb-3 text-sm text-muted">
        Invita al cliente para que vea sus sesiones y registre su entrenamiento desde el móvil.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button
          disabled={pending || !to}
          onClick={async () => {
            const r = await run<{ link: string }>(
              '/invitations',
              'POST',
              { role: 'CLIENT', email: to, clientId },
              { refresh: false },
            );
            if (r) setLink(r.link);
          }}
        >
          Enviar invitación
        </Button>
      </div>
      <FormError error={error} />
      {link ? (
        <p className="mt-3 text-sm">
          Invitación creada (válida 7 días). Mientras no haya proveedor de email configurado,
          comparte este enlace por un canal seguro:
          <code className="mt-1 block break-all rounded bg-surface p-2 text-xs">{link}</code>
        </p>
      ) : null}
    </Card>
  );
}

export function ArchivePanel({ clientId, archived }: { clientId: string; archived: boolean }) {
  const { run, pending, error } = useApiAction();
  const [reason, setReason] = useState('');
  return (
    <Card title={archived ? 'Restaurar cliente' : 'Archivar cliente'}>
      {!archived ? (
        <Field label="Motivo (opcional)" htmlFor="archive-reason">
          <Input id="archive-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      ) : null}
      <FormError error={error} />
      <Button
        className="mt-3"
        variant={archived ? 'secondary' : 'danger'}
        disabled={pending}
        onClick={() => {
          if (archived || confirm('¿Archivar este cliente? Podrás restaurarlo después.'))
            void run(`/clients/${clientId}/archive`, 'POST', { archived: !archived, reason });
        }}
      >
        {archived ? 'Restaurar' : 'Archivar'}
      </Button>
    </Card>
  );
}

interface HealthData {
  declarations: {
    id: string;
    type: string;
    bodyRegion: string | null;
    declaredOn: string;
    declaredStatus: string;
    requiresProfessionalAssessment: boolean;
    clearedAt: Date | string | null;
    clearanceNote: string | null;
    description: string | null;
  }[];
  screenings: {
    id: string;
    questionnaire: string;
    questionnaireVersion: string | null;
    result: string;
    completedOn: string;
  }[];
}
interface ConsentData {
  status: { purpose: string; currentVersion: string; active: boolean }[];
  history: {
    id: string;
    purpose: string;
    textVersion: string;
    method: string;
    grantedAt: Date | string;
    revokedAt: Date | string | null;
  }[];
}

export function HealthPanel({
  clientId,
  data,
  consents,
}: {
  clientId: string;
  data: HealthData;
  consents: ConsentData;
}) {
  const hasConsent = consents.status.find((s) => s.purpose === 'health_data')?.active ?? false;
  const add = useApiAction();
  const scr = useApiAction();
  const clear = useApiAction();
  const [form, setForm] = useState({
    type: 'injury',
    bodyRegion: '',
    declaredOn: '',
    declaredStatus: 'unknown',
    requiresProfessionalAssessment: false,
    description: '',
  });
  const [screening, setScreening] = useState({
    questionnaire: 'PAR-Q+',
    questionnaireVersion: '',
    result: 'clear',
    completedOn: new Date().toISOString().slice(0, 10),
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Información <strong>declarada</strong> por el cliente. El sistema no diagnostica. Ante
        cualquier cuestión médica: «Requiere valoración por profesional sanitario».
      </p>
      {!hasConsent ? (
        <ConsentsPanel
          clientId={clientId}
          data={consents}
          only="health_data"
          intro="Para registrar datos de salud es obligatorio el consentimiento explícito del cliente (art. 9 RGPD)."
        />
      ) : null}
      <Card title="Cribado previo a la participación">
        {data.screenings.length ? (
          <ul className="mb-3 text-sm">
            {data.screenings.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="tabular-nums text-muted">{formatDate(s.completedOn)}</span>
                <span>
                  {s.questionnaire}
                  {s.questionnaireVersion ? ` (${s.questionnaireVersion})` : ''}
                </span>
                <Badge tone={s.result === 'refer' ? 'danger' : 'ok'}>
                  {s.result === 'refer' ? 'Derivar' : 'Sin derivación'}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted">Sin cribado registrado.</p>
        )}
        <p className="mb-2 text-xs text-muted">
          Registra el resultado de un cuestionario validado realizado fuera de la app (p. ej.
          PAR-Q+). La app no reproduce el cuestionario.
        </p>
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            aria-label="Cuestionario"
            value={screening.questionnaire}
            onChange={(e) => setScreening({ ...screening, questionnaire: e.target.value })}
          />
          <Input
            aria-label="Versión"
            placeholder="Versión"
            value={screening.questionnaireVersion}
            onChange={(e) => setScreening({ ...screening, questionnaireVersion: e.target.value })}
          />
          <Select
            aria-label="Resultado"
            value={screening.result}
            onChange={(e) => setScreening({ ...screening, result: e.target.value })}
            options={[
              { value: 'clear', label: 'Sin derivación' },
              { value: 'refer', label: 'Derivar' },
            ]}
          />
          <Input
            aria-label="Fecha"
            type="date"
            value={screening.completedOn}
            onChange={(e) => setScreening({ ...screening, completedOn: e.target.value })}
          />
          <Button
            disabled={scr.pending || !hasConsent}
            onClick={() =>
              scr.run(`/clients/${clientId}/screenings`, 'POST', {
                ...screening,
                questionnaireVersion: screening.questionnaireVersion || null,
              })
            }
          >
            Registrar
          </Button>
        </div>
        <FormError error={scr.error} />
      </Card>
      <Card title="Declaraciones">
        {data.declarations.length === 0 ? (
          <EmptyState>Sin declaraciones.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.declarations.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{label('healthType', d.type)}</strong>
                  {d.bodyRegion ? <span>· {d.bodyRegion}</span> : null}
                  <span className="text-muted">
                    · {formatDate(d.declaredOn)} · {label('declaredStatus', d.declaredStatus)}
                  </span>
                  {d.requiresProfessionalAssessment && !d.clearedAt ? (
                    <Badge tone="danger">Requiere valoración por profesional sanitario</Badge>
                  ) : null}
                  {d.clearedAt ? <Badge tone="ok">Valoración registrada</Badge> : null}
                </div>
                {d.description ? <p className="text-muted">{d.description}</p> : null}
                {d.clearanceNote ? (
                  <p className="text-muted">Valoración: {d.clearanceNote}</p>
                ) : null}
                {d.requiresProfessionalAssessment && !d.clearedAt ? (
                  <ClearForm
                    onSubmit={(note) =>
                      clear.run(`/clients/${clientId}/health/${d.id}/clear`, 'POST', { note })
                    }
                    pending={clear.pending}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <FormError error={clear.error} />
      </Card>
      <Card title="Nueva declaración">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await add.run(`/clients/${clientId}/health`, 'POST', {
              ...form,
              declaredOn: form.declaredOn || undefined,
            });
            if (ok)
              setForm({
                ...form,
                bodyRegion: '',
                description: '',
                requiresProfessionalAssessment: false,
              });
          }}
        >
          <Field label="Tipo" htmlFor="h-type">
            <Select
              id="h-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={opts(LABELS.healthType)}
            />
          </Field>
          <Field label="Zona" htmlFor="h-region">
            <Input
              id="h-region"
              value={form.bodyRegion}
              onChange={(e) => setForm({ ...form, bodyRegion: e.target.value })}
            />
          </Field>
          <Field label="Estado declarado" htmlFor="h-status">
            <Select
              id="h-status"
              value={form.declaredStatus}
              onChange={(e) => setForm({ ...form, declaredStatus: e.target.value })}
              options={opts(LABELS.declaredStatus)}
            />
          </Field>
          <div className="md:col-span-3">
            <Field
              label="Descripción"
              htmlFor="h-desc"
              hint="No incluyas información médica innecesaria."
            >
              <Textarea
                id="h-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input
              type="checkbox"
              checked={form.requiresProfessionalAssessment}
              onChange={(e) =>
                setForm({ ...form, requiresProfessionalAssessment: e.target.checked })
              }
            />
            Requiere valoración por profesional sanitario
          </label>
          <div className="md:col-span-3">
            <FormError error={add.error} />
          </div>
          <div>
            <Button type="submit" disabled={add.pending || !hasConsent}>
              Registrar declaración
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ClearForm({ onSubmit, pending }: { onSubmit: (note: string) => void; pending: boolean }) {
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Nota de la valoración profesional"
        placeholder="Ej.: alta de fisioterapia aportada (fecha)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="max-w-md"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || !note.trim()}
        onClick={() => onSubmit(note)}
      >
        Registrar valoración
      </Button>
    </div>
  );
}

export function ConsentsPanel({
  clientId,
  data,
  only,
  intro,
}: {
  clientId: string;
  data: ConsentData;
  only?: string;
  intro?: string;
}) {
  const { run, pending, error } = useApiAction();
  const [method, setMethod] = useState('paper');
  const rows = data.status.filter((s) => !only || s.purpose === only);
  return (
    <Card title="Consentimientos">
      {intro ? <p className="mb-3 text-sm">{intro}</p> : null}
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((s) => (
          <li
            key={s.purpose}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <Badge tone={s.active ? 'ok' : 'neutral'}>
                {s.active ? 'Otorgado' : 'No otorgado'}
              </Badge>
              {label('consentPurpose', s.purpose)}{' '}
              <span className="text-muted">(texto {s.currentVersion})</span>
            </span>
            {s.active ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(`/clients/${clientId}/consents/${s.purpose}`, 'DELETE')}
              >
                Registrar revocación
              </Button>
            ) : (
              <span className="flex items-center gap-2">
                <Select
                  aria-label="Método"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-8 w-40"
                  options={[
                    { value: 'paper', label: 'Firmado en papel' },
                    { value: 'verbal_recorded', label: 'Verbal registrado' },
                  ]}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(`/clients/${clientId}/consents`, 'POST', { purpose: s.purpose, method })
                  }
                >
                  Registrar consentimiento
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Si el cliente tiene cuenta, puede otorgar o revocar sus consentimientos desde la app.
      </p>
      <FormError error={error} />
      {!only && data.history.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Registro completo</summary>
          <ul className="mt-2">
            {data.history.map((h) => (
              <li key={h.id} className="text-muted">
                {label('consentPurpose', h.purpose)} · {label('consentMethod', h.method)} ·{' '}
                {formatDate(new Date(h.grantedAt))}
                {h.revokedAt ? ` → revocado ${formatDate(new Date(h.revokedAt))}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

export function AssignmentsPanel({
  clientId,
  assignments,
  trainers,
  canManage,
}: {
  clientId: string;
  assignments: ClientDetail['assignments'];
  trainers: { id: string; firstName: string; lastName: string }[];
  canManage: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const [trainerId, setTrainerId] = useState('');
  const available = trainers.filter((t) => !assignments.some((a) => a.trainerId === t.id));
  return (
    <Card title="Entrenadores asignados">
      <ul className="flex flex-col divide-y divide-border text-sm">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-2">
            <span>
              {a.name} <span className="text-muted">· {label('assignmentRole', a.role)}</span>
            </span>
            {canManage && assignments.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(`/clients/${clientId}/assignments/${a.id}`, 'DELETE')}
              >
                Quitar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage && available.length ? (
        <div className="mt-3 flex gap-2">
          <Select
            aria-label="Entrenador"
            placeholder="Añadir entrenador/a…"
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
            options={available.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
          />
          <Button
            disabled={!trainerId || pending}
            onClick={() =>
              run(`/clients/${clientId}/assignments`, 'POST', { trainerId, role: 'collaborator' })
            }
          >
            Asignar
          </Button>
        </div>
      ) : null}
      <FormError error={error} />
    </Card>
  );
}

export function HistoryPanel({
  clientId,
  history,
}: {
  clientId: string;
  history: {
    id: string;
    kind: string;
    periodStart: string | null;
    periodEnd: string | null;
    description: string;
  }[];
}) {
  const { run, pending, error } = useApiAction();
  const [form, setForm] = useState({
    kind: 'sport',
    periodStart: '',
    periodEnd: '',
    description: '',
  });
  return (
    <Card title="Historial deportivo y de entrenamiento">
      {history.length === 0 ? (
        <EmptyState>Sin entradas.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-2 py-2">
              <span>
                <Badge>{label('historyKind', h.kind)}</Badge>{' '}
                <span className="text-muted">
                  {formatDate(h.periodStart)} – {formatDate(h.periodEnd)}
                </span>{' '}
                · {h.description}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(`/clients/${clientId}/history/${h.id}`, 'DELETE')}
              >
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 grid gap-2 md:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(`/clients/${clientId}/history`, 'POST', {
            ...form,
            periodStart: form.periodStart || null,
            periodEnd: form.periodEnd || null,
          });
          if (ok) setForm({ ...form, description: '' });
        }}
      >
        <Select
          aria-label="Tipo"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
          options={opts(LABELS.historyKind)}
        />
        <Input
          aria-label="Desde"
          type="date"
          value={form.periodStart}
          onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
        />
        <Input
          aria-label="Hasta"
          type="date"
          value={form.periodEnd}
          onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
        />
        <Input
          aria-label="Descripción"
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Button type="submit" disabled={pending || !form.description.trim()}>
          Añadir
        </Button>
      </form>
      <FormError error={error} />
    </Card>
  );
}

interface ToleranceRow {
  id: string;
  kind: string;
  reason: string | null;
  exerciseName: string | null;
  patternName: string | null;
}

/** [SALUD] Exercises or patterns the client does or does not tolerate (§10 del encargo). */
export function TolerancesPanel({
  clientId,
  rows,
  patterns,
  hasConsent,
}: {
  clientId: string;
  rows: ToleranceRow[];
  patterns: { id: string; name: string }[];
  hasConsent: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const [target, setTarget] = useState<{
    type: 'exercise' | 'pattern';
    id: string;
    name: string;
  } | null>(null);
  const [kind, setKind] = useState('not_tolerated');
  const [reason, setReason] = useState('');
  return (
    <Card title="Ejercicios tolerados y no tolerados">
      {rows.length === 0 ? (
        <EmptyState>Sin registros.</EmptyState>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <Badge
                  tone={r.kind === 'tolerated' ? 'ok' : r.kind === 'restricted' ? 'warn' : 'danger'}
                >
                  {label('toleranceKind', r.kind)}
                </Badge>{' '}
                {r.exerciseName ?? `Patrón: ${r.patternName}`}
                {r.reason ? <span className="text-muted"> · {r.reason}</span> : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(`/clients/${clientId}/tolerances/${r.id}`, 'DELETE')}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <ExercisePicker
          ariaLabel="Ejercicio"
          onPick={(h) => setTarget({ type: 'exercise', id: h.id, name: h.name })}
        />
        <Select
          aria-label="o patrón"
          placeholder="…o un patrón completo"
          value={target?.type === 'pattern' ? target.id : ''}
          onChange={(e) =>
            setTarget(
              e.target.value
                ? {
                    type: 'pattern',
                    id: e.target.value,
                    name: patterns.find((p) => p.id === e.target.value)!.name,
                  }
                : null,
            )
          }
          options={patterns.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          aria-label="Tolerancia"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={Object.entries(LABELS.toleranceKind).map(([v, l]) => ({ value: v, label: l }))}
        />
        <Input
          aria-label="Motivo"
          placeholder="Motivo (sin datos médicos innecesarios)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {target ? <p className="mt-1 text-xs text-muted">Seleccionado: {target.name}</p> : null}
      <FormError error={error} />
      <Button
        className="mt-2"
        disabled={!target || pending || !hasConsent}
        onClick={async () => {
          if (!target) return;
          if (
            await run(`/clients/${clientId}/tolerances`, 'POST', {
              [target.type === 'exercise' ? 'exerciseId' : 'movementPatternId']: target.id,
              kind,
              reason,
            })
          ) {
            setTarget(null);
            setReason('');
          }
        }}
      >
        Registrar
      </Button>
    </Card>
  );
}
