import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  ExternalLink,
  Lightbulb,
  Lock,
  NotebookPen,
  Star,
  VideoOff,
} from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type VariantRefVM } from '@/contracts/trainer';
import { VISIBILITY_LABELS } from '@/domain/library/exercise';
import { COMPLEXITY_LABELS, LATERALITY_LABELS } from '@/domain/library/taxonomy';
import { isSafeExternalUrl } from '@/domain/text';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { getTrainerContext } from '@/server/context';
import { getVariantDetail } from '@/server/services/library';

export const metadata: Metadata = { title: 'Ejercicio' };

function VariantLinks({ items, empty }: { items: VariantRefVM[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/entrenador/ejercicios/${item.id}`}
            className="font-semibold text-sun-700 hover:text-ink-900"
          >
            {item.name}
          </Link>
          {item.isPrimary ? <span className="text-ink-500"> · referencia</span> : null}
          {item.visibility !== 'global' ? (
            <span className="text-ink-500"> · {VISIBILITY_LABELS[item.visibility]}</span>
          ) : null}
          {item.note ? <span className="block text-xs text-ink-500">{item.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Classification({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="border-t border-line pt-2">
      <dt className="text-xs font-semibold text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink-900">
        {values.length ? values.join(' · ') : '—'}
      </dd>
    </div>
  );
}

export default async function ExerciseDetailPage(
  props: PageProps<'/entrenador/ejercicios/[exerciseId]'>,
) {
  const { exerciseId } = await props.params;
  const detail = await getVariantDetail(await getTrainerContext(), exerciseId);
  if (!detail) notFound();
  const { variant, exercise } = detail;
  const links = variant.media.links.filter((link) => isSafeExternalUrl(link.url));

  return (
    <>
      <Link
        href="/entrenador/ejercicios"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Biblioteca
      </Link>

      <header className="flex flex-col gap-6 rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-line sm:flex-row sm:items-center sm:p-8">
        <span className="grid size-36 shrink-0 place-items-center rounded-3xl bg-sun-200">
          <ExercisePictogram
            silhouette={variant.silhouette}
            className="size-28"
            title={`Silueta de ${variant.name}`}
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sun-700">
            {variant.isPrimary ? 'Variante de referencia' : 'Variante'} de {exercise.name}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">{variant.name}</h1>
          <p className="mt-2 max-w-2xl text-ink-500">{variant.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              tone={
                variant.visibility === 'global'
                  ? 'sky'
                  : variant.visibility === 'private'
                    ? 'plum'
                    : 'leaf'
              }
              icon={variant.visibility === 'private' ? <Lock /> : undefined}
            >
              {VISIBILITY_LABELS[variant.visibility]}
            </Badge>
            <Badge tone="outline">{COMPLEXITY_LABELS[variant.complexity]}</Badge>
            <Badge tone="outline">{LATERALITY_LABELS[variant.laterality]}</Badge>
            {detail.isFavorite ? (
              <Badge tone="sun" icon={<Star />}>
                Favorito
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader as="h2" title="Objetivo y aplicaciones" />
            <p className="text-ink-700">{variant.objective || '—'}</p>
          </Card>

          <Card>
            <CardHeader
              as="h2"
              title="Instrucciones técnicas"
              description={
                detail.stepsInheritedFrom
                  ? `Tomadas de la variante de referencia: ${detail.stepsInheritedFrom.name}.`
                  : undefined
              }
            />
            {detail.steps.length ? (
              <ol className="space-y-3">
                {detail.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sun-400 text-sm font-bold text-ink-900">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-ink-700">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-500">Sin instrucciones todavía.</p>
            )}
            {variant.cues.length ? (
              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                  <Lightbulb aria-hidden className="size-4 text-sun-700" /> Puntos clave
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {variant.cues.map((cue) => (
                    <li
                      key={cue}
                      className="rounded-xl bg-leaf-100 px-3 py-1.5 text-sm font-semibold text-leaf-700"
                    >
                      {cue}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader
                as="h2"
                icon={<CircleAlert className="size-5" />}
                title="Errores frecuentes"
              />
              {variant.commonMistakes.length ? (
                <ul className="space-y-1.5 text-sm text-ink-700">
                  {variant.commonMistakes.map((mistake) => (
                    <li key={mistake} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-coral-500"
                      />
                      {mistake}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">—</p>
              )}
            </Card>
            <Card>
              <CardHeader as="h2" title="Consideraciones técnicas" />
              {variant.technicalNotes.length ? (
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-700">
                  {variant.technicalNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">—</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader as="h2" title="Variantes, progresiones y regresiones" />
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-bold text-ink-900">
                  Otras variantes de {exercise.name}
                </p>
                <VariantLinks items={detail.siblings} empty="No hay más variantes." />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-bold text-ink-900">
                  <ArrowUpRight aria-hidden className="size-4 text-leaf-700" /> Progresiones
                </p>
                <VariantLinks items={detail.progressions} empty="Sin progresiones definidas." />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-bold text-ink-900">
                  <ArrowDownRight aria-hidden className="size-4 text-coral-700" /> Regresiones
                </p>
                <VariantLinks items={detail.regressions} empty="Sin regresiones definidas." />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              as="h2"
              title="Clasificación"
              description="Cada dimensión es independiente: una variante puede tener varias etiquetas y patrones."
            />
            <div className="space-y-3">
              {detail.tagGroups.map((group) => (
                <div key={group.category}>
                  <p className="text-xs font-semibold text-ink-500">
                    {group.category}
                    {group.personal ? ' · solo tú la ves' : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => (
                      <Badge key={tag.id} tone={tag.personal ? 'plum' : 'sun'}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {detail.tagGroups.length === 0 ? (
                <p className="text-sm text-ink-500">Sin etiquetas.</p>
              ) : null}
            </div>
            {variant.classificationNote ? (
              <p className="mt-3 rounded-2xl bg-cream-50 p-3 text-xs leading-relaxed text-ink-700 ring-1 ring-line">
                {variant.classificationNote}
              </p>
            ) : null}
            <dl className="mt-4 space-y-2">
              <Classification label="Patrones de movimiento" values={detail.patterns} />
              <Classification label="Región corporal" values={detail.regions} />
              <Classification label="Material" values={detail.equipment} />
              <Classification label="Ejecución" values={[LATERALITY_LABELS[variant.laterality]]} />
              <Classification label="Entorno" values={detail.environments} />
              <Classification
                label="Complejidad"
                values={[COMPLEXITY_LABELS[variant.complexity]]}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader
              as="h2"
              icon={<NotebookPen className="size-5" />}
              title="Tus observaciones"
              description="Información personalizada: solo la ves tú, también sobre ejercicios del catálogo global."
            />
            <p className="text-sm text-ink-700">{detail.trainerNote ?? 'Sin observaciones.'}</p>
          </Card>

          <Card>
            <CardHeader as="h2" title="Vídeo y enlaces" />
            {variant.media.videoUrl && isSafeExternalUrl(variant.media.videoUrl) ? (
              <a
                href={variant.media.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-sun-700 hover:text-ink-900"
              >
                Ver vídeo <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <VideoOff aria-hidden className="size-4" /> Sin vídeo todavía: se muestra la
                silueta.
              </p>
            )}
            {links.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sun-700 hover:text-ink-900"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
