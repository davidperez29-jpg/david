'use client';

import type { LibraryTaxonomies } from '@tp/application';
import { useRouter } from 'next/navigation';
import { emptyExercise, ExerciseForm } from '@/components/library/exercise-form';

export function NewExercise({ tax }: { tax: LibraryTaxonomies }) {
  const router = useRouter();
  return (
    <ExerciseForm
      tax={tax}
      initial={emptyExercise}
      submitLabel="Crear borrador"
      onSubmit={async (payload, run) => {
        const r = await run<{ id: string }>('/exercises', 'POST', payload, { refresh: false });
        if (r) router.push(`/app/library/${r.id}`);
      }}
    />
  );
}
