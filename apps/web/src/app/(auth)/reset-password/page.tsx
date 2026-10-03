import { ResetForm } from './reset-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Nueva contraseña</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm text-muted">Enlace no válido.</p>
      )}
    </>
  );
}
