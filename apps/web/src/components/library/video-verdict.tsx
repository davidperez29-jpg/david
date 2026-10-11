'use client';

import Link from 'next/link';
import { announce } from '@/components/ui/announcer';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

/** «Es correcto» or «Está roto» for the video on screen; the next one takes its place. */
export function VideoVerdict({
  exerciseId,
  mediaId,
  exerciseName,
  skipHref,
  focusId,
}: {
  exerciseId: string;
  mediaId: string;
  exerciseName: string;
  skipHref: string;
  focusId: string;
}) {
  const a = useApiAction();
  const decide = async (status: 'verified' | 'broken') => {
    const r = await a.run(`/exercises/${exerciseId}/media/${mediaId}/verify`, 'POST', { status });
    if (r !== null)
      announce(
        `Vídeo de «${exerciseName}» marcado como ${status === 'verified' ? 'correcto' : 'roto'}. Siguiente vídeo.`,
        focusId,
      );
  };
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={a.pending} onClick={() => void decide('verified')}>
          He visto el vídeo: es correcto
        </Button>
        <Button variant="danger" disabled={a.pending} onClick={() => void decide('broken')}>
          Está roto o no corresponde
        </Button>
        <Link
          href={skipHref}
          className="inline-flex h-10 items-center px-3 text-sm text-muted underline"
        >
          Saltar
        </Link>
      </div>
      <FormError error={a.error} />
    </div>
  );
}
