'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { passwordProblemText } from '@/lib/password-text';

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const { run, pending, error, fieldError } = useApiAction();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mismatch) return;
        if (
          await run(
            '/invitations/accept',
            'POST',
            { token, displayName, password },
            { refresh: false },
          )
        )
          router.replace('/');
      }}
    >
      <Field label="Nombre visible" htmlFor="displayName" error={fieldError('displayName')}>
        <Input
          id="displayName"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      <Field
        label="Contraseña"
        htmlFor="password"
        hint="Mínimo 12 caracteres. Una frase larga es más segura."
        error={passwordProblemText(fieldError('password'))}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field
        label="Repite la contraseña"
        htmlFor="confirm"
        error={mismatch ? 'Las contraseñas no coinciden.' : undefined}
      >
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending || mismatch}>
        Crear cuenta
      </Button>
    </form>
  );
}
