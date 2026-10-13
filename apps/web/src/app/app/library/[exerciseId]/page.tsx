import Link from 'next/link';
import { cache } from 'react';
import {
  getExercise,
  listLibraryTaxonomies,
  listMethods,
  nextExerciseToReview,
} from '@tp/application';
import { evidenceCards, type EvidenceCards } from '@tp/application';
import { SourceButton } from '@/components/science/source-button';
import { DomainError, REVIEW_GAPS, type ReviewGap } from '@tp/domain';
import { notFound } from 'next/navigation';
import { BodyMap } from '@/components/library/body-map';
import { Badge, Card } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import {
  EditExercise,
  ExerciseActions,
  LoadIncrementPanel,
  MediaPanel,
  MethodsPanel,
  ProgressionsPanel,
  SubstitutesPanel,
} from './panels';

const TABS = [
  ['ficha', 'Ficha'],
  ['medios', 'Vídeo y silueta'],
  ['progresiones', 'Progresiones'],
  ['sustituciones', 'Sustituciones'],
  ['metodos', 'Métodos'],
] as const;

/** One read per request, shared by the title and the page. */
const exerciseOf = cache(async (id: string) =>
  getExercise(await requireStaff(), id).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  }),
);

/** The exercise's name as the page title: moving to «Siguiente» is announced (phase 21, A-BR-4). */
export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }) {
  return { title: (await exerciseOf((await params).exerciseId)).name };
}

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ tab?: string; revision?: string }>;
}) {
  const ctx = await requireStaff();
  const { exerciseId } = await params;
  const { tab = 'ficha', revision } = await searchParams;
  // Opened from the bank review queue (phase 19): the queue's filters travel with the page.
  const keep = revision !== undefined ? `&revision=${encodeURIComponent(revision)}` : '';
  const [ex, tax] = await Promise.all([exerciseOf(exerciseId), listLibraryTaxonomies(ctx)]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/library" className="text-sm text-muted hover:underline">
          ← Ejercicios
        </Link>
        <h1 className="text-2xl font-semibold">{ex.name}</h1>
        <Badge tone={ex.status === 'published' ? 'ok' : 'neutral'}>
          {label('exerciseStatus', ex.status)}
        </Badge>
        {ex.needsReview ? <Badge tone="warn">Pendiente de revisión</Badge> : null}
        {ex.isGlobal ? <Badge tone="accent">Global (solo lectura)</Badge> : null}
      </div>
      {revision !== undefined ? <ReviewBar ex={ex} queue={revision} /> : null}
      {ex.needsReview && ex.reviewNotes ? (
        <p className="rounded-md border border-warn p-3 text-sm">
          <strong>Notas de importación:</strong> {ex.reviewNotes}
        </p>
      ) : null}
      <ExerciseSummary
        ex={ex}
        methods={await listMethods(ctx)}
        evidence={await evidenceCards(ctx, { methodIds: ex.methodIds })}
      />
      <ExerciseActions
        exercise={{
          id: ex.id,
          status: ex.status,
          needsReview: ex.needsReview,
          isGlobal: ex.isGlobal,
          publishProblems: ex.publishProblems,
        }}
      />
      <nav
        className="flex flex-wrap gap-1 border-b border-border"
        aria-label="Secciones del ejercicio"
      >
        {TABS.map(([key, name]) => (
          <Link
            key={key}
            href={`?tab=${key}${keep}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-accent font-medium text-text' : 'border-transparent text-muted hover:text-text'}`}
          >
            {name}
          </Link>
        ))}
      </nav>
      {tab === 'ficha' ? <EditExercise exercise={ex} tax={tax} /> : null}
      {tab === 'medios' ? <MediaPanel exercise={ex} /> : null}
      {tab === 'progresiones' ? (
        <>
          <ProgressionsPanel exercise={ex} />
          <LoadIncrementPanel exercise={ex} />
        </>
      ) : null}
      {tab === 'sustituciones' ? <SubstitutesPanel exerciseId={ex.id} /> : null}
      {tab === 'metodos' ? <MethodsPanel exercise={ex} methods={await listMethods(ctx)} /> : null}
      {ex.source !== 'manual' ? (
        <Card>
          <p className="text-xs text-muted">
            Origen: {ex.source}
            {ex.sourceRef ? ` · ${ex.sourceRef}` : ''}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

type Ex = Awaited<ReturnType<typeof getExercise>>;

const QUEUE_KEYS = ['gap', 'q', 'patternId', 'categoryId', 'status'];

/**
 * Bar of the bank review (restructure phase 19): what this exercise still lacks, how many remain
 * in the queue after it and a link to the next one, so the bank is reviewed one by one.
 */
async function ReviewBar({ ex, queue }: { ex: Ex; queue: string }) {
  const ctx = await requireStaff();
  const filters = Object.fromEntries(
    [...new URLSearchParams(queue)].filter(([k, v]) => QUEUE_KEYS.includes(k) && v),
  );
  const videos = ex.media.filter((m) => m.type === 'video');
  const lacks = new Set<ReviewGap>([
    ...ex.publishProblems,
    ...(videos.some((v) => v.status === 'pending_verification') ? ['pending_video' as const] : []),
    ...(videos.some((v) => v.status === 'broken') ? ['broken_video' as const] : []),
  ]);
  const gaps = REVIEW_GAPS.filter((g) => lacks.has(g));
  const { next, remaining } = await nextExerciseToReview(ctx, { ...filters, after: ex.id }).catch(
    () => ({ next: null, remaining: 0 }),
  );
  const back = `/app/library/revision${queue ? `?${queue}` : ''}`;
  return (
    <nav
      aria-label="Revisión del banco"
      className="flex flex-wrap items-center gap-2 rounded-md border border-accent p-3 text-sm"
    >
      <span className="font-medium">Revisión del banco.</span>
      {gaps.length ? (
        <span className="flex flex-wrap items-center gap-1">
          Le falta:
          {gaps.map((g) => (
            <Badge key={g} tone={g === 'broken_video' ? 'danger' : 'warn'}>
              {label('reviewGap', g)}
            </Badge>
          ))}
        </span>
      ) : (
        <Badge tone="ok">
          {ex.status === 'published' ? 'Publicado' : 'Completo: se puede publicar'}
        </Badge>
      )}
      <span className="text-muted">Quedan {remaining} en la cola después de este.</span>
      <span className="ml-auto flex flex-wrap gap-3">
        <Link href={back} className="underline">
          Volver a la cola
        </Link>
        {next ? (
          <Link
            href={`/app/library/${next.id}?revision=${encodeURIComponent(queue)}`}
            className="font-medium text-accent underline"
          >
            Siguiente: {next.name} →
          </Link>
        ) : (
          <span className="text-muted">Es el último de la cola.</span>
        )}
      </span>
    </nav>
  );
}
type Method = Awaited<ReturnType<typeof listMethods>>[number];

/**
 * What the trainer looks at first (restructure §11): silhouette, categories, muscles, video,
 * progressions and regressions, and the references (methods with their evidence).
 */
function ExerciseSummary({
  ex,
  methods,
  evidence,
}: {
  ex: Ex;
  methods: Method[];
  evidence: EvidenceCards;
}) {
  const silhouette = ex.media.find((m) => m.type === 'silhouette' && m.status !== 'replaced');
  const videos = ex.media.filter((m) => m.type === 'video' && m.status !== 'replaced');
  const verified = videos.find((v) => v.status === 'verified');
  const cats = [...ex.categories].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const primary = ex.muscles.filter((m) => m.role === 'primary');
  const secondary = ex.muscles.filter((m) => m.role !== 'primary');
  const up = ex.related.filter((r) => r.relation === 'progression');
  const down = ex.related.filter((r) => r.relation === 'regression');
  const refs = methods.filter((m) => ex.methodIds.includes(m.id));
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex justify-center">
          {silhouette?.fileUrl ? (
            <img
              src={silhouette.fileUrl}
              alt={`Silueta de ${ex.name}`}
              className="h-56 w-auto rounded-md border border-border bg-bg object-contain"
            />
          ) : (
            <BodyMap muscles={ex.muscles} />
          )}
        </div>
        <dl className="grid content-start gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Categorías</dt>
          <dd className="flex flex-wrap gap-1">
            {cats.length ? (
              cats.map((c) => (
                <Badge key={c.id} tone={c.isPrimary ? 'accent' : 'neutral'}>
                  {c.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted">Sin categoría</span>
            )}
          </dd>
          <dt className="text-muted">Músculos</dt>
          <dd>
            {primary.length ? <strong>{primary.map((m) => m.name).join(', ')}</strong> : '—'}
            {secondary.length ? (
              <span className="text-muted">
                {' '}
                · secundarios: {secondary.map((m) => m.name).join(', ')}
              </span>
            ) : null}
          </dd>
          <dt className="text-muted">Vídeo</dt>
          <dd>
            {verified ? (
              <Link href="?tab=medios" className="text-accent underline">
                Ver vídeo verificado
              </Link>
            ) : videos.length ? (
              <span className="text-warn">
                Pendiente de verificación (no se muestra al cliente)
              </span>
            ) : (
              <span className="text-muted">Sin vídeo</span>
            )}
          </dd>
          <dt className="text-muted">Progresiones</dt>
          <dd>
            {up.length
              ? up.map((r, i) => (
                  <span key={r.id}>
                    {i ? ', ' : ''}
                    <Link href={`/app/library/${r.otherId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </span>
                ))
              : '—'}
          </dd>
          <dt className="text-muted">Regresiones</dt>
          <dd>
            {down.length
              ? down.map((r, i) => (
                  <span key={r.id}>
                    {i ? ', ' : ''}
                    <Link href={`/app/library/${r.otherId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </span>
                ))
              : '—'}
          </dd>
          <dt className="text-muted">Referencias</dt>
          <dd>
            {refs.length ? (
              refs.map((m, i) => (
                <span key={m.id}>
                  {i ? ', ' : ''}
                  <Link href={`/app/science/methods/${m.id}`} className="text-accent underline">
                    {m.name}
                  </Link>
                </span>
              ))
            ) : (
              <span className="text-muted">
                Sin métodos enlazados: la dosis se apoya en el criterio del entrenador.
              </span>
            )}
            {refs.length ? (
              <div className="mt-1">
                <SourceButton evidence={evidence} />
              </div>
            ) : null}
          </dd>
          {ex.clientDescription ? (
            <>
              <dt className="text-muted">Para el cliente</dt>
              <dd>{ex.clientDescription}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </Card>
  );
}
