'use client';

import { StorageErrorView } from '@/features/shared/storage-error';

/** Error dentro del área del entrenador: se muestra con su menú (B3.0). */
export default function TrainerErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <StorageErrorView error={error} retry={retry} landmark="section" />;
}
