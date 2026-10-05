import type { Metadata } from 'next';
import { hasAnyOrganization } from '@tp/application';
import { baseContext } from '@/server/context';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // First run of an online deployment whose administrator could not be created (docs/DEPLOY_RENDER.md).
  const ready = await hasAnyOrganization(baseContext().db);
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Iniciar sesión</h1>
      {ready ? null : (
        <div role="status" className="mb-4 rounded-md border border-warn p-3 text-sm">
          <p className="font-medium">Todavía no hay ninguna cuenta de administrador.</p>
          <p className="mt-1">
            Si acabas de publicar la aplicación en Render, abre el servicio → <b>Environment</b>,
            revisa <code>ADMIN_EMAIL</code> y <code>ADMIN_PASSWORD</code> (al menos 12 caracteres y
            distinta del email) y pulsa <b>Manual Deploy → Deploy latest commit</b>.
          </p>
        </div>
      )}
      <LoginForm />
    </>
  );
}
