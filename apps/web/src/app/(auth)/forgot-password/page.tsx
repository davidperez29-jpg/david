'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export default function ForgotPasswordPage() {
  const { run, pending, error, done } = useApiAction();
  const [email, setEmail] = useState('');
  if (done) {
    return (
      <>
        <h1 className="mb-2 text-xl font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted">
          Si existe una cuenta con ese email, recibirás un enlace válido durante 1 hora.
        </p>
        <Link href="/login" className="mt-4 block text-sm underline">
          Volver
        </Link>
      </>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run('/auth/password-reset/request', 'POST', { email }, { refresh: false });
      }}
    >
      <h1 className="text-xl font-semibold">Restablecer contraseña</h1>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Enviar enlace
      </Button>
    </form>
  );
}
