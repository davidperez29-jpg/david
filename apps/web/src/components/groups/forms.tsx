'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export function NewGroupForm() {
  const router = useRouter();
  const a = useApiAction();
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>('/groups', 'POST', { name }, { refresh: false });
        if (r) router.push(`/app/groups/${r.id}`);
      }}
    >
      <Field label="Nombre del grupo o equipo" htmlFor="g-name" error={a.fieldError('name')}>
        <Input
          id="g-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Juvenil A, Grupo mañanas…"
          className="w-72"
        />
      </Field>
      <Button disabled={a.pending}>Crear grupo</Button>
      <FormError error={a.error} />
    </form>
  );
}

/** Pick members from the clients this person can access (checkboxes with a filter). */
export function MembersEditor({
  groupId,
  members,
  candidates,
}: {
  groupId: string;
  members: string[];
  candidates: { id: string; name: string }[];
}) {
  const a = useApiAction();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(new Set(members));
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const shown = useMemo(
    () => candidates.filter((c) => norm(c.name).includes(norm(q))),
    [candidates, q],
  );
  const add = [...selected].filter((x) => !members.includes(x));
  const remove = members.filter((x) => !selected.has(x));
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await a.run(`/groups/${groupId}/members`, 'POST', { add, remove });
      }}
    >
      <Input
        type="search"
        aria-label="Filtrar clientes"
        placeholder="Filtrar clientes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-xs"
      />
      <ul className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  setSelected(next);
                }}
              />
              {c.name}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button disabled={a.pending || (!add.length && !remove.length)}>Guardar miembros</Button>
        {add.length || remove.length ? (
          <span className="text-xs text-muted">
            {add.length ? `+${add.length}` : ''} {remove.length ? `−${remove.length}` : ''}
          </span>
        ) : a.done ? (
          <span className="text-xs text-ok">Guardado</span>
        ) : null}
      </div>
      <FormError error={a.error} />
    </form>
  );
}

/**
 * New group assessment: a date and a battery (or tests). Creates one assessment per member and
 * opens the attempts sheet.
 */
export function GroupAssessmentForm({
  groupId,
  today,
  batteries,
  tests,
}: {
  groupId: string;
  today: string;
  batteries: { id: string; name: string }[];
  tests: { id: string; name: string; category: string }[];
}) {
  const router = useRouter();
  const a = useApiAction();
  const [date, setDate] = useState(today);
  const [batteryId, setBatteryId] = useState(batteries[0]?.id ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ assessedOn: string }>(
          `/groups/${groupId}/assessments`,
          'POST',
          {
            assessedOn: date,
            batteryId: picked.size ? null : batteryId || null,
            testIds: [...picked],
          },
          { refresh: false },
        );
        if (r) router.push(`/app/groups/${groupId}/${r.assessedOn}`);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Fecha" htmlFor="ga-date" error={a.fieldError('assessedOn')}>
          <Input id="ga-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Batería" htmlFor="ga-battery">
          <Select
            id="ga-battery"
            value={batteryId}
            onChange={(e) => setBatteryId(e.target.value)}
            disabled={picked.size > 0}
            options={batteries.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Button disabled={a.pending}>Crear hoja de intentos</Button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm">
          O elige los tests uno a uno{picked.size ? ` (${picked.size})` : ''}
        </summary>
        <ul className="mt-2 grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <li key={t.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(t.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(t.id);
                    else next.delete(t.id);
                    setPicked(next);
                  }}
                />
                {t.name}
              </label>
            </li>
          ))}
        </ul>
      </details>
      <FormError error={a.error} />
    </form>
  );
}

export function ArchiveGroupButton({
  groupId,
  version,
  archived,
}: {
  groupId: string;
  version: number;
  archived: boolean;
}) {
  const a = useApiAction();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={a.pending}
      onClick={() =>
        a.run(`/groups/${groupId}`, 'PATCH', { archived: !archived, expectedVersion: version })
      }
    >
      {archived ? 'Recuperar grupo' : 'Archivar grupo'}
    </Button>
  );
}
