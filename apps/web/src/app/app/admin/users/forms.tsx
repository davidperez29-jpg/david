'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export function InviteStaffForm() {
  const { run, pending, error, fieldError } = useApiAction();
  const [form, setForm] = useState({ role: 'TRAINER', email: '', firstName: '', lastName: '' });
  const [link, setLink] = useState<string | null>(null);
  return (
    <Card title="Invitar al equipo">
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = form.role === 'TRAINER' ? form : { role: form.role, email: form.email };
          const r = await run<{ link: string }>('/invitations', 'POST', body);
          if (r) {
            setLink(r.link);
            setForm({ ...form, email: '', firstName: '', lastName: '' });
          }
        }}
      >
        <Field label="Rol" htmlFor="inv-role">
          <Select
            id="inv-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: 'TRAINER', label: 'Entrenador/a' },
              { value: 'ADMIN', label: 'Administración' },
            ]}
          />
        </Field>
        <Field label="Email" htmlFor="inv-email" error={fieldError('email')}>
          <Input
            id="inv-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        {form.role === 'TRAINER' ? (
          <>
            <Field label="Nombre" htmlFor="inv-fn" error={fieldError('firstName')}>
              <Input
                id="inv-fn"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Apellidos" htmlFor="inv-ln" error={fieldError('lastName')}>
              <Input
                id="inv-ln"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </>
        ) : null}
        <div className="md:col-span-4">
          <FormError error={error} />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Crear invitación
          </Button>
        </div>
      </form>
      {link ? (
        <p className="mt-3 text-sm">
          Enlace (válido 7 días; compártelo por un canal seguro):{' '}
          <code className="block break-all rounded bg-surface p-2 text-xs">{link}</code>
        </p>
      ) : null}
    </Card>
  );
}

export function UserStatusButton({ userId, active }: { userId: string; active: boolean }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <Button
        size="sm"
        variant={active ? 'ghost' : 'secondary'}
        disabled={pending}
        onClick={() => {
          if (!active || confirm('¿Desactivar esta cuenta? Se cerrarán sus sesiones.'))
            void run(`/users/${userId}/status`, 'POST', { active: !active });
        }}
      >
        {active ? 'Desactivar' : 'Reactivar'}
      </Button>
      {error ? <span className="text-xs text-danger">{error.message}</span> : null}
    </>
  );
}
