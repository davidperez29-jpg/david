import { ArrowLeft, CircleAlert, ExternalLink, Lightbulb, VideoOff } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  EXERCISE_LEVEL_LABELS,
  isSafeExternalUrl,
  MOVEMENT_PATTERN_LABELS,
} from '@/domain/exercises';
import { PatternPictogram } from '@/features/brand/pictogram';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { getTrainerContext } from '@/server/context';
import { getExerciseDetail } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Ejercicio' };

export default async function ExerciseDetailPage(
  props: PageProps<'/entrenador/ejercicios/[exerciseId]'>,
) {
  const { exerciseId } = await props.params;
  const exercise = await getExerciseDetail(await getTrainerContext(), exerciseId);
  if (!exercise) notFound();
  const links = exercise.media.links.filter((link) => isSafeExternalUrl(link.url));

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
          <PatternPictogram
            pattern={exercise.pattern}
            className="size-28"
            title={`Silueta: ${MOVEMENT_PATTERN_LABELS[exercise.pattern]}`}
          />
        </span>
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="sun">{MOVEMENT_PATTERN_LABELS[exercise.pattern]}</Badge>
            <Badge tone="outline">{EXERCISE_LEVEL_LABELS[exercise.level]}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-ink-900 sm:text-4xl">{exercise.name}</h1>
          <p className="mt-2 max-w-2xl text-ink-500">{exercise.summary}</p>
          <p className="mt-3 text-sm text-ink-700">
            <span className="font-semibold">Material:</span> {exercise.equipment.join(', ')}
          </p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader as="h2" title="Cómo se hace" />
          <ol className="space-y-3">
            {exercise.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sun-400 text-sm font-bold text-ink-900">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-ink-700">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader as="h2" icon={<Lightbulb className="size-5" />} title="Puntos clave" />
            <ul className="flex flex-wrap gap-2">
              {exercise.cues.map((cue) => (
                <li
                  key={cue}
                  className="rounded-xl bg-leaf-100 px-3 py-1.5 text-sm font-semibold text-leaf-700"
                >
                  {cue}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              as="h2"
              icon={<CircleAlert className="size-5" />}
              title="Errores frecuentes"
            />
            <ul className="space-y-1.5 text-sm text-ink-700">
              {exercise.commonMistakes.map((mistake) => (
                <li key={mistake} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-coral-500" />
                  {mistake}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader as="h2" title="Vídeo y enlaces" />
            {exercise.media.videoUrl && isSafeExternalUrl(exercise.media.videoUrl) ? (
              <a
                href={exercise.media.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-sun-700 hover:text-ink-900"
              >
                Ver vídeo <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <VideoOff aria-hidden className="size-4" /> Sin vídeo todavía. Se mostrará la
                silueta del patrón.
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
