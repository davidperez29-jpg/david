'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export function LoginForm() {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = await run<{ requiresSecondFactor: boolean }>(
      '/auth/login',
      'POST',
      { email, password },
      { refresh: false },
    );
    if (r) router.replace(r.requiresSecondFactor ? '/login/2fa' : '/');
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-muted underline">
        He olvidado mi contraseña
      </Link>
    </form>
  );
}
