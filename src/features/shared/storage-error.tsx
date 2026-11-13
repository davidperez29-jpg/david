'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { parseStorageDigest } from '@/contracts/storage';
import { KettlebellIllustration } from '@/features/brand/illustrations';
import { buttonClasses } from '@/ui/button';
import { cn } from '@/ui/cn';
import { audienceOf, storageErrorCopy } from './storage-error-copy';

/**
 * Página de error (B3.0, docs/BLOCK3_SPEC.md §14; ADR-34). Con el `digest` que pone el servidor
 * distingue qué falló, qué pasó con la operación y qué se puede hacer (`storage-error-copy.ts`).
 * Nunca muestra rutas, consultas, trazas ni datos de nadie. «Volver a intentarlo» solo vuelve a
 * LEER la página: no repite ninguna escritura.
 */
export function StorageErrorView({
  error,
  retry,
  landmark = 'main',
}: {
  error: unknown;
  retry: () => void;
  /** `section` dentro de un área que ya tiene su `main` (la del entrenador). */
  landmark?: 'main' | 'section';
}) {
  const audience = audienceOf(usePathname() ?? '/');
  const digest =
    error !== null && typeof error === 'object' && 'digest' in error
      ? (error as { digest?: unknown }).digest
      : undefined;
  const info = parseStorageDigest(digest);
  const copy = storageErrorCopy(info, audience);
  const home = audience === 'trainer' ? '/entrenador' : audience === 'client' ? '/cliente' : '/';
  const Landmark = landmark;

  return (
    <Landmark
      {...(landmark === 'main' ? { id: 'contenido' } : {})}
      aria-labelledby="error-titulo"
      data-storage-kind={info?.kind ?? 'none'}
      data-storage-operation={info?.operation ?? 'none'}
      data-storage-category={info?.category ?? 'none'}
      data-storage-outcome={info?.outcome ?? 'none'}
      className={cn(
        'grid place-items-center px-4',
        landmark === 'main' ? 'min-h-dvh' : 'min-h-[60dvh] py-8',
      )}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <KettlebellIllustration />
        {copy.category ? (
          <p className="mt-4 rounded-full bg-cream-100 px-3 py-1 text-sm font-semibold text-ink-700">
            {copy.category}
          </p>
        ) : null}
        <h1 id="error-titulo" className="mt-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
          {copy.title}
        </h1>
        <p role="alert" className="mt-2 text-ink-700">
          {copy.outcome}
        </p>
        {copy.advice ? <p className="mt-2 text-sm text-ink-500">{copy.advice}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => retry()} className={buttonClasses('primary', 'md')}>
            {copy.retryLabel}
          </button>
          <Link href={home} className={buttonClasses('secondary', 'md')}>
            Ir al inicio
          </Link>
        </div>
      </div>
    </Landmark>
  );
}
