import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Iniciar sesión</h1>
      <LoginForm />
    </>
  );
}
