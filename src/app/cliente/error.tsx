'use client';

import { StorageErrorView } from '@/features/shared/storage-error';

/** Error dentro del área de la clienta: sin instrucciones técnicas (B3.0). */
export default function ClientErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <StorageErrorView error={error} retry={retry} />;
}
