'use client';

import { buttonClasses } from '@/ui/button';

/** Error inesperado en una página: mensaje claro sin detalles técnicos para el usuario. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-extrabold text-ink-900">Algo no ha ido bien</h1>
        <p className="mt-2 text-ink-500">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.
        </p>
        <button type="button" onClick={reset} className={buttonClasses('primary', 'md', 'mt-6')}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
