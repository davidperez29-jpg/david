import Link from 'next/link';
import { listPendingVideos } from '@tp/application';
import { VideoVerdict } from '@/components/library/video-verdict';
import { Card, EmptyState } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

/**
 * Videos of the bank waiting for a person (restructure phase 19): one at a time, watched here,
 * marked as correct or broken. Nothing is verified automatically (§28, A68).
 */
export default async function PendingVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ saltar?: string }>;
}) {
  const ctx = await requireStaff();
  const skip = Math.max(0, Number((await searchParams).saltar ?? 0) || 0);
  const page = await listPendingVideos(ctx, { offset: skip, limit: 1 });
  const v = page.items[0];
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/app/library/revision" className="text-sm text-muted hover:underline">
        ← Revisión del banco
      </Link>
      <h1 className="text-2xl font-semibold">Verificar vídeos</h1>
      <p className="text-sm text-muted">
        Quedan <strong>{page.total}</strong> vídeos sin verificar. Míralo entero y confirma que
        muestra este ejercicio con una técnica correcta; si no carga o no corresponde, márcalo como
        roto. Hasta entonces el cliente ve el aviso de vídeo pendiente.
      </p>
      {!v ? (
        <Card>
          <EmptyState>
            {page.total ? 'Has saltado todos los que quedan.' : 'No quedan vídeos por verificar.'}{' '}
            {skip ? (
              <Link href="/app/library/revision/videos" className="text-accent underline">
                Volver al primero
              </Link>
            ) : null}
          </EmptyState>
        </Card>
      ) : (
        <Card title={v.exerciseName} headingId="video-titulo">
          {v.embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-md border border-border">
              <iframe
                src={v.embedUrl}
                title={`Vídeo de «${v.exerciseName}»`}
                className="h-full w-full"
                loading="lazy"
                allow="encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-warn">No se puede incrustar: ábrelo en su página.</p>
          )}
          <p className="mt-2 text-sm">
            {v.title ? `${v.title} · ` : ''}
            {v.channel ? `${v.channel} · ` : ''}
            <a
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Abrir en su página
            </a>{' '}
            ·{' '}
            <Link href={`/app/library/${v.exerciseId}?tab=medios`} className="underline">
              Ver la ficha del ejercicio
            </Link>
          </p>
          <VideoVerdict
            exerciseId={v.exerciseId}
            mediaId={v.mediaId}
            exerciseName={v.exerciseName}
            skipHref={`/app/library/revision/videos?saltar=${skip + 1}`}
            focusId="video-titulo"
          />
        </Card>
      )}
    </div>
  );
}
