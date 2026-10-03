import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="text-sm text-muted">El recurso no existe o no tienes acceso.</p>
      <Link href="/" className="text-sm underline">
        Volver al inicio
      </Link>
    </main>
  );
}
