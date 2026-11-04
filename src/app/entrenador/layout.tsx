import { type Metadata } from 'next';
import { type ReactNode } from 'react';
import { initials } from '@/domain/text';
import { TrainerShell } from '@/features/trainer/shell';
import { getTrainerContext } from '@/server/context';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s · Entrenador · TrainPro' },
};

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const ctx = await getTrainerContext();
  const trainer = await ctx.repos.trainers.getById(ctx.actor.trainerId);
  const name = trainer?.displayName ?? 'Entrenador';
  return (
    <TrainerShell trainerName={name} initials={initials(name)}>
      {children}
    </TrainerShell>
  );
}
