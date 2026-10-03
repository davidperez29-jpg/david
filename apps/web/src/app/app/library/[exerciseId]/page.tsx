import Link from 'next/link';
import { getExercise, listLibraryTaxonomies } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import {
  EditExercise,
  ExerciseActions,
  MediaPanel,
  ProgressionsPanel,
  SubstitutesPanel,
} from './panels';

const TABS = [
  ['ficha', 'Ficha'],
  ['medios', 'Vídeo y silueta'],
  ['progresiones', 'Progresiones'],
  ['sustituciones', 'Sustituciones'],
] as const;

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireStaff();
  const { exerciseId } = await params;
  const { tab = 'ficha' } = await searchParams;
  const [ex, tax] = await Promise.all([
    getExercise(ctx, exerciseId).catch((e) => {
      if (e instanceof DomainError && e.code === 'not_found') notFound();
      throw e;
    }),
    listLibraryTaxonomies(ctx),
  ]);
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
      {ex.needsReview && ex.reviewNotes ? (
        <p className="rounded-md border border-warn p-3 text-sm">
          <strong>Notas de importación:</strong> {ex.reviewNotes}
        </p>
      ) : null}
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
            href={`?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-accent font-medium text-text' : 'border-transparent text-muted hover:text-text'}`}
          >
            {name}
          </Link>
        ))}
      </nav>
      {tab === 'ficha' ? <EditExercise exercise={ex} tax={tax} /> : null}
      {tab === 'medios' ? <MediaPanel exercise={ex} /> : null}
      {tab === 'progresiones' ? <ProgressionsPanel exercise={ex} /> : null}
      {tab === 'sustituciones' ? <SubstitutesPanel exerciseId={ex.id} /> : null}
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
