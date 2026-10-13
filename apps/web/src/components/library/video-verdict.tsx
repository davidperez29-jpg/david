'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
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
  // The verdict just given, said again together with the video that takes its place (phase 21,
  // A-BR-3): a new message replaces the previous one in the live region.
  const said = useRef<string | null>(null);
  const shown = useRef(mediaId);
  useEffect(() => {
    if (shown.current === mediaId) return;
    shown.current = mediaId;
    announce(`${said.current ?? ''} Ahora: vídeo de «${exerciseName}».`.trim());
    said.current = null;
  }, [mediaId, exerciseName]);
  const decide = async (status: 'verified' | 'broken') => {
    const r = await a.run(`/exercises/${exerciseId}/media/${mediaId}/verify`, 'POST', { status });
    if (r === null) return;
    said.current = `Vídeo de «${exerciseName}» marcado como ${status === 'verified' ? 'correcto' : 'roto'}.`;
    // The heading stays (the last verdict leaves an empty state with the same id).
    announce(said.current, focusId);
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
