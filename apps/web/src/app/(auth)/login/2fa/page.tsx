'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export default function SecondFactorPage() {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  const [code, setCode] = useState('');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run('/auth/2fa/verify', 'POST', { code }, { refresh: false }))
          router.replace('/');
      }}
    >
      <h1 className="text-xl font-semibold">Verificación en dos pasos</h1>
      <p className="text-sm text-muted">
        Introduce el código de 6 dígitos de tu aplicación de autenticación.
      </p>
      <Field label="Código" htmlFor="code">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
        Verificar
      </Button>
    </form>
  );
}
