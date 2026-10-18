import Link from 'next/link';

/**
 * No email provider is configured, so nothing could be sent from here (restructure phase 23):
 * the trainer or an administrator creates a new-password link instead.
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">¿Has olvidado tu contraseña?</h1>
      <p className="text-sm">
        Pide a tu entrenador un enlace para crear una nueva. Si eres del equipo del centro, pídeselo
        al administrador.
      </p>
      <p className="mt-2 text-sm text-muted">
        Si eres el administrador y no hay otro, la guía de publicación explica cómo cambiarla desde
        Render.
      </p>
      <Link href="/login" className="mt-4 block text-sm underline">
        Volver
      </Link>
    </>
  );
}
