'use client';

import type { ExerciseDetail, LibraryTaxonomies } from '@tp/application';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { draftFrom, ExerciseForm } from '@/components/library/exercise-form';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { api } from '@/lib/api-client';
import { ExercisePicker, type SearchHit } from '@/components/library/exercise-picker';
import { formatDateTime, label, LABELS } from '@/lib/labels';

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));

export function ExerciseActions({
  exercise,
}: {
  exercise: {
    id: string;
    status: string;
    needsReview: boolean;
    isGlobal: boolean;
    publishProblems: string[];
  };
}) {
  const router = useRouter();
  const a = useApiAction();
  const [notes, setNotes] = useState('');
  if (exercise.isGlobal) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Ejercicio de la biblioteca global. Para adaptarlo, crea una copia en tu organización.
          </p>
          <Button
            disabled={a.pending}
            onClick={async () => {
              const r = await a.run<{ id: string }>(
                `/exercises/${exercise.id}/fork`,
                'POST',
                {},
                { refresh: false },
              );
              if (r) router.push(`/app/library/${r.id}`);
            }}
          >
            Copiar a mi organización
          </Button>
        </div>
        <FormError error={a.error} />
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        {exercise.needsReview ? (
          <>
            <Input
              aria-label="Notas de revisión"
              placeholder="Notas de revisión (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="secondary"
              disabled={a.pending}
              onClick={() => a.run(`/exercises/${exercise.id}/review`, 'POST', { notes })}
            >
              Marcar como revisado
            </Button>
          </>
        ) : null}
        {exercise.status !== 'published' ? (
          <Button
            disabled={a.pending || exercise.publishProblems.length > 0}
            onClick={() =>
              a.run(`/exercises/${exercise.id}/status`, 'POST', { status: 'published' })
            }
          >
            Publicar
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={a.pending}
            onClick={() => a.run(`/exercises/${exercise.id}/status`, 'POST', { status: 'draft' })}
          >
            Volver a borrador
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={a.pending}
          onClick={async () => {
            const r = await a.run<{ id: string }>(
              `/exercises/${exercise.id}/duplicate`,
              'POST',
              {},
              { refresh: false },
            );
            if (r) router.push(`/app/library/${r.id}`);
          }}
        >
          Duplicar
        </Button>
        {exercise.status !== 'archived' ? (
          <Button
            variant="ghost"
            disabled={a.pending}
            onClick={() => {
              if (confirm('¿Archivar este ejercicio? Dejará de aparecer en búsquedas.'))
                void a.run(`/exercises/${exercise.id}/status`, 'POST', { status: 'archived' });
            }}
          >
            Archivar
          </Button>
        ) : null}
      </div>
      {exercise.publishProblems.length && exercise.status !== 'published' ? (
        <ul className="mt-2 list-inside list-disc text-sm text-muted">
          {exercise.publishProblems.map((p) => (
            <li key={p}>{label('publishProblem', p)}</li>
          ))}
        </ul>
      ) : null}
      <FormError error={a.error} />
    </Card>
  );
}

export function EditExercise({
  exercise,
  tax,
}: {
  exercise: ExerciseDetail;
  tax: LibraryTaxonomies;
}) {
  const router = useRouter();
  return (
    <ExerciseForm
      key={exercise.version}
      tax={tax}
      initial={draftFrom(exercise)}
      readOnly={exercise.isGlobal}
      submitLabel="Guardar cambios"
      onSubmit={async (payload, run) => {
        if (
          await run(
            `/exercises/${exercise.id}`,
            'PATCH',
            { ...payload, expectedVersion: exercise.version },
            { refresh: false },
          )
        )
          router.refresh();
      }}
    />
  );
}

export function MediaPanel({ exercise }: { exercise: ExerciseDetail }) {
  const a = useApiAction();
  const up = useApiAction();
  const router = useRouter();
  const [video, setVideo] = useState({ url: '', title: '', channel: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const videos = exercise.media.filter((m) => m.type === 'video');
  const silhouette = exercise.media.find((m) => m.type === 'silhouette' && m.status !== 'replaced');
  const [uploadError, setUploadError] = useState<string | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Vídeos" className="lg:col-span-2">
        <p className="mb-3 text-xs text-muted">
          Un vídeo nuevo queda «pendiente de verificación» y el cliente no lo verá hasta que alguien
          confirme que muestra el ejercicio correctamente.
        </p>
        {videos.length === 0 ? (
          <EmptyState>Sin vídeos.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {videos.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-2 border-b border-border pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    tone={
                      v.status === 'verified' ? 'ok' : v.status === 'broken' ? 'danger' : 'warn'
                    }
                  >
                    {label('mediaStatus', v.status)}
                  </Badge>
                  <a
                    href={v.urlOrKey}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all underline"
                  >
                    {v.title || v.urlOrKey}
                  </a>
                  {v.channel ? <span className="text-muted">· {v.channel}</span> : null}
                  {v.verifiedAt ? (
                    <span className="text-muted">· verificado {formatDateTime(v.verifiedAt)}</span>
                  ) : null}
                </div>
                {v.notice ? <p className="text-xs text-warn">{v.notice}</p> : null}
                {v.embedUrl && !exercise.isGlobal ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-muted">
                      Ver vídeo para verificarlo
                    </summary>
                    <iframe
                      title={`Vídeo de ${exercise.name}`}
                      src={v.embedUrl}
                      className="mt-2 aspect-video w-full max-w-xl rounded"
                      allow="encrypted-media; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      loading="lazy"
                    />
                  </details>
                ) : null}
                {!exercise.isGlobal ? (
                  <div className="flex flex-wrap gap-2">
                    {v.status !== 'verified' ? (
                      <Button
                        size="sm"
                        disabled={a.pending}
                        onClick={() =>
                          a.run(`/exercises/${exercise.id}/media/${v.id}/verify`, 'POST', {
                            status: 'verified',
                          })
                        }
                      >
                        He visto el vídeo: es correcto
                      </Button>
                    ) : null}
                    {v.status !== 'broken' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={a.pending}
                        onClick={() =>
                          a.run(`/exercises/${exercise.id}/media/${v.id}/verify`, 'POST', {
                            status: 'broken',
                          })
                        }
                      >
                        Marcar como roto
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={a.pending}
                      onClick={() => a.run(`/exercises/${exercise.id}/media/${v.id}`, 'DELETE')}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!exercise.isGlobal ? (
          <form
            className="mt-4 grid gap-2 md:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await a.run(`/exercises/${exercise.id}/videos`, 'POST', video))
                setVideo({ url: '', title: '', channel: '' });
            }}
          >
            <div className="md:col-span-2">
              <Field label="URL (YouTube o Vimeo)" htmlFor="v-url" error={a.fieldError('url')}>
                <Input
                  id="v-url"
                  value={video.url}
                  onChange={(e) => setVideo({ ...video, url: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Título" htmlFor="v-title">
              <Input
                id="v-title"
                value={video.title}
                onChange={(e) => setVideo({ ...video, title: e.target.value })}
              />
            </Field>
            <Field label="Canal" htmlFor="v-channel">
              <Input
                id="v-channel"
                value={video.channel}
                onChange={(e) => setVideo({ ...video, channel: e.target.value })}
              />
            </Field>
            <div>
              <Button type="submit" disabled={a.pending || !video.url}>
                Añadir vídeo
              </Button>
            </div>
          </form>
        ) : null}
        <FormError error={a.error} />
      </Card>
      <Card title="Silueta">
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-border bg-white">
          {silhouette?.fileUrl ? (
            <img
              src={silhouette.fileUrl}
              alt={`Silueta de ${exercise.name}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-sm text-neutral-500">Sin silueta</span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          Fondo blanco, figura negra, material visible. PNG, JPEG o WebP, máx. 2 MB.
        </p>
        {!exercise.isGlobal ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Archivo de silueta"
              className="mt-2 text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploadError(null);
                const body = new FormData();
                body.append('file', f);
                const res = await fetch(`/api/v1/exercises/${exercise.id}/silhouette`, {
                  method: 'POST',
                  body,
                  credentials: 'same-origin',
                });
                if (!res.ok)
                  setUploadError(
                    ((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error
                      ?.message ?? 'Error al subir.',
                  );
                if (fileRef.current) fileRef.current.value = '';
                router.refresh();
              }}
            />
            {uploadError ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {uploadError}
              </p>
            ) : null}
            <FormError error={up.error} />
          </>
        ) : null}
      </Card>
    </div>
  );
}

export function ProgressionsPanel({ exercise }: { exercise: ExerciseDetail }) {
  const a = useApiAction();
  const [target, setTarget] = useState<SearchHit | null>(null);
  const [relation, setRelation] = useState<'progression' | 'regression' | 'variant'>('progression');
  const [axes, setAxes] = useState<string[]>([]);
  const AXES: Record<string, string> = {
    load: 'Carga',
    reps: 'Repeticiones',
    volume: 'Volumen',
    effort: 'Esfuerzo',
    rom: 'ROM',
    complexity: 'Complejidad',
    stability: 'Estabilidad',
    unilaterality: 'Unilateralidad',
    velocity: 'Velocidad',
    impact: 'Impacto',
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Relaciones">
        {exercise.related.length === 0 ? (
          <EmptyState>Sin progresiones, regresiones ni variantes.</EmptyState>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {exercise.related.map((r) => (
              <li
                key={`${r.id}-${r.direction}`}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span>
                  <Badge
                    tone={
                      r.relation === 'progression'
                        ? 'accent'
                        : r.relation === 'regression'
                          ? 'ok'
                          : 'neutral'
                    }
                  >
                    {label('progressionRelation', r.relation)}
                  </Badge>{' '}
                  <a className="font-medium hover:underline" href={`/app/library/${r.otherId}`}>
                    {r.name}
                  </a>
                  {r.axes.length ? (
                    <span className="text-muted">
                      {' '}
                      · {r.axes.map((x) => AXES[x] ?? x).join(', ')}
                    </span>
                  ) : null}
                </span>
                {r.organizationId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={a.pending}
                    onClick={() => a.run(`/exercise-progressions/${r.id}`, 'DELETE')}
                  >
                    Quitar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Añadir relación">
        <div className="flex flex-col gap-3">
          <Field label="Este ejercicio tiene como…" htmlFor="rel">
            <Select
              id="rel"
              value={relation}
              onChange={(e) => setRelation(e.target.value as typeof relation)}
              options={[
                { value: 'progression', label: 'Progresión (más exigente)' },
                { value: 'regression', label: 'Regresión (más sencillo)' },
                { value: 'variant', label: 'Variante' },
              ]}
            />
          </Field>
          <ExercisePicker excludeId={exercise.id} onPick={setTarget} />
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Qué cambia</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(AXES).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={axes.includes(k)}
                    onChange={() =>
                      setAxes(axes.includes(k) ? axes.filter((x) => x !== k) : [...axes, k])
                    }
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <FormError error={a.error} />
          <div>
            <Button
              disabled={!target || a.pending}
              onClick={async () => {
                if (
                  target &&
                  (await a.run('/exercise-progressions', 'POST', {
                    fromExerciseId: exercise.id,
                    toExerciseId: target.id,
                    relation,
                    axes,
                  }))
                ) {
                  setTarget(null);
                  setAxes([]);
                }
              }}
            >
              Añadir
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface SubstitutesResult {
  suggestions: { exerciseId: string; name: string; score: number; reasons: string[] }[];
  excludedCount: number;
  note: string;
}

export function SubstitutesPanel({ exerciseId }: { exerciseId: string }) {
  const [reason, setReason] = useState('pain');
  const [data, setData] = useState<SubstitutesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await api<SubstitutesResult>(
        `/exercises/${exerciseId}/substitutes?reason=${reason}`,
      );
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error.message);
    })();
  }, [exerciseId, reason]);
  return (
    <Card title="Alternativas sugeridas">
      <div className="mb-3 max-w-xs">
        <Field label="Motivo" htmlFor="sub-reason">
          <Select
            id="sub-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            options={opts(LABELS.substitutionReason)}
          />
        </Field>
      </div>
      <p className="mb-3 text-xs text-muted">
        Vista previa general. En una sesión se tendrán en cuenta además el material, las tolerancias
        y el nivel del cliente. {data?.note}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {data && data.suggestions.length === 0 ? (
        <EmptyState>No hay alternativas con el mismo patrón o músculos principales.</EmptyState>
      ) : null}
      <ol className="flex flex-col gap-2">
        {data?.suggestions.map((s) => (
          <li key={s.exerciseId} className="rounded-md border border-border p-2 text-sm">
            <a href={`/app/library/${s.exerciseId}`} className="font-medium hover:underline">
              {s.name}
            </a>
            <ul className="mt-1 list-inside list-disc text-muted">
              {s.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function MethodsPanel({
  exercise,
  methods,
}: {
  exercise: { id: string; isGlobal: boolean; methodIds: string[] };
  methods: { id: string; name: string; kind: string; status: string; isGlobal: boolean }[];
}) {
  const a = useApiAction();
  const [sel, setSel] = useState<string[]>(exercise.methodIds);
  const linked = methods.filter((m) => exercise.methodIds.includes(m.id));
  return (
    <Card title="Métodos de la biblioteca científica">
      <p className="mb-3 text-xs text-muted">
        El ejercicio solo enlaza con el método; la evidencia, sus niveles y sus fuentes viven en la
        biblioteca científica.
      </p>
      {exercise.isGlobal ? (
        linked.length ? (
          <ul className="text-sm">
            {linked.map((m) => (
              <li key={m.id}>
                <a className="underline" href={`/app/science/methods/${m.id}`}>
                  {m.name}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Sin métodos enlazados.</EmptyState>
        )
      ) : methods.length === 0 ? (
        <EmptyState>No hay métodos en la biblioteca científica.</EmptyState>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(`/exercises/${exercise.id}/methods`, 'PUT', { methodIds: sel });
          }}
        >
          <ul className="grid gap-1 sm:grid-cols-2">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id={`method-${m.id}`}
                  checked={sel.includes(m.id)}
                  onChange={(e) =>
                    setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))
                  }
                />
                <label htmlFor={`method-${m.id}`}>{m.name}</label>
                <a className="text-xs text-muted underline" href={`/app/science/methods/${m.id}`}>
                  ver evidencia
                </a>
                {m.status !== 'published' ? (
                  <Badge>{label('scienceStatus', m.status)}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
          <FormError error={a.error} />
          {a.done ? <p className="text-sm text-ok">Métodos guardados.</p> : null}
          <Button disabled={a.pending} className="self-start">
            Guardar métodos
          </Button>
        </form>
      )}
    </Card>
  );
}

/**
 * The centre's own load increment (restructure phase 13): the smallest jump the programming
 * engine proposes for this exercise. Also for global exercises (it is the centre's setting).
 */
export function LoadIncrementPanel({ exercise }: { exercise: ExerciseDetail }) {
  const a = useApiAction();
  const li = exercise.loadIncrement;
  const [value, setValue] = useState(String(li.kg).replace('.', ','));
  const save = (incrementKg: number | null) =>
    a.run(`/exercises/${exercise.id}/load-increment`, 'PUT', { incrementKg });
  return (
    <Card title="Incremento de carga">
      <p className="mb-2 text-sm text-muted">
        El salto mínimo que propone el motor al subir o bajar la carga de este ejercicio. Por
        defecto depende del material ({String(li.defaultKg).replace('.', ',')} kg). Cámbialo si en
        tu centro usáis otro (discos de 1 kg, placas de 5 kg…).{' '}
        {li.custom ? <Badge tone="accent">Del centro</Badge> : <Badge>Por defecto</Badge>}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(Number(value.replace(',', '.')));
        }}
      >
        <Field label="Incremento (kg)" htmlFor="load-inc" error={a.fieldError('incrementKg')}>
          <Input
            id="load-inc"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28"
          />
        </Field>
        <Button disabled={a.pending}>Guardar</Button>
        {li.custom ? (
          <Button
            type="button"
            variant="ghost"
            disabled={a.pending}
            onClick={() => {
              setValue(String(li.defaultKg).replace('.', ','));
              void save(null);
            }}
          >
            Volver al de por defecto
          </Button>
        ) : null}
      </form>
      <FormError error={a.error} />
    </Card>
  );
}
