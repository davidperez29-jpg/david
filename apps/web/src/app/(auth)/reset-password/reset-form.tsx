'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { passwordProblemText } from '@/lib/password-text';

export function ResetForm({ token }: { token: string }) {
  const { run, pending, error, done, fieldError } = useApiAction();
  const [password, setPassword] = useState('');
  if (done) {
    return (
      <p className="text-sm">
        Contraseña actualizada.{' '}
        <Link href="/login" className="underline">
          Inicia sesión
        </Link>
        .
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run('/auth/password-reset', 'POST', { token, password }, { refresh: false });
      }}
    >
      <Field
        label="Contraseña"
        htmlFor="password"
        hint="Mínimo 12 caracteres."
        error={passwordProblemText(fieldError('password'))}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Guardar
      </Button>
    </form>
  );
}
