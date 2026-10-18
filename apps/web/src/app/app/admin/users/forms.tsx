'use client';

import { useRef, useState } from 'react';
import { ShareLink } from '@/components/share-link';
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
        <ShareLink
          link={link}
          intro="Invitación creada: vale 7 días. Mándasela."
          message="Hola, te invito a la plataforma de entrenamiento. Crea tu cuenta aquí:"
        />
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

/** A new-password link for another account (restructure phase 23), shown in a dialog. */
export function PasswordLinkButton({ userId, name }: { userId: string; name: string }) {
  const { run, pending, error } = useApiAction();
  const [link, setLink] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={`Nueva contraseña para ${name}`}
        onClick={async () => {
          const r = await run<{ link: string }>(
            `/users/${userId}/password-link`,
            'POST',
            {},
            { refresh: false },
          );
          if (r) {
            setLink(r.link);
            dialog.current?.showModal();
          }
        }}
      >
        Nueva contraseña
      </Button>
      {error ? <span className="text-xs text-danger">{error.message}</span> : null}
      <dialog
        ref={dialog}
        aria-labelledby={`password-link-${userId}`}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-border bg-bg p-5 text-text backdrop:bg-black/40"
        onClose={() => setLink(null)}
      >
        <h2 id={`password-link-${userId}`} className="text-lg font-semibold">
          Nueva contraseña para {name}
        </h2>
        {link ? (
          <ShareLink
            link={link}
            intro="Enlace creado: vale 24 horas y una sola vez. Mándaselo."
            message="Hola, con este enlace puedes crear tu nueva contraseña de la plataforma de entrenamiento:"
          />
        ) : null}
        <form method="dialog" className="mt-4">
          <Button variant="secondary">Cerrar</Button>
        </form>
      </dialog>
    </>
  );
}
