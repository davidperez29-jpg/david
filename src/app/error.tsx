'use client';

import { StorageErrorView } from '@/features/shared/storage-error';

/**
 * Error en una página o en el layout de un área (B3.0): explica qué ha pasado sin detalles
 * técnicos, si se puede reintentar y si una operación se aplicó o no (`storage-error.tsx`).
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <StorageErrorView error={error} retry={retry} />;
}
